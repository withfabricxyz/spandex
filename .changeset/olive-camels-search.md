---
"@spandex/react": patch
---

Fix `SpandexProvider` handing core a bare wagmi `Client` cast as `PublicClient`. Clients are now extended with viem `publicActions`, so core code paths that call client methods directly (e.g. the allowance check in `buildCalls` during quote execution) work instead of throwing `client.<method> is not a function`.
