/** biome-ignore-all lint/suspicious/noExplicitAny: test */
import { beforeEach } from "bun:test";
import { Window } from "happy-dom";
import { queryClient } from "./test/constants.js";

const window = new Window();

// @ts-expect-error
globalThis.window = window as any;
// @ts-expect-error
globalThis.document = window.document as any;
globalThis.navigator = window.navigator as any;
// @ts-expect-error
globalThis.HTMLElement = window.HTMLElement as any;
// @ts-expect-error
globalThis.Element = window.Element as any;

beforeEach(() => {
  queryClient.clear();
});
