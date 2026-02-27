import { type ProviderKey, type Quote, QuoteError, type SimulatedQuote } from "../types.js";
import { deserializeWithBigInt, serializeWithBigInt } from "./serde.js";

// Magic header bits to identify the stream format
const STREAM_MAGIC = 0xdec5feed;
// Currently no flags are defined (reserved for future use)
const STREAM_FLAGS = 0;

type CancellablePromiseArray<T> = Array<Promise<T>> & {
  cancel?: (reason?: unknown) => void;
};

type DecodeStreamOptions = {
  onCancel?: (reason?: unknown) => void;
};

export type StreamErrorHandler<T> = (error: unknown) => T;

/**
 * Produces a ReadableStream that emits serialized values as they resolve.
 *
 * @param promises - Value promises to resolve and write to the stream.
 * @param onRejected - Handler used to normalize rejected promises into streamable values.
 * @returns ReadableStream that streams serialized values.
 */
export function newStream<T>(
  promises: Array<Promise<T>>,
  onRejected: StreamErrorHandler<T>,
): ReadableStream<Uint8Array> {
  return newSerializedStream(promises, onRejected);
}

function newSerializedStream<T>(promises: Array<Promise<T>>, onRejected: StreamErrorHandler<T>) {
  if (promises.length > 0xff) {
    throw new Error("Cannot create quote stream: number of quotes exceeds 255.");
  }

  return new ReadableStream<Uint8Array>({
    start(controller) {
      let count = promises.length;
      controller.enqueue(encodeHeaderFrame(count));

      function tryClose() {
        try {
          controller.close();
        } catch {}
      }

      if (count === 0) {
        tryClose();
        return;
      }

      const finish = () => {
        count -= 1;
        if (count === 0) {
          tryClose();
        }
      };

      // Enqueue each quote as it resolves, and call finish when done
      for (const promise of promises) {
        promise
          .then((value) => value)
          .catch((error) => onRejected(error))
          .then((value) => {
            try {
              controller.enqueue(encodeValueFrame(value));
            } catch {
              // Controller may be closed if stream was cancelled
            }
            finish();
          });
      }
    },
  });
}

/**
 * Decodes a ReadableStream of serialized values into an array of promises.
 *
 * @param stream - A ReadableStream produced by `newStream`.
 * @returns An array of promises that resolve as each value is streamed.
 */
export async function decodeStream<T>(
  stream: ReadableStream<Uint8Array>,
  options?: DecodeStreamOptions,
): Promise<CancellablePromiseArray<T>> {
  return decodeSerializedStream(stream, decodeValueFrame<T>, options);
}

async function decodeSerializedStream<T>(
  stream: ReadableStream<Uint8Array>,
  decodeFrame: (frame: Uint8Array) => T | undefined,
  options?: DecodeStreamOptions,
): Promise<CancellablePromiseArray<T>> {
  const reader = stream.getReader();
  let buffer: Uint8Array = new Uint8Array(0);

  while (buffer.length < 6) {
    const { value, done } = await reader.read();
    if (done) {
      reader.releaseLock();
      throw new Error("Quote stream ended before header was received.");
    }
    buffer = appendBuffer(buffer, value);
  }

  const { count } = decodeHeaderFrame(buffer.subarray(0, 6));
  const deferred = Array.from({ length: count }, () => createDeferred<T>());
  const promises = deferred.map(({ promise }) => promise) as CancellablePromiseArray<T>;
  buffer = buffer.slice(6);
  let cancelled = false;

  const cancel = (reason?: unknown) => {
    if (cancelled) {
      return;
    }
    cancelled = true;
    const error = normalizeCancelReason(reason);
    options?.onCancel?.(error);
    for (const item of deferred) {
      item.rejectIfPending(error);
    }
    void reader.cancel(error).catch(() => {});
  };

  promises.cancel = cancel;

  void (async () => {
    let index = 0;

    try {
      while (index < count && !cancelled) {
        while (true) {
          if (buffer.length < 4) {
            break;
          }
          const payloadLength = new DataView(buffer.buffer, buffer.byteOffset, 4).getUint32(
            0,
            false,
          );
          const frameLength = 4 + payloadLength;
          if (buffer.length < frameLength) {
            break;
          }
          const frame = buffer.subarray(0, frameLength);
          const value = decodeFrame(frame);
          if (!value) {
            break;
          }
          deferred[index]?.resolve(value);
          index += 1;
          buffer = buffer.slice(frameLength);
        }

        if (index >= count || cancelled) {
          break;
        }

        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        buffer = appendBuffer(buffer, value);
      }

      if (!cancelled && index < count) {
        const error = new Error("Quote stream ended before all quotes were received.");
        for (let i = index; i < count; i += 1) {
          deferred[i]?.rejectIfPending(error);
        }
      }
    } catch (error) {
      if (!cancelled) {
        for (let i = index; i < count; i += 1) {
          deferred[i]?.rejectIfPending(error);
        }
      }
    } finally {
      reader.releaseLock();
    }
  })();

  return promises;
}

