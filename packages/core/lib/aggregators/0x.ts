import { Aggregator } from "../aggregator";
import { type QuoteDetail, type SwapParams, QuoteError } from "../types";

export type ZeroXConfig = {
  apiKey: string;
};

export class ZeroXAggregator extends Aggregator {
  constructor(private config: ZeroXConfig) {
    super();
  }

  name(): string {
    return "0x";
  }

  async fetchQuote(request: SwapParams): Promise<QuoteDetail> {
    const response = await this.makeRequest(request);

    return {
      outputAmount: BigInt(response.buyAmount),
      networkFee: BigInt(response.totalNetworkFee),
      blockNumber: Number(response.blockNumber) + 1,
      txData: {
        to: response.transaction.to,
        data: response.transaction.data,
      },
      // details: toJson(response),
    };
  }

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  private async makeRequest(request: SwapParams): Promise<any> {
    if (!this.config.apiKey) {
      throw new Error("0x API key is not set. Please set the ZEROX_API_KEY environment variable.");
    }

    const params = new URLSearchParams({
      chainId: request.chainId.toString(),
      buyToken: request.outputToken,
      sellToken: request.inputToken,
      sellAmount: request.inputAmount.toString(),
      slippageBps: request.slippageBps.toString(),
      taker: request.swapperAccount,
    });

    const response = await fetch(
      `https://api.0x.org/swap/allowance-holder/quote?${params.toString()}`,
      {
        headers: {
          accept: "application/json",
          "0x-api-key": this.config.apiKey,
          "0x-version": "v2",
        },
      },
    );

    const body = await response.json();
    if (!response.ok) {
      throw new QuoteError(`0x API request failed with status ${response.status}`, body);
    }
    return body;
  }
}
