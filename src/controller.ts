import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { Round, Intensity, ViewOptions } from "./types.ts";
import { SlotView } from "./view.ts";

export class SlotController {
  private formatting: Pick<ViewOptions, "formatText" | "measure">;

  constructor(formatting: Pick<ViewOptions, "formatText" | "measure"> = {}) {
    this.formatting = formatting;
  }

  private generation = 0;
  private dismiss: (() => void) | undefined;
  private active: SlotView | undefined;

  stop() {
    this.generation++;
    const close = this.dismiss;
    this.dismiss = undefined;
    this.active = undefined;
    close?.();
  }

  show(ctx: ExtensionContext, result: Round, intensity: Intensity, live = false) {
    this.stop();
    if (ctx.mode !== "tui") return;
    const current = this.generation;
    const fullscreen = intensity === "high";
    // Never await the animation from an input hook: agent processing continues immediately.
    void ctx.ui.custom<void>((tui, _theme, _keys, done) => {
      let view: SlotView;
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        view?.dispose();
        if (this.generation === current) {
          this.dismiss = undefined;
          this.active = undefined;
        }
        done();
      };
      view = new SlotView(result, intensity, () => tui.requestRender(), close, () => tui.terminal.rows, {
        live,
        width: tui.terminal.columns,
        ...this.formatting,
      });
      if (this.generation !== current) {
        view.dispose();
        queueMicrotask(close);
      } else {
        this.dismiss = close;
        if (live) this.active = view;
      }
      return view;
    }, {
      overlay: true,
      overlayOptions: {
        anchor: fullscreen ? "top-left" : "center",
        width: fullscreen ? "100%" : "90%",
        maxHeight: fullscreen ? "100%" : 8,
        nonCapturing: true,
        visible: (width, height) => width >= 24 && height >= 10,
      },
    }).catch(() => {
      if (this.generation === current) {
        this.stop();
        ctx.ui.notify("スロット演出を表示できませんでした。", "warning");
      }
    }).finally(() => {
      if (this.generation === current) { this.dismiss = undefined; this.active = undefined; }
    });
  }

  start() { this.active?.start(); }
  updateText(text: string) { this.active?.updateText(text); }
  finish(aborted = false) { this.active?.finish(aborted); }
}
