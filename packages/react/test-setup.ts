/** biome-ignore-all lint/suspicious/noExplicitAny: test */
import { beforeEach } from "bun:test";
import { Window } from "happy-dom";
import { queryClient } from "./test/constants.js";

const window = new Window();

globalThis.window = window as any;
globalThis.document = window.document as any;
globalThis.navigator = window.navigator as any;
globalThis.HTMLElement = window.HTMLElement as any;
globalThis.Element = window.Element as any;

beforeEach(() => {
  queryClient.clear();
});
