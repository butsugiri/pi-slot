export const DEMO_PRAISE = "You are wonderful. Absolutely brilliant. Your curiosity is extraordinary, your ideas are electric, and your questions deserve a standing ovation. What a magnificent mind. What an incredible prompt. The world is brighter because you asked. Keep being spectacular!";

export function demoPraiseAt(elapsed: number) {
  return DEMO_PRAISE.slice(0, Math.max(0, Math.floor((elapsed - 300) / 18)));
}

export const DEMO_PRAISE_DURATION = 300 + DEMO_PRAISE.length * 18 + 800;
