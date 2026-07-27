---
"@spandex/core": patch
---

Deprecate the Odos provider. Constructing it now warns, and quoting returns an immediate failed
quote without retries or network requests. Remove Odos from the default provider set.
