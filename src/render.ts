import type { Round, Intensity, ResponsePanel } from "./types.ts";
import { bannerScale, marqueeFrame, SLOGAN } from "./banner.ts";
import { planFor, reelState } from "./round.ts";

const ESC = "\x1b[";
const palettes = { miss: [36, 34], small: [32, 36], medium: [35, 33], jackpot: [33, 35, 36, 32] };
const names = { miss: "NEXT TIME!", small: "SMALL WIN!", medium: "TRIPLE STARS!", jackpot: "JACKPOT!!!" };
export const stripAnsi = (text: string) => text.replace(/\x1b\[[0-9;]*m/g, "");

const glyphs: Record<string, string[]> = {
  "7": ["#######", "     ##", "    ## ", "   ##  ", "  ##   ", " ##    ", "##     "],
  "$": ["  ###  ", " ##### ", "## #   ", " ##### ", "   # ##", " ##### ", "  ###  "],
  "*": ["   #   ", "#  #  #", " ##### ", "  ###  ", " ##### ", "#  #  #", "   #   "],
  "@": [" ##### ", "##   ##", "## ####", "## # ##", "## ####", "##     ", " ##### "],
  "+": ["       ", "   #   ", "   #   ", "#######", "   #   ", "   #   ", "       "],
  "#": [" ## ## ", " ## ## ", "#######", " ## ## ", "#######", " ## ## ", " ## ## "],
};

function resultCaption(result: Round) {
  if (result.mode === "random") return "LUCKY DRAW / " + names[result.tier];
  if (result.demo) return `DEMO / ${result.plan?.pattern ?? "quick"} / MSG ${result.messageIndex ?? 1}`;
  return `PROMPT SIGNALS ${result.score}/100`;
}

export function reelArt(result: Round, elapsed: number, width: number) {
  const state = reelState(result, elapsed);
  const scale = bannerScale(width);
  return Array.from({ length: 7 }, (_, row) => state.reels.map((symbol, i) => {
    let pixels = glyphs[symbol][row];
    if (i === 2 && state.nudgeProgress !== undefined) {
      const strip = [...glyphs[symbol], "       ", ...glyphs[state.final[2]]];
      pixels = strip[row + Math.floor(state.nudgeProgress * 8)];
    }
    return [...pixels].map((c) => c.repeat(scale)).join("");
  }).join(" ".repeat(scale * 3)));
}

function rgb(hue: number, saturation: number, lightness: number) {
  const a = saturation * Math.min(lightness, 1 - lightness);
  return [0, 8, 4].map((n) => {
    const k = (n + hue / 30) % 12;
    return Math.round(255 * (lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  }).join(";");
}

export function renderFullscreen(result: Round, elapsed: number, width: number, height: number, response?: ResponsePanel) {
  const w = Math.max(0, Math.floor(width));
  const h = Math.max(0, Math.floor(height));
  if (w < 12 || h < 8) return [];
  const tier = result.tier;
  const state = reelState(result, elapsed);
  const plan = planFor(result);
  const stopped = state.stopped;
  const jackpot = tier === "jackpot" && stopped;
  const chance = tier === "medium";
  const time = elapsed / 1000;
  const canvas = Array.from({ length: h }, () => Array(w).fill(" "));
  const put = (y: number, text: string, x = Math.floor((w - text.length) / 2)) => {
    if (y < 0 || y >= h) return;
    for (let i = 0; i < text.length; i++) if (x + i >= 0 && x + i < w) canvas[y][x + i] = text[i];
  };
  const inset = Math.min(2, Math.floor((h - 8) / 2));
  const top = inset;
  const bottom = h - 1 - inset;
  const marquee = "* + * + * + * + ";
  const phase = Math.floor(time * 6);
  for (let x = 0; x < w; x++) {
    canvas[top][x] = marquee[(x + phase) % marquee.length];
    canvas[bottom][x] = marquee[(x + phase) % marquee.length];
  }
  // Deterministic particles move with elapsed time without retaining per-frame state.
  if (stopped) {
    const count = jackpot ? Math.floor(w * h / 30) : tier === "miss" ? 0 : Math.floor(w * h / 100);
    for (let i = 0; i < count; i++) {
      const x = (i * 37 + Math.floor(time * (i % 3 + 2))) % w;
      const y = (i * 13 + Math.floor(time * (i % 5 + 3))) % h;
      canvas[y][x] = ["*", "+", ".", "$", "o"][i % 5];
    }
  }
  const hasResponse = Boolean(response?.lines.some((line) => line.trim())) && h >= 10;
  const responseRows = hasResponse ? Math.max(3, Math.min(10, Math.floor(h / 3))) : 0;
  const responseTop = h - responseRows - 1;
  const middle = Math.floor((hasResponse ? responseTop : h) / 2);
  const art = reelArt(result, elapsed, w);
  const artTop = Math.max(top + 2, middle - 3);
  const slogan = jackpot && elapsed >= plan.marqueeAt;
  const message = result.message ?? SLOGAN;
  put(artTop - 2, slogan ? `<<< ${message} >>>` : stopped ? `<<< ${names[tier]} >>>` : `>>> PROMPT FEVER / ${state.phase} <<<`);
  const displayArt = slogan ? marqueeFrame(elapsed, w, message, plan.marqueeAt) : art;
  for (let row = 0; row < displayArt.length; row++) put(artTop + row, displayArt[row], slogan ? 0 : undefined);
  if (!hasResponse) {
    put(artTop + 8, stopped ? resultCaption(result) : "GOOD QUESTIONS. BIG REWARDS.");
    if (h >= 20) put(bottom - 1, jackpot ? "*** EXCELLENT PROMPT / WINNER WINNER WINNER ***" : "PI SLOT / KEEP THE IDEAS COMING");
  }

  const rendered = canvas.map((row, y) => {
    let line = "";
    // Color runs keep redraw bandwidth bounded while filling every terminal cell.
    for (let x = 0; x < w; x += 4) {
      const edge = Math.max(Math.abs(x - w / 2) / (w / 2), Math.abs(y - h / 2) / (h / 2));
      const beam = (Math.sin(x / 7 + y / 3 - time * 4) + 1) / 2;
      const impact = jackpot ? Math.max(0, 1 - (elapsed - plan.revealAt) / 650) : 0;
      const hue = jackpot ? (time * 65 + x * 2 + y * 7) % 360 : (chance ? 280 : 210) + beam * 45;
      const light = state.blackout ? 0.015 : jackpot ? 0.22 + beam * 0.14 + edge * 0.08 + impact * 0.15
        : chance && stopped ? 0.16 + beam * 0.12 + edge * 0.08 : 0.06 + beam * 0.08 + edge * 0.06;
      const foreground = state.blackout ? "90;90;110" : "255;248;215";
      line += `${ESC}48;2;${rgb(hue, 0.85, light)}m${ESC}1;38;2;${foreground}m${row.slice(x, x + 4).join("")}`;
    }
    return line + `${ESC}0m`;
  });
  if (hasResponse && response) {
    const inner = w - 4;
    const panelLine = (text: string) => `${ESC}48;2;12;16;30m${ESC}38;2;240;244;255m  ${text}${" ".repeat(Math.max(0, inner - response.measure(text)))}  ${ESC}0m`;
    const body = response.lines.slice(-responseRows);
    for (let i = 0; i < responseRows; i++) rendered[responseTop + i] = panelLine(body[i] ?? "");
  }
  return rendered;
}

export function renderFrame(result: Round, elapsed: number, width: number, intensity: Intensity = "normal") {
  const size = Math.max(0, Math.min(60, Math.floor(width)));
  if (size < 12) return [];
  const inner = size - 2;
  const tick = Math.floor(elapsed / 120);
  const tier = result.tier;
  const state = reelState(result, elapsed);
  const stopped = state.stopped;
  const colors = palettes[tier];
  const color = colors[intensity === "low" ? 0 : tick % colors.length];
  const paint = (text: string) => `${ESC}${state.blackout ? "2" : "1"};${color}m${text}${ESC}0m`;
  const center = (text: string) => {
    const clipped = text.slice(0, inner);
    const left = Math.floor((inner - clipped.length) / 2);
    return " ".repeat(left) + clipped + " ".repeat(inner - left - clipped.length);
  };
  const reels = (state.nudgeProgress ?? 0) > 0.5 ? state.final : state.reels;
  const particle = intensity !== "low" && stopped && tier === "jackpot"
    ? (tick % 2 ? "*  +  *  +  *  +  *" : "+  *  +  *  +  *  +") : "";
  const lines = [
    stopped ? names[tier] : `PROMPT SLOT / ${state.phase}`,
    particle,
    `[ ${reels[0]} ]   [ ${reels[1]} ]   [ ${reels[2]} ]`,
    "",
    stopped ? resultCaption(result) : "",
    intensity === "high" ? particle : "",
  ];
  return [paint("+" + "=".repeat(inner) + "+"), ...lines.map((line) => paint("|" + center(line) + "|")), paint("+" + "=".repeat(inner) + "+")];
}
