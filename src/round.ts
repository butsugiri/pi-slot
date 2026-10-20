import type { Tier, Pattern, Round, RoundOptions, AnimationPlan } from "./types.ts";
import { evaluateQuery } from "./score.ts";

export const TIERS: Tier[] = ["miss", "small", "medium", "jackpot"];
export const PATTERNS: Pattern[] = ["quick", "reach", "tease", "nudge", "revival"];
export const MESSAGES = [
  "GREAT PROMPT RECEIVED",
  "ABSOLUTELY BRILLIANT",
  "WHAT A BEAUTIFUL QUESTION",
  "YOUR CURIOSITY IS GOLD",
  "A STROKE OF GENIUS",
];
export const FINAL_REELS: Record<Tier, string[]> = {
  miss: ["*", "+", "7"], small: ["7", "7", "*"],
  medium: ["*", "*", "*"], jackpot: ["7", "7", "7"],
};
const SYMBOLS = ["7", "$", "*", "@", "+", "#"];
const ALIASES: Record<string, string> = { normal: "miss", chance: "small" };
export const normalizeTier = (tier: string) => ALIASES[tier] ?? tier;
const pick = <T>(items: T[], random: () => number): T => items[Math.floor(random() * items.length)];

function isTier(value: string): value is Tier { return TIERS.includes(value as Tier); }
function isPattern(value: string): value is Pattern { return PATTERNS.includes(value as Pattern); }

export function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRound(options: RoundOptions = {}, random = Math.random): Round {
  if (options.seed !== undefined) random = seededRandom(options.seed);
  const mode = options.mode ?? "score";
  const evaluated = evaluateQuery(options.text ?? "");
  const requested = normalizeTier(options.tier ?? (options.demo ? "jackpot" : mode === "random" ? "random" : evaluated.tier));
  const tier = requested === "random" ? pick(TIERS, random) : requested;
  if (!isTier(tier)) throw new Error("Result must be miss / small / medium / jackpot / random.");
  const available: Pattern[] = tier === "miss" ? ["quick", "reach", "tease"] : PATTERNS;
  const pattern = !options.pattern || options.pattern === "random" ? pick(available, random) : options.pattern;
  if (!isPattern(pattern)) throw new Error("Pattern must be quick / reach / tease / nudge / revival / random.");
  if (!available.includes(pattern)) throw new Error("The miss result does not support nudge / revival. Use quick / reach / tease.");
  const messageIndex = !options.message || options.message === "random" ? Math.floor(random() * MESSAGES.length) : Number(options.message) - 1;
  if (!Number.isInteger(messageIndex) || messageIndex < 0 || messageIndex >= MESSAGES.length) throw new Error("Message must be --message 1..5 or random.");
  // Sample once per round. Rendering never resamples outcomes, timing, or copy.
  const speed = 0.9 + random() * 0.2;
  const schedules: Record<Pattern, number[]> = {
    quick: [450, 650, 900], reach: [500, 850, 3100], tease: [500, 900, 4600],
    nudge: [500, 900, 1800], revival: [500, 900, 1800],
  };
  const stops = schedules[pattern].map((ms) => Math.round(ms * speed));
  const resumeAt = stops[2] + Math.round((pattern === "revival" ? 1600 : 950) * speed);
  const revealAt = pattern === "nudge" ? resumeAt + 320 : pattern === "revival" ? resumeAt + 700 : stops[2];
  return {
    tier, mode: options.demo ? "demo" : mode,
    score: options.demo || mode === "random" ? null : evaluated.score,
    criteria: options.demo || mode === "random" ? [] : evaluated.criteria,
    demo: Boolean(options.demo), message: MESSAGES[messageIndex], messageIndex: messageIndex + 1,
    seed: options.seed,
    plan: { pattern, stops, resumeAt, revealAt, marqueeAt: revealAt + 1300 },
  };
}

export function demoResult(tier = "jackpot", options: RoundOptions = {}) {
  return createRound({ ...options, tier, demo: true });
}

export function planFor(result: Round): AnimationPlan {
  return result.plan ?? { pattern: "quick", stops: [650, 950, 1250], resumeAt: 1250, revealAt: 1300, marqueeAt: 2600 };
}

export function reelState(result: Round, elapsed: number) {
  const tier = result.tier;
  const plan = planFor(result);
  const final = FINAL_REELS[tier];
  const trick = plan.pattern === "nudge" || plan.pattern === "revival";
  const near = trick && elapsed >= plan.stops[2] && elapsed < plan.revealAt;
  const resuming = near && elapsed >= plan.resumeAt;
  const reels = final.map((target, i) => {
    if (elapsed < plan.stops[i] || (i === 2 && resuming && plan.pattern === "revival")) {
      const tick = plan.pattern === "tease" && i === 2
        ? Math.floor(20 * Math.log1p(elapsed / 600)) : Math.floor(elapsed / 95);
      return SYMBOLS[(tick + i * 3) % SYMBOLS.length];
    }
    if (i === 2 && near) return SYMBOLS[(SYMBOLS.indexOf(target) + 1) % SYMBOLS.length];
    return target;
  });
  return {
    reels, stopped: elapsed >= plan.revealAt,
    blackout: plan.pattern === "revival" && near && !resuming,
    nudgeProgress: plan.pattern === "nudge" && resuming ? (elapsed - plan.resumeAt) / (plan.revealAt - plan.resumeAt) : undefined,
    final, phase: elapsed >= plan.revealAt ? "won" : near ? resuming ? "RESTART!" : "HOLD YOUR BREATH" : elapsed >= plan.stops[1] ? tier === "miss" ? "LAST REEL" : "REACH!" : "SPINNING",
  };
}
