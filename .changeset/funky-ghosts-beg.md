---
"@spandex/core": patch
"@spandex/react": patch
---

Fix slippage calculation for relay. If a user requested 1% slippage cap, the value sent to relay represented 1 basis point.
