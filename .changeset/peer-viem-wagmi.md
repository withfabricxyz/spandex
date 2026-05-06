---
"@spandex/core": patch
"@spandex/react": patch
---

* Move viem, wagmi, and TanStack Query integration packages to peer dependencies so consumers provide the same client and provider packages used by their apps.
* Add relay option for api key
* Add per-swap dynamic fee resolution + preference for supporting providers