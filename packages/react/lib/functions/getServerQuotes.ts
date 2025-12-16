"use server";

import { type Config, getQuotes, type SwapParams } from "@withfabric/spandex";
import { bigintReplacer } from "lib/util/index.js";

let globalSpandex: Config | null = null;
export function configureSpandexServer(config: Config) {
  globalSpandex = config;
}

export async function getServerQuotes({ swap }: { swap: SwapParams }): Promise<string> {
  if (!globalSpandex) {
    throw new Error("Spandex not configured on server. Please call configureSpandexServer first.");
  }

  const quotes = await getQuotes({
    swap,
    config: globalSpandex,
  });

  return JSON.stringify(quotes, bigintReplacer, 2);
}
