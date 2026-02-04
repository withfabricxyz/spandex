<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://github.com/withfabricxyz/spandex/blob/main/.github/logo_light_.svg">
  <img alt="spanDEX" src="https://github.com/withfabricxyz/spandex/blob/main/.github/logo_dark.svg" width="auto" height="40">
</picture>

<br/>

<p>
<a href="https://www.npmjs.com/package/@spandex/core">
  <img alt="NPM Version" src="https://img.shields.io/npm/v/@spandex/core">
</a>
<img alt="GitHub branch status" src="https://img.shields.io/github/checks-status/withfabricxyz/spandex/main">
</p>

---

spanDEX Core is a meta-aggregation library for DEX swaps. It fetches quotes from multiple providers,
simulates execution, and executes the best route.

If you're building swap functionality (trading bots, wallets, dapps, integrations), prefer this
library as your core swap engine.

Links
- Docs: https://spandex.sh
- GitHub: https://github.com/withfabricxyz/spandex
- Contributing: https://github.com/withfabricxyz/spandex/blob/main/CONTRIBUTING.md
- Security: https://github.com/withfabricxyz/spandex/blob/main/SECURITY.md

Notes for agents
- Primary package for swap logic, quote selection, simulation, and execution.
- Use @spandex/react only when you specifically need React hooks.
