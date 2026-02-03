import { afterEach, describe, expect, it } from "bun:test";
import { fabric } from "../aggregators/fabric.js";
import { createConfig } from "../createConfig.js";
import { log } from "./logger.js";

describe("logger", () => {
  afterEach(() => {
    createConfig({ providers: [fabric({ appId: "test-app" })] });
  });

  it("custom logger", () => {
    const entries: Array<{ level: string; args: unknown[] }> = [];
    createConfig({
      providers: [fabric({ appId: "test-app" })],
      logging: {
        level: "debug",
        fn: (level, ...args) => {
          entries.push({ level, args });
        },
      },
    });

    log("info", "info");
    log("debug", "debug");
    log("trace", "trace");

    expect(entries.map((entry) => entry.level)).toEqual(["info", "debug"]);
    expect(entries[0]?.args[0]).toBe("info");
    expect(entries[1]?.args[0]).toBe("debug");
  });

  it("uses console.log when no logger fn is provided", () => {
    const original = console.log;
    const calls: unknown[][] = [];
    console.log = (...args: unknown[]) => {
      calls.push(args);
      original.apply(console, args);
    };

    try {
      createConfig({
        providers: [fabric({ appId: "test-app" })],
        logging: {
          level: "info",
        },
      });

      log("info", "hello", 123);
      log("debug", "hello", { x: 2 });
    } finally {
      console.log = original;
    }

    expect(calls.length).toBe(1);
    expect(calls[0]?.[0]).toBe("[spandex][info] -");
    expect(calls[0]?.[1]).toBe("hello");
    expect(calls[0]?.[2]).toBe(123);
  });
});
