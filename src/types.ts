/** Shared contracts between command parsing, round planning, rendering and UI. */
export type Tier = "miss" | "small" | "medium" | "jackpot";
export type Pattern = "quick" | "reach" | "tease" | "nudge" | "revival";
export type Intensity = "low" | "normal" | "high";
export type SelectionMode = "score" | "random";

export interface SlotSettings {
  enabled: boolean;
  intensity: Intensity;
  mode: SelectionMode;
}

/** Raw selections are validated by createRound before producing a Round. */
export interface RoundOptions {
  text?: string;
  mode?: SelectionMode;
  tier?: string;
  pattern?: string;
  message?: string | number;
  seed?: number;
  demo?: boolean;
}

export interface AnimationPlan {
  pattern: Pattern;
  stops: number[];
  resumeAt: number;
  revealAt: number;
  marqueeAt: number;
}

export interface Round {
  tier: Tier;
  mode: SelectionMode | "demo";
  score: number | null;
  criteria: string[];
  demo: boolean;
  message: string;
  messageIndex: number;
  seed?: number;
  plan: AnimationPlan;
}

export interface ResponsePanel {
  lines: string[];
  measure: (text: string) => number;
}

export interface ViewOptions {
  now?: () => number;
  live?: boolean;
  width?: number;
  formatText?: (text: string, width: number) => string[];
  measure?: (text: string) => number;
}
