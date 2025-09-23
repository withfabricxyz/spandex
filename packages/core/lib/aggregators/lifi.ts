import { Aggregator } from "../aggregator";
import { type QuoteDetail, QuoteError, type SwapParams } from "../types";

export type LifiConfig = {
  apiKey?: string;
};

export class LifiAggregator extends Aggregator {
  constructor(private config: LifiConfig = {}) {
    super();
  }

  name(): string {
    return "lifi";
  }

  async fetchQuote(request: SwapParams): Promise<QuoteDetail> {
    const response = await this.makeRequest(request);
    const gasEstimate = (response.estimate.gasCosts || []).reduce(
      (acc, cost) => acc + BigInt(cost.estimate),
      0n,
    );

    return {
      outputAmount: BigInt(response.estimate.toAmount),
      networkFee: gasEstimate,
      txData: {
        to: response.transactionRequest?.to as `0x${string}`,
        data: response.transactionRequest?.data as `0x${string}`,
      },
    };
  }

  private headers(): { [key: string]: string } {
    return this.config.apiKey
      ? {
          accept: "application/json",
          "x-lifi-api-key": this.config.apiKey,
        }
      : {
          accept: "application/json",
        };
  }

  private async makeRequest(query: SwapParams): Promise<LiFiStep> {
    const params = new URLSearchParams({
      fromChain: query.chainId.toString(),
      toChain: query.chainId.toString(),
      fromToken: query.inputToken,
      toToken: query.outputToken,
      fromAddress: query.swapperAccount,
      fromAmount: query.inputAmount.toString(),
      slippage: (query.slippageBps / 10000).toString(),
      // allowExchanges: exchange,
    });

    const output: LiFiStep = await fetch(`https://li.quest/v1/quote?${params.toString()}`, {
      headers: this.headers(),
    }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) {
        throw new QuoteError(`0x API request failed with status ${response.status}`, body);
      }
      return body as LiFiStep;
    });

    return output;
  }
}
