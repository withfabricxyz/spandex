# @spandex/react

## 0.6.1

### Patch Changes

- 77289d2: Fix slippage calculation for relay. If a user requested 1% slippage cap, the value sent to relay represented 1 basis point.
- Updated dependencies [77289d2]
  - @spandex/core@0.6.1

## 0.6.0

### Minor Changes

- 3d88d86: Add cross-chain swaps via relay

### Patch Changes

- Updated dependencies [3d88d86]
  - @spandex/core@0.6.0

## 0.5.0

### Minor Changes

- 83dfc4c: Enable delegated prepareSimulatedQuotes action via proxy for server side simulation. Added helper method for using spanDEX edge as a proxy.

  Breaking change: Users depending on newQuoteStream or decodeQuoteStream for proxy mode should replace with generic newStream<Quote> and decodeStream<Quote>.

### Patch Changes

- Updated dependencies [83dfc4c]
  - @spandex/core@0.5.0

## 0.4.5

### Patch Changes

- ba0b624: Align native token values with providers expected native token value. Fix bug with 0x implementation throwing when native input tokens were requested.
- Updated dependencies [ba0b624]
  - @spandex/core@0.4.5

## 0.4.4

### Patch Changes

- 4edb272: Export buildCalls from entrypoint
- Updated dependencies [4edb272]
  - @spandex/core@0.4.4

## 0.4.3

### Patch Changes

- 924e61a: Fix(velora): prevent edge case of direct fee setting when partner key is set without capture addresses
- Updated dependencies [924e61a]
  - @spandex/core@0.4.3

## 0.4.2

### Patch Changes

- 64c1bc1: Add Velora aggregator
- Updated dependencies [64c1bc1]
  - @spandex/core@0.4.2

## 0.4.1

### Patch Changes

- f4af4b1: add optional recipientAccount option for configuring a different token output address than the caller
- Updated dependencies [f4af4b1]
  - @spandex/core@0.4.1

## 0.4.0

### Minor Changes

- c5a64aa: First public beta release

### Patch Changes

- Updated dependencies [c5a64aa]
  - @spandex/core@0.4.0

## 0.3.4

### Patch Changes

- 74a8bc8: move prepareSimulatedQuotes to new file to eliminate circular refs
- Updated dependencies [74a8bc8]
  - @spandex/core@0.3.4

## 0.3.3

### Patch Changes

- 9d3eb29: chore: working through automated publishing
- Updated dependencies [9d3eb29]
  - @spandex/core@0.3.3

## 0.3.2

### Patch Changes

- 8fb17fb: enable trusted publishing
- Updated dependencies [8fb17fb]
  - @spandex/core@0.3.2

## 0.3.1

### Patch Changes

- 540d187: wiring up ci to release process
- Updated dependencies [540d187]
  - @spandex/core@0.3.1

## 0.3.0

### Minor Changes

- 506e4c2: updated documentation and added logging support for debugging DX

### Patch Changes

- Updated dependencies [506e4c2]
  - @spandex/core@0.3.0

## 0.2.0

### Minor Changes

- 59967c1: Initial release

### Patch Changes

- Updated dependencies [59967c1]
  - @spandex/core@0.2.0
