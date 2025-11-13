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

Example:

```ts
// Import
import { buildMetaAggregator } from "@withfabric/smal";

// Configure your aggregators
const metaAggregator = buildMetaAggregator({
  aggregators: [
    { provider: "fabric", config: {} },
    { provider: "0x", config: { apiKey: "..." }},
  ],
  defaults: {
    strategy: "quotedPrice",
  }
});

const swapParams = {
  chainId: 8453,
  inputToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  outputToken: "0x4200000000000000000000000000000000000006",
  inputAmount: 500_000_000n,
  slippageBps: 100,
  swapperAccount: "0xdead00000000000000000000000000000000beef",
};

// Fetch the best quote using the configured strategy
const quote = await metaAggregator.fetchBestQuote(swapParams);

console.log(quote.summary())
```

Using simulation to verify the quote and get onchain pricing

```ts
import { simulateWith } from "@withfabric/smal-simulate";
const aggregator = buildMetaAggregator({ //... });
const quotes = await aggregator.fetchAllQuotes(swapParams)
const simulated = await simulateQuotes({ client, swapParams, quotes });


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
