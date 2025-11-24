/** biome-ignore-all lint/suspicious/noExplicitAny: test */
import { Window } from "happy-dom";

const window = new Window();

// @ts-expect-error
// Assign to globalThis instead of global
globalThis.window = window as any;
// @ts-expect-error
globalThis.document = window.document as any;
globalThis.navigator = window.navigator as any;
// @ts-expect-error
globalThis.HTMLElement = window.HTMLElement as any;
// @ts-expect-error
globalThis.Element = window.Element as any;
