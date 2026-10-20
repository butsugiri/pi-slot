import type { Round, Intensity, ViewOptions } from "./types.ts";
import { marqueeEnd, SLOGAN } from "./banner.ts";
import { demoPraiseAt, DEMO_PRAISE_DURATION } from "./demo.ts";
import { planFor } from "./round.ts";
import { renderFrame, renderFullscreen } from "./render.ts";

export class SlotView {
  result: Round;
  intensity: Intensity;
  now: () => number;
  started: number;
  disposed = false;
  getHeight: () => number;
  requestRender: () => void;
  done: () => void;
  live: boolean;
  activityStarted = false;
  status: "waiting" | "generating" | "done" | "aborted";
  settledAt: number | undefined;
  text = "";
  width: number;
  formatText: NonNullable<ViewOptions["formatText"]>;
  measure: NonNullable<ViewOptions["measure"]>;
  interval: ReturnType<typeof setInterval>;

  constructor(result: Round, intensity: Intensity, requestRender: () => void, done: () => void, getHeight = () => 24, options: ViewOptions = {}) {
    this.result = result;
    this.intensity = intensity;
    this.now = options.now ?? Date.now;
    this.started = this.now();
    this.getHeight = getHeight;
    this.requestRender = requestRender;
    this.done = done;
    this.live = options.live ?? false;
    this.status = this.live ? "waiting" : "generating";
    this.settledAt = this.live ? undefined : 0;
    this.width = options.width ?? 80;
    this.formatText = options.formatText ?? ((text, width) => text.split("\n").flatMap((line) => line.match(new RegExp(`.{1,${Math.max(1, width)}}`, "g")) ?? [""]));
    this.measure = options.measure ?? ((text) => text.length);
    this.interval = setInterval(() => this.tick(), intensity === "high" ? 80 : 120);
  }
  minimumDuration() {
    const plan = planFor(this.result);
    const duration = this.result.tier === "jackpot"
      ? this.intensity === "high" ? marqueeEnd(this.width, this.result.message ?? SLOGAN, plan.marqueeAt) : plan.revealAt + 2900
      : plan.revealAt + 1700;
    return this.result.demo && !this.live && this.intensity === "high"
      ? Math.max(duration, DEMO_PRAISE_DURATION) : duration;
  }
  tick() {
    if (this.disposed) return;
    const elapsed = this.now() - this.started;
    const settled = this.settledAt !== undefined && elapsed >= Math.max(this.minimumDuration(), this.settledAt + 800);
    const neverStarted = this.live && !this.activityStarted && elapsed >= Math.max(15000, this.minimumDuration());
    if (settled || neverStarted) {
      this.dispose();
      this.done();
      return;
    }
    this.requestRender();
  }
  start() {
    this.activityStarted = true;
    this.status = "generating";
    this.settledAt = undefined;
    this.requestRender();
  }
  updateText(text: string) {
    if (!text) return;
    this.activityStarted = true;
    this.text = text.slice(-32000);
    this.status = "generating";
    this.requestRender();
  }
  finish(aborted = false) {
    this.status = aborted ? "aborted" : "done";
    this.settledAt = this.now() - this.started;
    if (aborted) {
      this.dispose();
      this.done();
      return;
    }
    this.requestRender();
  }
  render(width: number) {
    this.width = width;
    const elapsed = this.now() - this.started;
    if (this.intensity === "high") {
      const text = this.text || (!this.live && this.result.demo ? demoPraiseAt(elapsed) : "");
      const lines = text ? this.formatText(text, Math.max(1, width - 4)) : [];
      return renderFullscreen(this.result, elapsed, width, this.getHeight(), { lines, measure: this.measure });
    }
    return renderFrame(this.result, elapsed, width, this.intensity);
  }
  invalidate() {}
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    clearInterval(this.interval);
  }
}
