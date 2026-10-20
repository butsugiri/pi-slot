import test from "node:test";
import assert from "node:assert/strict";
import { evaluateQuery } from "../src/score.ts";
import { demoResult as makeDemo, TIERS } from "../src/round.ts";
import { renderFrame, renderFullscreen, stripAnsi } from "../src/render.ts";
import { SlotView } from "../src/view.ts";
import { SLOGAN, MARQUEE_START, sloganArt, marqueeFrame, marqueeEnd } from "../src/banner.ts";
const demoResult = (tier = "jackpot") => makeDemo(tier, { pattern: "quick", message: 1, seed: 42 });

test("Japanese prompts earn signals for context, purpose, constraints and verification", () => {
  const result = evaluateQuery("既存の pi を使って、スロットを実装したい。追加 API なしで動かし、テストで確認したい。");
  assert.equal(result.tier, "jackpot");
  assert.ok(result.criteria.includes("制約"));
  assert.ok(result.criteria.includes("検証"));
});
test("repetition and length alone do not increase the score", () => {
  assert.deepEqual(evaluateQuery("したい".repeat(1000)), evaluateQuery("したい"));
  assert.equal(evaluateQuery("あ".repeat(10000)).tier, "miss");
  assert.equal(evaluateQuery(" ").score, 0);
});
test("all frames fit narrow and wide terminals, including ANSI color", () => {
  for (const width of [0, 8, 12, 24, 37, 60, 120]) {
    for (const tier of TIERS) {
      for (const time of [0, 700, 1000, 1400, 2400]) {
        const lines = renderFrame(demoResult(tier), time, width, "high");
        assert.ok(lines.length <= 8);
        for (const line of lines) assert.ok(stripAnsi(line).length <= width);
      }
    }
  }
});
test("jackpot reels settle and low intensity keeps colors stable", () => {
  const result = demoResult();
  assert.match(stripAnsi(renderFrame(result, 1500, 60).join("\n")), /\[ 7 \]   \[ 7 \]   \[ 7 \]/);
  assert.deepEqual(renderFrame(result, 1600, 60, "low"), renderFrame(result, 1800, 60, "low"));
});
test("fullscreen frames fill the viewport and fit after terminal resizes", () => {
  for (const [width, height] of [[12, 8], [24, 10], [40, 15], [80, 24], [160, 48]]) {
    for (const tier of TIERS) {
      for (const elapsed of [0, 900, 1300, 2500, 5000]) {
        const lines = renderFullscreen(demoResult(tier), elapsed, width, height);
        assert.equal(lines.length, height);
        for (const line of lines) {
          assert.equal(stripAnsi(line).length, width);
          assert.match(line, /\x1b\[48;2;/);
        }
      }
    }
  }
});
test("fullscreen jackpot shows large reels and changes the entire background", () => {
  const result = demoResult();
  const first = renderFullscreen(result, 1500, 80, 24);
  const next = renderFullscreen(result, 1700, 80, 24);
  assert.match(stripAnsi(first.join("\n")), /JACKPOT!!!/);
  assert.match(stripAnsi(first.join("\n")), /##############      ##############      ##############/);
  assert.notEqual(first[0], next[0]);
  assert.notEqual(first.at(-1), next.at(-1));
});
test("fullscreen view reads the current terminal height on each frame", () => {
  let height = 24;
  const view = new SlotView(demoResult(), "high", () => {}, () => {}, () => height);
  try {
    assert.equal(view.render(80).length, 24);
    height = 40;
    assert.equal(view.render(100).length, 40);
  } finally {
    view.dispose();
  }
});
test("disposing a view cancels animation and completion callbacks", async () => {
  let frames = 0;
  let completed = false;
  const view = new SlotView(demoResult(), "normal", () => frames++, () => { completed = true; });
  view.dispose();
  view.dispose();
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.equal(frames, 0);
  assert.equal(completed, false);
});
test("slogan uses seven-row glyphs at the same scale as the reels and scrolls across", () => {
  assert.equal(SLOGAN, "GREAT PROMPT RECEIVED");
  for (const width of [40, 80]) {
    const art = sloganArt(width);
    assert.equal(art.length, 7);
    assert.equal(art[0].length, art[6].length);
    assert.ok(marqueeEnd(width) > MARQUEE_START + 3000);
    assert.ok(marqueeFrame(MARQUEE_START, width).every((line) => !line.trim()));
    assert.ok(marqueeFrame(MARQUEE_START + 1000, width).some((line) => line.includes("#")));
    assert.notDeepEqual(marqueeFrame(3600, width), marqueeFrame(3800, width));
  }
});
test("live generation continues past the former six-second cutoff and displays partial text", () => {
  let now = 0;
  let closed = 0;
  const view = new SlotView(demoResult(), "high", () => {}, () => closed++, () => 24, { live: true, now: () => now });
  try {
    assert.doesNotMatch(stripAnsi(view.render(80).join("\n")), /ASSISTANT|GENERATING|Waiting for the assistant/);
    view.start();
    now = 1000;
    view.updateText("Partial assistant response");
    assert.match(stripAnsi(view.render(80).join("\n")), /Partial assistant response/);
    assert.doesNotMatch(stripAnsi(view.render(80).join("\n")), /ASSISTANT|GENERATING|Waiting for the assistant/);
    now = 30000;
    view.tick();
    assert.equal(closed, 0);
    view.updateText("Partial assistant response with more tokens");
    assert.match(stripAnsi(view.render(80).join("\n")), /with more tokens/);
    view.finish();
    assert.equal(view.status, "done");
    assert.match(stripAnsi(view.render(80).join("\n")), /with more tokens/);
    now += 801;
    view.tick();
    assert.equal(closed, 1);
    view.tick();
    assert.equal(closed, 1);
  } finally { view.dispose(); }
});
test("live reply remains visible in small and large viewports without overflowing", () => {
  for (const [width, height] of [[24, 10], [40, 15], [80, 24], [160, 48]]) {
    const lines = renderFullscreen(demoResult(), 3500, width, height, {
      lines: ["partial tokens"], status: "generating", measure: (text) => text.length,
    });
    assert.equal(lines.length, height);
    assert.match(stripAnsi(lines.join("\n")), /partial tokens/);
    for (const line of lines) assert.equal(stripAnsi(line).length, width);
  }
});
test("fast answers remain on screen until the slogan completes, and abort closes promptly", () => {
  let now = 0;
  let closed = 0;
  const view = new SlotView(demoResult(), "high", () => {}, () => closed++, () => 24, { live: true, now: () => now });
  try {
    view.start();
    now = 500;
    view.updateText("Done");
    view.finish();
    now = 6000;
    view.tick();
    assert.equal(closed, 0);
    now = view.minimumDuration() + 1;
    view.tick();
    assert.equal(closed, 1);
  } finally { view.dispose(); }
  const aborted = new SlotView(demoResult(), "high", () => {}, () => closed++, () => 24, { live: true });
  aborted.start();
  aborted.finish(true);
  assert.equal(closed, 2);
  assert.equal(aborted.disposed, true);
});
test("an input that never starts a model run does not leave an infinite overlay", () => {
  let now = 0;
  let closed = false;
  const view = new SlotView(demoResult("normal"), "high", () => {}, () => { closed = true; }, () => 24, { live: true, now: () => now });
  now = 15001;
  view.tick();
  assert.equal(closed, true);
});
