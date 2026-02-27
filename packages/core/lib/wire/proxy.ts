import type {
  Quote,
  QuoteSelectionStrategy,
  SimulatedQuote,
  SuccessfulSimulatedQuote,
  SwapParams,
} from "../types.js";
import { deserializeWithBigInt } from "./serde.js";
import { decodeQuoteStream } from "./streams.js";

/**
 * Configuration for constructing an AggregatorProxy.
 */
export type AggregatorProxyConfig = {
  /**
   * Base path or URL for the proxy endpoint (query string is appended automatically).
   */
  pathOrUrl: string;

  /**
   * Optional headers to include in the proxy request (reserved for future support).
   */
  headers?: Record<string, string>;

  /**
   * Optional list of actions to defer to the proxy instead of executing locally.
   * By default prepareQuotes is deferred when a proxy is active.
   */
  deferredActions?: ("getQuotes" | "getQuote")[];
};

/**
 * Proxy that fetches quotes from a remote server and returns a stream of quote promises.
 */
export class AggregatorProxy {
  private readonly deferredActions: Set<"getQuotes" | "getQuote">;
  constructor(private config: AggregatorProxyConfig) {
    this.deferredActions = new Set(config.deferredActions || ["getQuotes", "getQuote"]);
  }

  /**
   * Determines if a given action should be deferred to the proxy based on the configuration.
   *
   * By default prepareQuotes is treated as a deferred call, while getQuotes and getQuote are not.
   * This allows for a common pattern where quote preparation (which may involve complex logic or
   * third-party integrations) is handled by the proxy, while simulation and selection are executed locally.
   *
   * @param method - The method being invoked (e.g. 'getQuotes', 'getQuote').
   * @returns True if the method should be deferred to the proxy, false otherwise.
   */
  isDeferredAction(method: "getQuotes" | "getQuote"): boolean {
    return this.deferredActions.has(method);
  }

  /**
   * Request quotes from the configured proxy endpoint.
   *
   * @param params - Swap parameters to retrieve quotes for
   * @returns Promises that resolve to individual quote results as they stream in.
   */
  async prepareQuotes(params: SwapParams): Promise<Array<Promise<Quote>>> {
    const query = quoteQueryParams(params);

    return fetch(`${this.baseUrl}/prepare_quotes?${query.toString()}`, {
      method: "GET",
      headers: this.config.headers,
    })
      .then((response) =>
        response.body ? response.body : Promise.reject(new Error("No response body from proxy")),
      )
      .then((stream) => decodeQuoteStream(stream));
  }

  /**
   * Fetch simulated quotes from the proxy endpoint. Note that when using AggregatorProxy, quotes are not simulated
   * locally, so this method simply forwards the request to the proxy and returns its response.
   * @param params - Swap parameters to retrieve quotes for
   * @returns The array of simulated quotes
   */
  async getQuotes(params: SwapParams): Promise<SimulatedQuote[]> {
    const query = quoteQueryParams(params);

    return fetchJsonWithBigInt<SimulatedQuote[]>(
      `${this.baseUrl}/get_quotes?${query.toString()}`,
      this.config.headers,
    );
  }

  /**
   *
   * @param params - Swap parameters to retrieve quotes for
   * @param strategy - Quote selection strategy to apply on the proxy side (custom functions are not supported
   * in this mode since selection happens remotely)
   * @returns The selected quote or null if no quote is available
   */
  async getQuote(
    params: SwapParams,
    strategy: QuoteSelectionStrategy,
  ): Promise<SuccessfulSimulatedQuote | null> {
    if (typeof strategy === "function") {
      throw new Error(
        "Custom quote selection functions are not supported when using SpanDEXCloudProxy.",
      );
    }

    const query = quoteQueryParams(params);
    query.append("strategy", strategy);

    return fetchJsonWithBigInt<SuccessfulSimulatedQuote | null>(
      `${this.baseUrl}/get_quote?${query.toString()}`,
      this.config.headers,
    );
  }

  private get baseUrl(): string {
    return this.config.pathOrUrl.endsWith("/")
      ? this.config.pathOrUrl.slice(0, -1)
      : this.config.pathOrUrl;
  }
}

function quoteQueryParams(params: SwapParams): URLSearchParams {
  const query = new URLSearchParams();
  query.append("chainId", params.chainId.toString());
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

async function fetchJsonWithBigInt<T>(url: string, headers?: Record<string, string>): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw new Error(`Proxy request failed with status ${response.status}`);
  }

  const payload = await response.text();
  if (!payload) {
    throw new Error("No response body from proxy");
  }

  return deserializeWithBigInt<T>(payload);
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
    headers: {
      "X-Api-Key": apiKey,
    },
  });
}
