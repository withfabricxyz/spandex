import { describe, expect, it } from "bun:test";
import { fail } from "node:assert";
import { createServer } from "node:net";
import { afterEach } from "node:test";
import { Instance, Server } from "prool";
import { createPublicClient, createWalletClient, erc20Abi, http, type PublicClient } from "viem";
import { base } from "viem/chains";
import { recordedSimulation } from "../test/utils.js";
import type { FabricQuoteResponse } from "./aggregators/fabric.js";
import { fabric } from "./aggregators/fabric.js";
import { createConfig } from "./createConfig.js";
import { executeQuote } from "./executeQuote.js";
import type { SwapParams } from "./types.js";

const ANKR_API_KEY = process.env.ANKR_API_KEY || "";

const swap: SwapParams = {
  chainId: 8453,
  inputToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  outputToken: "0x4200000000000000000000000000000000000006",
  inputAmount: 500_000_000n,
  slippageBps: 1000,
  swapperAccount: "0xEe7aE85f2Fe2239E27D9c1E23fFFe168D63b4055",
  mode: "exactIn",
};

let server: Server.CreateServerReturnType | null = null;
let forkRpcUrl = "";

/**
 * Asks the OS for an unused port so parallel or leftover anvil processes on a
 * fixed port cannot make the suite fail.
 */
function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address ? address.port : undefined;
      probe.close(() => (port ? resolve(port) : reject(new Error("Could not allocate a port"))));
    });
  });
}

async function createFork(forkBlockNumber: bigint) {
  const port = await getFreePort();
  forkRpcUrl = `http://127.0.0.1:${port}/1`;
  server = Server.create({
    instance: Instance.anvil({
      forkUrl: `https://rpc.ankr.com/base/${ANKR_API_KEY}`,
      forkBlockNumber,
      autoImpersonate: true,
    }),
    host: "127.0.0.1",
    port,
    limit: 1,
  });
  await server.start();
  return server;
}

const baseClient = createPublicClient({
  chain: base,
  transport: http(`https://rpc.ankr.com/base/${ANKR_API_KEY}`),
}) as PublicClient;

function forkClient(): PublicClient {
  return createPublicClient({
    chain: base,
    transport: http(forkRpcUrl),
  }) as PublicClient;
}

describe("executeQuote", () => {
  afterEach(async () => {
    if (server) {
      await server.stop();
      server = null;
    }
  });

  it("forks correctly", async () => {
    await createFork(41166265n);
    const forkBlockNumber = await forkClient().getBlockNumber();
    expect(forkBlockNumber).toEqual(41166265n);
  });

  it("can execute a quote on a forked chain", async () => {
    const config = createConfig({
      providers: [fabric({ appId: "test" })],
      clients: [baseClient] as PublicClient[],
    });

    const quote = await recordedSimulation("executeQuote/fabricBaseSwap", swap, config);

    if (!quote?.success || !quote?.simulation.success)
      throw new Error("Quote or simulation failed");

    await createFork(BigInt((quote.details as FabricQuoteResponse).blockNumber));
    const publicClient = forkClient();

    const walletClient = createWalletClient({
      account: swap.swapperAccount,
      chain: base,
      transport: http(forkRpcUrl),
    });

    const beforeBalance = await publicClient.readContract({
      address: swap.outputToken,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [swap.swapperAccount],
    });

    const hash = await executeQuote({
      quote,
      swap,
      walletClient: walletClient,
      publicClient,
      config,
    }).catch((error) => {
      console.log(error);
      fail("Execution failed");
    });

    const afterBalance = await publicClient.readContract({
      address: swap.outputToken,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [swap.swapperAccount],
    });

    const delta = Number(afterBalance - beforeBalance);
    expect(hash).not.toBeNull();
    expect(afterBalance).toBeGreaterThan(beforeBalance);
    expect(Number(quote.outputAmount)).toBeWithin(delta * 0.95, delta * 1.05);
    // Check balance
  }, 20000);
});
