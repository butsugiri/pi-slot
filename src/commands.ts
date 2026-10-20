import { MESSAGES } from "./round.ts";
import type { RoundOptions, SlotSettings } from "./types.ts";

export const DEMO_USAGE = "/slot-demo [miss|small|medium|jackpot|random] [quick|reach|tease|nudge|revival|random] [--message 1..5|random] [--seed 0..4294967295]";

export function parseDemoArgs(args: string): RoundOptions & { help?: boolean } {
  const tokens = args.trim().split(/\s+/).filter(Boolean);
  const options: Partial<Record<"tier" | "pattern" | "message" | "seed", string>> = {};
  const positional = [];
  const seen = new Set();
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === "--help" || token === "help") return { help: true };
    if (!token.startsWith("--")) { positional.push(token); continue; }
    const match = /^--(result|pattern|message|seed)(?:=(.+))?$/.exec(token);
    if (!match) throw new Error(`Unknown argument: ${token}`);
    const key = (match[1] === "result" ? "tier" : match[1]) as "tier" | "pattern" | "message" | "seed";
    if (seen.has(key)) throw new Error(`Duplicate argument: ${key}`);
    seen.add(key);
    const value = match[2] ?? tokens[++i];
    if (!value || value.startsWith("--")) throw new Error(`${token} requires a value.`);
    options[key] = value;
  }
  if (positional.length > 2) throw new Error("At most two positional arguments are allowed: result and pattern.");
  for (const [i, key] of (["tier", "pattern"] as const).entries()) {
    if (positional[i]) {
      if (seen.has(key)) throw new Error(`Duplicate argument: ${key}`);
      options[key] = positional[i];
    }
  }
  if (options.seed !== undefined) {
    if (!/^\d+$/.test(options.seed) || Number(options.seed) > 4294967295) throw new Error("Seed must be an integer from 0 to 4294967295.");
  }
  const { seed, ...rest } = options;
  return seed === undefined ? rest : { ...rest, seed: Number(seed) };
}

export function demoHelp() {
  return `${DEMO_USAGE}\nquick: quick stop / reach: delayed last reel / tease: slowdown / nudge: one-symbol restart / revival: comeback after blackout\n${MESSAGES.map((text, i) => `${i + 1}: ${text}`).join("\n")}\nLegacy aliases are also supported: normal=miss, chance=small.`;
}

export const SLOT_USAGE = "Usage: /slot on|off|stop, /slot mode score|random, /slot intensity low|normal|high";

type SlotCommand =
  | { kind: "status" | "stop" }
  | { kind: "enabled"; value: boolean }
  | { kind: "mode"; value: SlotSettings["mode"] }
  | { kind: "intensity"; value: SlotSettings["intensity"] };

export function parseSlotArgs(args: string): SlotCommand {
  const value = args.trim();
  if (!value) return { kind: "status" };
  if (value === "stop") return { kind: "stop" };
  if (value === "on" || value === "off") return { kind: "enabled", value: value === "on" };
  const [, selection] = value.split(" ");
  if (/^mode (score|random)$/.test(value)) return { kind: "mode", value: selection as SlotSettings["mode"] };
  if (/^intensity (low|normal|high)$/.test(value)) return { kind: "intensity", value: selection as SlotSettings["intensity"] };
  throw new Error(SLOT_USAGE);
}

export function settingsCaption(settings: SlotSettings) {
  return `Slot: ${settings.enabled ? "ON" : "OFF"} / Intensity: ${settings.intensity} / Mode: ${settings.mode}${settings.mode === "random" ? " (4 outcomes, 25% each)" : ""}`;
}
