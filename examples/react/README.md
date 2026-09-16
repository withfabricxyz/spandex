# Spandex React Example

This is a example app demonstrating how to use [Spandex](https://github.com/withfabricxyz/spandex) in a React environment.

Here we are using [TanStack Start](https://tanstack.com/start), but the core functionality can be adapted to any React setup.

## Requirements

- Node.js 24+
- A dRPC API key for server-side quote simulation (optional if you use public dRPC)
- A WalletConnect Project ID (optional if you don't need WalletConnect)

## Environment

Create an `.env` file in `examples/react` with:

```
VITE_WALLET_CONNECT_PROJECT_ID=...
DRPC_API_KEY=...
MOBULA_API_KEY=...
FYND_API_KEY=...
```
All variables are optional.

`VITE_WALLET_CONNECT_PROJECT_ID` is optional. If omitted, WalletConnect will be disabled.
`DRPC_API_KEY` is used only on the server for quote simulation. If omitted, the server uses public dRPC. Browser RPC calls always use public dRPC; the key is never exposed to the client. No other RPC providers are used.
`MOBULA_API_KEY` enables the Mobula provider on the server-side quote proxy route.
`FYND_API_KEY` enables the hosted Fynd provider on the server-side quote proxy route.

All `VITE_*` variables are public and readable from the client, so do not include any secrets.

## Run locally

```bash
npm install
npm run dev
```

## Build

Build the workspace packages from the repository root first:

```bash
bun run build
bun run --cwd examples/react build
```

For a local production server, run `bun run start` from `examples/react` after building. This starts Nitro's generated server in `.output/server/index.mjs`.

## Deploy to Vercel

The Nitro Vite plugin packages the app's SSR handler and quote API routes as Vercel Functions. `vercel.json` selects the TanStack Start framework. Vercel runs the generated function; it does not run the `start` script or the standalone `server.ts` launcher.

Configure the Vercel project with:

- Root Directory: `examples/react`, with source files outside the root directory included in the build.
- Framework Preset: TanStack Start.
- Build Command: keep the command that builds the workspace packages before the example, e.g. `bun ../../scripts/build-packages.ts core react && bun run build`.
- Output Directory: leave the override disabled so Nitro's `.vercel/output` is used.
- Environment Variables: set `DRPC_API_KEY` and any optional provider keys described above.

Install dependencies using the repository root's `bun.lock`. Nitro detects Vercel automatically. To check the deployment output locally, run `NITRO_PRESET=vercel bun run build` from `examples/react`; this produces `.vercel/output` instead of the local `.output` server.

## TODO

[] fonts are in s3 - establish a way to make sure they aren't used outside of our hosted version of this app
