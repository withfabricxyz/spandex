import { Aggregator } from "../aggregator";
import { type QuoteDetail, QuoteError, type SwapParams, type Address } from "../types";

const FABRIC_BASE_URL = process.env.FABRIC_BASE_URL || "http://booda.defi.withfabric.xyz";

type Step = {
  pool: string;
  token_in: Address;
  token_out: Address;
  amount_in: string;
  amount_out: string;
};

type Route = {
  steps: Step[];
};

type FabQuoteResponse = {
  routes: Route[];
  calldata: string;
};

export type FabricConfig = {
  url?: string;
};

export class FabricAggregator extends Aggregator {
  constructor(
    private config: FabricConfig = { url: FABRIC_BASE_URL },
  ) {
    super();
  }

  name(): string {
    return "fabric";
  }

  async fetchQuote(request: SwapParams): Promise<QuoteDetail> {
    const response = await this.makeRequest(request);
    const outputRoute = response.routes[response.routes.length - 1] as any; // TODO: FIX!
    const amountOut = outputRoute.steps[outputRoute.steps.length - 1].amount_out;
    const to = "0xaf79c73c73a5411f372864b50f56eeedf8a29aab"; // Temporary until deployed
    return {
      outputAmount: BigInt(amountOut),
      networkFee: 0n, // TODO
      txData: {
        to, // TODO
        data: response.calldata as `0x${string}`,
      },
      // details: toJson(response),
    };
  }

  private async makeRequest(params: SwapParams): Promise<FabQuoteResponse> {
    const query = new URLSearchParams({
      buy_token: params.outputToken,
      sell_token: params.inputToken,
      max_hops: "2",
      sell_amount: params.inputAmount.toString(),
      max_slippage_bps: params.slippageBps.toString(),
      top_k: "2",
    });

    return await fetch(`${this.config.url}/quote?${query.toString()}`, {
      headers: {
        accept: "application/json",
      },
    }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) {
        throw new QuoteError(`Fabric API request failed with status ${response.status}`, body);
      }
      return body as FabQuoteResponse;
    });
  }
}
