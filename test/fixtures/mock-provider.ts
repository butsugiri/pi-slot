import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import { DEMO_PRAISE } from "../../src/demo.ts";

// Local-only streaming fixture: no network, credentials, or paid model calls.
export default function mock(pi: ExtensionAPI) {
  pi.registerProvider("slot-test", {
    baseUrl: "http://127.0.0.1/unused",
    api: "slot-test-stream",
    apiKey: "local-test-only",
    models: [{
      id: "stream", name: "Slot local streaming test", reasoning: false,
      input: ["text"], contextWindow: 32000, maxTokens: 1000,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    }],
    streamSimple(model, _context, options) {
      const stream = createAssistantMessageEventStream();
      const output = {
        role: "assistant" as const, content: [{ type: "text" as const, text: "" }],
        api: model.api, provider: model.provider, model: model.id,
        usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
        stopReason: "pending" as "pending" | "stop" | "aborted", timestamp: Date.now(),
      };
      void (async () => {
        stream.push({ type: "start", partial: output });
        stream.push({ type: "text_start", contentIndex: 0, partial: output });
        for (const delta of DEMO_PRAISE.match(/[^.!?]+[.!?]\s*/g) ?? [DEMO_PRAISE]) {
          await new Promise((resolve) => setTimeout(resolve, 650));
          if (options?.signal?.aborted) {
            output.stopReason = "aborted";
            stream.push({ type: "error", reason: "aborted", error: output });
            stream.end();
            return;
          }
          output.content[0].text += delta;
          stream.push({ type: "text_delta", contentIndex: 0, delta, partial: output });
        }
        stream.push({ type: "text_end", contentIndex: 0, content: output.content[0].text, partial: output });
        output.stopReason = "stop";
        stream.push({ type: "done", reason: "stop", message: output });
        stream.end();
      })();
      return stream;
    },
  });
}
