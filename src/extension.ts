import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { SlotSettings, ViewOptions } from "./types.ts";
import { createRound, demoResult } from "./round.ts";
import { parseDemoArgs, DEMO_USAGE, demoHelp, parseSlotArgs, SLOT_USAGE, settingsCaption } from "./commands.ts";
import { SlotController } from "./controller.ts";

export function registerSlot(pi: ExtensionAPI, formatting: Pick<ViewOptions, "formatText" | "measure"> = {}) {
  const settings: SlotSettings = { enabled: true, intensity: "high", mode: "score" };
  const controller = new SlotController(formatting);

  pi.on("input", (event, ctx) => {
    if (settings.enabled && event.source === "interactive" && event.text.trim()) {
      controller.show(ctx, createRound({ text: event.text, mode: settings.mode }), settings.intensity, true);
    }
    return { action: "continue" };
  });
  pi.on("session_shutdown", () => controller.stop());
  pi.on("agent_start", () => { controller.start(); });
  pi.on("message_update", (event) => {
    if (event.message.role !== "assistant") return;
    const text = event.message.content.filter((part) => part.type === "text").map((part) => part.text).join("\n");
    controller.updateText(text);
  });
  pi.on("message_end", (event) => {
    if (event.message.role !== "assistant") return;
    const text = event.message.content.filter((part) => part.type === "text").map((part) => part.text).join("\n");
    controller.updateText(text || event.message.errorMessage || "");
  });
  pi.on("agent_settled", (event) => { controller.finish(event.aborted); });

  pi.registerCommand("slot-demo", {
    description: "Try a specific animation. Use /slot-demo --help to list arguments.",
    handler: async (args, ctx) => {
      let options: ReturnType<typeof parseDemoArgs>;
      try { options = parseDemoArgs(args); }
      catch (error) {
        ctx.ui.notify(`${(error as Error).message}\n${DEMO_USAGE}`, "warning");
        return;
      }
      if (options.help) {
        ctx.ui.notify(demoHelp(), "info");
        return;
      }
      if (ctx.mode !== "tui") {
        ctx.ui.notify("Slot animations are available in interactive mode.", "info");
        return;
      }
      try { controller.show(ctx, demoResult(options.tier ?? "jackpot", options), settings.intensity); }
      catch (error) { ctx.ui.notify(`${(error as Error).message}\n${DEMO_USAGE}`, "warning"); }
    },
  });
  pi.registerCommand("slot", {
    description: "Animation settings: /slot [on|off|stop|mode score|random|intensity low|normal|high]",
    handler: async (args, ctx) => {
      let command: ReturnType<typeof parseSlotArgs>;
      try { command = parseSlotArgs(args); }
      catch { ctx.ui.notify(SLOT_USAGE, "info"); return; }
      if (command.kind === "enabled") {
        settings.enabled = command.value;
        if (!command.value) controller.stop();
      } else if (command.kind === "mode") {
        settings.mode = command.value;
        controller.stop();
      } else if (command.kind === "intensity") {
        settings.intensity = command.value;
        controller.stop();
      } else if (command.kind === "stop") controller.stop();
      ctx.ui.notify(settingsCaption(settings), "info");
    },
  });
}
