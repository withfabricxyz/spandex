# SMAL

SMAL Meta Aggregator Library

One swap library to rule them all. Query multiple DEX aggregators and find the best price without the added middleman tax.

Goals:
* Support multiple aggregators
* Expand tokens, pools, and chains beyond any single aggregator
* Provide redundancy when a provide fails
* Provide multiple quotes to find the best price

### Getting Started

Install core package and optional simulate extension to validate quoted transactions onchain

```
npm i viem @withfabric/smal @withfabric/smal-simulate
```

Simplest example:

```ts
// Import
import { buildMetaAggregator } from "@withfabric/smal";

// Configure your aggregators
const metaAggregator = buildMetaAggregator({
  providers: [
    { provider: "fabric" },
    { provider: "0x", apiKey: "..." },
  ],
  defaults: {
    strategy: "bestQuote",
  }
});

// Fetch the best quote using the configured strategy
const quote = await metaAggregator.fetchBestQuote({
  chainId: 8453,
  inputToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  outputToken: "0x4200000000000000000000000000000000000006",
  inputAmount: 500_000_000n,
  slippageBps: 100,
  swapperAccount: "0xdead00000000000000000000000000000000beef",
});

console.log(quote.summary())
```



### WIP!!!

TODO:
* Odos?
* 1inch?
* Approvals / permits
* Simulation
* Wagmi hooks


To install dependencies:

```bash
bun i
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.2.22. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
