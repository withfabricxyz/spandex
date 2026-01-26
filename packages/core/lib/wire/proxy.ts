import type { AggregationOptions, Quote, SwapParams } from "../types.js";
import { decodeQuoteStream } from "./streams.js";

export type AggregatorProxyConfig = {
  pathOrUrl: string;
};

export class AggregatorProxy {
  constructor(private config: AggregatorProxyConfig) {}

  async prepareQuotes(
    params: SwapParams,
    _options?: AggregationOptions,
  ): Promise<Array<Promise<Quote>>> {
    const url = new URL(this.config.pathOrUrl);

    // Form get request to proxy with query params for swap and options
    const query = url.searchParams;
    query.append("chainId", params.chainId.toString());
    query.append("inputToken", params.inputToken);
    query.append("outputToken", params.outputToken);
    query.append("slippageBps", params.slippageBps.toString());
    query.append("swapperAccount", params.swapperAccount);
    query.append("mode", params.mode);
    if (params.mode === "exactIn") {
      query.append("inputAmount", params.inputAmount.toString());
    } else if (params.mode === "targetOut") {
      query.append("outputAmount", params.outputAmount.toString());
    }

    return fetch(url.toString(), {
      method: "GET",
    })
      .then((response) =>
        response.body ? response.body : Promise.reject(new Error("No response body from proxy")),
      )
      .then((stream) => decodeQuoteStream(stream));
  }
}

export function proxy(config: AggregatorProxyConfig): AggregatorProxy {
  return new AggregatorProxy(config);
}
