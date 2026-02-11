import type { AggregationOptions, Quote, SwapParams } from "../types.js";
import { decodeQuoteStream } from "./streams.js";

/**
 * Configuration for constructing an AggregatorProxy.
 */
export type AggregatorProxyConfig = {
  /**
   * Base path or URL for the proxy endpoint (query string is appended automatically).
   */
  pathOrUrl: string;
};

/**
 * Proxy that fetches quotes from a remote server and returns a stream of quote promises.
 */
export class AggregatorProxy {
  constructor(private config: AggregatorProxyConfig) {}

  /**
   * Request quotes from the configured proxy endpoint.
   *
   * @param params - Swap parameters used to build the proxy query.
   * @param _options - Aggregation options (reserved for future proxy support).
   * @returns Promises that resolve to individual quote results as they stream in.
   */
  async prepareQuotes(
    params: SwapParams,
    _options?: AggregationOptions,
  ): Promise<Array<Promise<Quote>>> {
    const [prefix, suffix] = this.config.pathOrUrl.split("?");
    const query = new URLSearchParams(suffix || "");
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

    return fetch(`${prefix}?${query.toString()}`, {
      method: "GET",
    })
      .then((response) =>
        response.body ? response.body : Promise.reject(new Error("No response body from proxy")),
      )
      .then((stream) => decodeQuoteStream(stream));
  }
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
