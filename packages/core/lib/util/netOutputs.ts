import type { Address } from "viem";
import type { SuccessfulSimulatedQuote, SwapParams, TransferData } from "../types.js";

export type Allocations = {
  swapper: Map<Address, bigint>;
  protocols: Map<Address, Map<Address, bigint>>;
};

function outputTransfers({
  transfers,
  router,
  swapper,
}: {
  transfers: TransferData[];
  router: Address;
  swapper: Address;
}): TransferData[] {
  const inbound = transfers.filter((t) => t.to.toLowerCase() === router.toLowerCase());
  const outbound = transfers.filter((t) => t.from.toLowerCase() === router.toLowerCase());

  return outbound.filter((out) => {
    const matchInbound = inbound.find(
      (inb) => inb.from.toLowerCase() === out.to.toLowerCase() && inb.from !== swapper,
    );
    return !matchInbound;
  });
}

export function netOutputs({
  quote,
  swap,
}: {
  swap: SwapParams;
  quote: SuccessfulSimulatedQuote;
}): Allocations {
  const swapper = new Map<Address, bigint>();
  const protocols = new Map<Address, Map<Address, bigint>>();

  const router = quote.txData.to.toLowerCase() as Address;
  const swapperAccount = swap.swapperAccount.toLowerCase() as Address;
  const inputToken = swap.inputToken.toLowerCase() as Address;
  const outputToken = swap.outputToken.toLowerCase() as Address;

  const addAmount = (map: Map<Address, bigint>, token: Address, value: bigint) => {
    map.set(token, (map.get(token) ?? 0n) + value);
  };

  const addProtocolAmount = (address: Address, token: Address, value: bigint) => {
    let tokenMap = protocols.get(address);
    if (!tokenMap) {
      tokenMap = new Map<Address, bigint>();
      protocols.set(address, tokenMap);
    }
    addAmount(tokenMap, token, value);
  };

  const outputs = outputTransfers({
    transfers: quote.simulation.transfers,
    router: quote.txData.to,
    swapper: swap.swapperAccount,
  });

  for (const transfer of outputs) {
    const token = transfer.token.toLowerCase() as Address;
    const recipient = transfer.to.toLowerCase() as Address;
    if (recipient === swapperAccount) {
      addAmount(swapper, token, transfer.value);
    } else {
      addProtocolAmount(recipient, token, transfer.value);
    }
  }

  const addRouterRetention = (token: Address) => {
    let net = 0n;
    for (const transfer of quote.simulation.transfers) {
      if (transfer.token.toLowerCase() !== token) {
        continue;
      }
      const from = transfer.from.toLowerCase();
      const to = transfer.to.toLowerCase();
      if (to === router) {
        net += transfer.value;
      }
      if (from === router) {
        net -= transfer.value;
      }
    }
    if (net > 0n) {
      addProtocolAmount(router, token, net);
    }
  };

  addRouterRetention(inputToken);
  if (outputToken !== inputToken) {
    addRouterRetention(outputToken);
  }

  return { swapper, protocols };
}
