import { ZeroXAggregator, zeroX } from "./lib/aggregators/0x.js";
import { FabricAggregator, fabric } from "./lib/aggregators/fabric.js";
import { KyberAggregator, kyberswap } from "./lib/aggregators/kyber.js";
import { LifiAggregator, lifi } from "./lib/aggregators/lifi.js";
import { OdosAggregator, odos } from "./lib/aggregators/odos.js";
import { RelayAggregator, relay } from "./lib/aggregators/relay.js";

export {
  FabricAggregator,
  ZeroXAggregator,
  KyberAggregator,
  LifiAggregator,
  OdosAggregator,
  RelayAggregator,
  fabric,
  zeroX,
  kyberswap,
  lifi,
  odos,
  relay,
};
export { Aggregator } from "./lib/aggregators/index.js";
export { type Config, createConfig, defaultProviders } from "./lib/createConfig.js";
export { ExecutionError, executeQuote } from "./lib/executeQuote.js";
export { getPricing } from "./lib/getPricing.js";
export { getQuote } from "./lib/getQuote.js";
export { getQuotes } from "./lib/getQuotes.js";
export { getRawQuotes } from "./lib/getRawQuotes.js";
export { prepareQuotes } from "./lib/prepareQuotes.js";
export { selectQuote } from "./lib/selectQuote.js";
export { SimulationRevertError, simulateQuote, simulateQuotes } from "./lib/simulateQuote.js";
export type * from "./lib/types.js";
export { sortQuotesByPerformance } from "./lib/util/performance.js";
export { AggregatorProxy, proxy } from "./lib/wire/proxy.js";
export { deserializeWithBigInt, serializeWithBigInt } from "./lib/wire/serde.js";
export { decodeQuoteStream, newQuoteStream } from "./lib/wire/streams.js";
