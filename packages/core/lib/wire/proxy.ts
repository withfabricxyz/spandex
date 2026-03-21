import type { Quote, SimulatedQuote, SwapParams } from "../types.js";
import { decodeStream } from "./streams.js";

export type ProxyDelegatedAction = "prepareQuotes" | "prepareSimulatedQuotes";

/**
 * Configuration for constructing an AggregatorProxy.
 */
export type AggregatorProxyConfig = {
  delegatedActions: [ProxyDelegatedAction, ...ProxyDelegatedAction[]];
  /**
   * Base path or URL for the proxy endpoint (query string is appended automatically).
   */
  pathOrUrl: string;

  /**
   * Optional headers to include in the proxy request (reserved for future support).
   */
  headers?: Record<string, string>;
};

/**
 * Proxy that fetches quotes from a remote server and returns a stream of quote promises.
 */
export class AggregatorProxy {
  private readonly delegatedActions: Set<ProxyDelegatedAction>;

  constructor(private config: AggregatorProxyConfig) {
    const delegatedActions = config.delegatedActions;
    if (!delegatedActions?.length) {
      throw new Error("Proxy configuration requires at least one delegated action.");
    }
    this.delegatedActions = new Set(delegatedActions);
  }

  /**
   * Determines if a given function is delegated to the proxy.
   */
  isDelegatedAction(method: ProxyDelegatedAction): boolean {
    return this.delegatedActions.has(method);
  }

  /**
   * Request quotes from the configured proxy endpoint.
   *
   * @param params - Swap parameters to retrieve quotes for
   * @returns Promises that resolve to individual quote results as they stream in.
   */
  async prepareQuotes(params: SwapParams): Promise<Array<Promise<Quote>>> {
    this.assertDelegatedAction("prepareQuotes");
    const query = quoteQueryParams(params);
    return this.fetchStream<Quote>(
      `${this.baseUrl}/prepareQuotes?${query.toString()}`,
      decodeStream,
    );
  }

  /**
   * Request simulated quotes from the configured proxy endpoint.
   * @param params - Swap parameters to retrieve quotes for
   * @returns Promises that resolve to individual simulated quote results as they stream in.
   */
  async prepareSimulatedQuotes(params: SwapParams): Promise<Array<Promise<SimulatedQuote>>> {
    this.assertDelegatedAction("prepareSimulatedQuotes");
    const query = quoteQueryParams(params);
    return this.fetchStream<SimulatedQuote>(
      `${this.baseUrl}/prepareSimulatedQuotes?${query.toString()}`,
      decodeStream,
    );
  }

  private get baseUrl(): string {
    return this.config.pathOrUrl.endsWith("/")
      ? this.config.pathOrUrl.slice(0, -1)
      : this.config.pathOrUrl;
  }

  private assertDelegatedAction(action: ProxyDelegatedAction): void {
    if (!this.isDelegatedAction(action)) {
      throw new Error(`Proxy is not configured to delegate ${action}.`);
    }
  }

  private async fetchStream<T>(
    url: string,
    decode: (
      stream: ReadableStream<Uint8Array>,
      options?: { onCancel?: (reason?: unknown) => void },
    ) => Promise<Array<Promise<T>>>,
  ): Promise<Array<Promise<T>>> {
    const controller = new AbortController();
    const response = await fetch(url, {
      method: "GET",
      headers: this.config.headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Proxy request failed with status ${response.status}`);
    }
    if (!response.body) {
      throw new Error("No response body from proxy");
    }

    return decode(response.body, {
      onCancel: (reason) => controller.abort(reason),
    });
  }
}

function quoteQueryParams(params: SwapParams): URLSearchParams {
  const query = new URLSearchParams();
  query.append("chainId", params.chainId.toString());
  if (params.outputChainId !== undefined) {
    query.append("outputChainId", params.outputChainId.toString());
  }
  query.append("inputToken", params.inputToken);
  query.append("outputToken", params.outputToken);
  query.append("slippageBps", params.slippageBps.toString());
  query.append("swapperAccount", params.swapperAccount);
  if (params.recipientAccount) {
    query.append("recipientAccount", params.recipientAccount);
  }
  query.append("mode", params.mode);
  if (params.mode === "exactIn") {
    query.append("inputAmount", params.inputAmount.toString());
  } else if (params.mode === "targetOut") {
    query.append("outputAmount", params.outputAmount.toString());
  }
  return query;
}

/**
 * Convenience factory for creating an AggregatorProxy instance.
 *
 * @param config - Proxy configuration.
 * @returns AggregatorProxy instance.
 */
export function proxy(config: AggregatorProxyConfig): AggregatorProxy {
  return new AggregatorProxy(config);
}

/**
 * Create a spanDEX cloud proxy instance with the given API key.
 *
 * @param params.apiKey - API key for authenticating with the SpanDEX Cloud proxy service. You can use any key to start. See https://spandex.sh/spandex-cloud/introduction for more details.
 * @returns AggregatorProxy instance configured to communicate with the SpanDEX Cloud proxy.
 */
export function spandexCloud({ apiKey }: { apiKey: string }): AggregatorProxy {
  return new AggregatorProxy({
    pathOrUrl: "https://edge.spandex.sh/api/v1",
    delegatedActions: ["prepareQuotes", "prepareSimulatedQuotes"],
    headers: {
      "X-Api-Key": apiKey,
    },
  });
}
