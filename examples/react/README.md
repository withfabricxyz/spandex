# Spandex React Example

This is a example app demonstrating how to use [Spandex](https://github.com/withfabricxyz/spandex) in a React environment.

Here we are using [TanStack Start](https://tanstack.com/start), but the core functionality can be adapted to any React setup.

## Requirements

- Node.js 24+
- RPC URLs for the desired networks that support `eth_simulatev1` (optional if you use the default public provider)
- A WalletConnect Project ID (optional if you don't need WalletConnect)

## Environment

Create an `.env` file in `examples/react` with:

```
VITE_WALLET_CONNECT_PROJECT_ID=...
VITE_BASE_RPC_URLS=...
```
Both variables are optional.

`VITE_WALLET_CONNECT_PROJECT_ID` is optional. If omitted, WalletConnect will be disabled.
`VITE_BASE_RPC_URLS` is optional and accepts a comma-separated list of HTTPS RPC endpoints. If omitted, falls back to `http()`.

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
