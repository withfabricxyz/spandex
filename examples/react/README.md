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

```bash
npm run build
```

## TODO

[] fonts are in s3 - establish a way to make sure they aren't used outside of our hosted version of this app
