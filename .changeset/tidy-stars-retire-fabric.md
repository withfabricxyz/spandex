---
"@spandex/core": patch
---

Deprecate the Fabric aggregator ahead of its September 16, 2026 shutdown. Construction now logs a warning and quote requests immediately reject with a deprecation error. Remove Fabric from the default providers; use Nordstern or another active provider instead.