/// Helper Functions ///

export function quoteStreamErrorHandler(error: unknown): Quote {
  if (error && typeof error === "object") {
    if ("success" in error) {
      return error as Quote;
    }
    if ("provider" in error && typeof (error as { provider?: unknown }).provider === "string") {
      const provider = (error as { provider: ProviderKey }).provider;
      return {
        success: false,
        provider,
        error:
          error instanceof QuoteError ? error : new QuoteError("Quote promise rejected", error),
      };
    }
  }

  return {
    success: false,
    provider: "fabric",
    error: error instanceof QuoteError ? error : new QuoteError("Quote promise rejected", error),
  };
}

export function simulatedQuoteStreamErrorHandler(error: unknown): SimulatedQuote {
  if (
    error &&
    typeof error === "object" &&
    "simulation" in error &&
    error.simulation &&
    typeof error.simulation === "object" &&
    "success" in error.simulation
  ) {
    return error as SimulatedQuote;
  }

  return {
    ...quoteStreamErrorHandler(error),
    simulation: {
      success: false,
      error:
        error instanceof Error
          ? error
          : new Error("Simulated quote promise rejected", { cause: error }),
    },
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  let settled = false;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = (value) => {
      if (settled) {
        return;
      }
      settled = true;
      innerResolve(value);
    };
    reject = (error) => {
      if (settled) {
        return;
      }
      settled = true;
      innerReject(error);
    };
  });
  return {
    promise,
    resolve,
    reject,
    rejectIfPending: reject,
  };
}

// Note: The added flags byte here is reserved for future use (in case we want to add features to the stream format without breaking compatibility)
function encodeHeaderFrame(count: number): Uint8Array {
  const header = new Uint8Array(6);
  const headerView = new DataView(header.buffer);
  headerView.setUint32(0, STREAM_MAGIC, false);
  headerView.setUint8(4, STREAM_FLAGS);
  headerView.setUint8(5, count);
  return header;
}

function decodeHeaderFrame(frame: Uint8Array): { count: number } {
  const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
  const magic = view.getUint32(0, false);
  const flags = view.getUint8(4);
  const count = view.getUint8(5);
  if (magic !== STREAM_MAGIC || flags !== STREAM_FLAGS) {
    throw new Error("Unsupported quote stream header.");
  }
  return { count };
}

function appendBuffer(buffer: Uint8Array, chunk?: Uint8Array): Uint8Array {
  if (!chunk || chunk.length === 0) {
    return buffer;
  }
  if (buffer.length === 0) {
    return chunk;
  }
  const next = new Uint8Array(buffer.length + chunk.length);
  next.set(buffer);
  next.set(chunk, buffer.length);
  return next;
}

function encodeValueFrame<T>(value: T): Uint8Array {
  const encoder = new TextEncoder();
  const payload = encoder.encode(serializeWithBigInt(value));
  const frame = new Uint8Array(4 + payload.length);
  const view = new DataView(frame.buffer);
  view.setUint32(0, payload.length, false);
  frame.set(payload, 4);
  return frame;
}

function decodeValueFrame<T>(frame: Uint8Array): T | undefined {
  const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
  const payloadLength = view.getUint32(0, false);
  if (frame.byteLength - 4 < payloadLength) {
    return undefined;
  }
  const payload = frame.subarray(4, 4 + payloadLength);
  const decoder = new TextDecoder();
  return deserializeWithBigInt<T>(decoder.decode(payload));
}

function normalizeCancelReason(reason?: unknown): Error {
  if (reason instanceof Error) {
    return reason;
  }
  return new Error("Quote stream cancelled");
}
