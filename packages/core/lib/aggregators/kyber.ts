import { Aggregator } from "../aggregator";
import { type QuoteDetail, QuoteError, type SwapParams } from "../types";

const chainNameLookup: Record<number, string> = {
  8453: "base", // Base Mainnet
  1: "ethereum", // Ethereum Mainnet
  56: "bsc", // BNB Chain Mainnet
  137: "polygon", // Polygon Mainnet
  10: "optimism", // Optimism Mainnet
  42161: "arbitrum", // Arbitrum One
  43114: "avalanche", // Avalanche C-Chain
  324: "zksync", // zkSync Era Mainnet
  250: "fantom", // Fantom Opera
  59144: "linea", // Linea Mainnet
  534352: "scroll", // Scroll Mainnet
  5000: "mantle", // Mantle Mainnet
  81457: "blast", // Blast Mainnet
  146: "sonic", // Sonic Mainnet
  80094: "berachain", // Berachain Mainnet
  2020: "ronin", // Ronin Mainnet
  999: "hyperevm", // HyperEVM Mainnet
};

export type KyberConfig = {
  clientId: string;
};

export class KyberAggregator extends Aggregator {
  constructor(
    private config: KyberConfig = { clientId: "swap-quoter" },
  ) {
    super();
  }

  name(): string {
    return "kyberswap";
  }

  async fetchQuote(request: SwapParams): Promise<QuoteDetail> {
    const response = await this.getRoute(request);
    const networkFee = BigInt(response.totalGas) * BigInt(Math.round(Number(response.gasPriceGwei) * (10 ** 9)));
    return {
      outputAmount: BigInt(response.outputAmount),
      networkFee,
      txData: {
        to: response.routerAddress,
        data: response.encodedSwapData,
      },
      // details: toJson(response),
    };
  }

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  private async getRoute(query: SwapParams): Promise<any> {
    const chain = chainNameLookup[query.chainId];
    const params = new URLSearchParams({
      tokenOut: query.outputToken,
      tokenIn: query.inputToken,
      amountIn: query.inputAmount.toString(),
      slippageTolerance: query.slippageBps.toString(),
      to: query.swapperAccount,
    });

    const output = await fetch(
      `https://aggregator-api.kyberswap.com/${chain}/route/encode?${params.toString()}`,
      {
        headers: {
          accept: "application/json",
          "X-Client-Id": this.config.clientId || "swap-quoter",
        },
      },
    ).then(async (response) => {
      const body = await response.json();
      if (!response.ok) {
        throw new QuoteError(`Kyber API request failed with status ${response.status}`, body);
      }
      return body;
    });

    return output;
  }
}
