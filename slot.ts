import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { stripTerminalSequences, wrapTextWithAnsi, visibleWidth } from "@earendil-works/pi-tui";
import { registerSlot } from "./src/extension.ts";

export default function slot(pi: ExtensionAPI) {
  registerSlot(pi, {
    formatText: (text, width) => wrapTextWithAnsi(stripTerminalSequences(text), width),
    measure: visibleWidth,
  });
}
