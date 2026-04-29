# @spandex/core

## 0.7.1

### Patch Changes

- 3953c37: Add nordstern finance aggregator to provider set

## 0.7.0

### Minor Changes

- 5476217: Give users more control around selection without having to write custom functions, which can result in better UX.

## 0.6.2

### Patch Changes

- f638189: Various changes...
  - Add approval gas estimate to simulation bundle
  - Set gasLimit in buildCalls using estimates with padding
  - Rev deps (dependabot)
  - Add optional user attributes to providers for quote tagging
  - Fix api key setting for fabric
  - Fix ClientType export

## 0.6.1

### Patch Changes

- 77289d2: Fix slippage calculation for relay. If a user requested 1% slippage cap, the value sent to relay represented 1 basis point.

## 0.6.0

### Minor Changes

- 3d88d86: Add cross-chain swaps via relay

## 0.5.0

### Minor Changes

- 83dfc4c: Enable delegated prepareSimulatedQuotes action via proxy for server side simulation. Added helper method for using spanDEX edge as a proxy.

  Breaking change: Users depending on newQuoteStream or decodeQuoteStream for proxy mode should replace with generic newStream<Quote> and decodeStream<Quote>.

## 0.4.5

### Patch Changes

- ba0b624: Align native token values with providers expected native token value. Fix bug with 0x implementation throwing when native input tokens were requested.

## 0.4.4

### Patch Changes

- 4edb272: Export buildCalls from entrypoint

## 0.4.3

### Patch Changes

- 924e61a: Fix(velora): prevent edge case of direct fee setting when partner key is set without capture addresses

## 0.4.2

### Patch Changes

- 64c1bc1: Add Velora aggregator

## 0.4.1

### Patch Changes

- f4af4b1: add optional recipientAccount option for configuring a different token output address than the caller

## 0.4.0

### Minor Changes

- c5a64aa: First public beta release

## 0.3.4

### Patch Changes

- 74a8bc8: move prepareSimulatedQuotes to new file to eliminate circular refs

## 0.3.3

### Patch Changes

- 9d3eb29: chore: working through automated publishing

## 0.3.2

### Patch Changes

- 8fb17fb: enable trusted publishing

## 0.3.1

### Patch Changes

- 540d187: wiring up ci to release process

## 0.3.0

### Minor Changes

- 506e4c2: updated documentation and added logging support for debugging DX

## 0.2.0

### Minor Changes

- 59967c1: Initial release
