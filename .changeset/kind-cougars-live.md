---
"@spandex/core": minor
"@spandex/react": minor
---

Enable delegated prepareSimulatedQuotes action via proxy for server side simulation. Added helper method for using spanDEX edge as a proxy.

Breaking change: Users depending on newQuoteStream or decodeQuoteStream for proxy mode should replace with generic newStream<Quote> and decodeStream<Quote>.
