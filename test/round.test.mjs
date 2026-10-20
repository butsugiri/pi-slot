import { parseDemoArgs } from "../src/commands.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { evaluateQuery } from "../src/score.ts";
import { createRound, demoResult, reelState, TIERS, PATTERNS, FINAL_REELS, MESSAGES } from "../src/round.ts";
import { sloganArt, marqueeEnd } from "../src/banner.ts";
import { renderFullscreen, renderFrame, reelArt, stripAnsi } from "../src/render.ts";
import { SlotView } from "../src/view.ts";

test("uniform draws split the random number interval into four equal bins independently of prompt quality", () => {
  const counts = Object.fromEntries(TIERS.map((tier) => [tier, 0]));
  for (let i = 0; i < 1000; i++) {
    const round = createRound({ mode: "random", text: i % 2 ? "あ" : "既存の改善をしたい。制約と具体例を検証。" }, () => (i + 0.5) / 1000);
    counts[round.tier]++;
    assert.equal(round.score, null);
    assert.deepEqual(round.criteria, []);
  }
  assert.deepEqual(Object.values(counts), [250, 250, 250, 250]);
});
test("score mode maps zero through five signals into four tiers", () => {
  for (const [text, tier, score] of [
    ["あ", "miss", 0], ["実装したい", "miss", 20],
    ["既存の改善をしたい", "small", 40],
    ["既存の改善をしたい。検証する", "medium", 60],
    ["既存の改善をしたい。制約を検証する", "jackpot", 80],
    ["既存の改善をしたい。具体的な制約を検証する", "jackpot", 100],
  ]) {
    assert.deepEqual([evaluateQuery(text).tier, evaluateQuery(text).score], [tier, score]);
  }
});
test("demo parser supports positionals, flags, equals, aliases and reproducible seeds", () => {
  const positional = parseDemoArgs("jackpot nudge --message 3 --seed 42");
  const flags = parseDemoArgs("--result=jackpot --pattern=nudge --message=3 --seed=42");
  assert.deepEqual(positional, flags);
  assert.deepEqual(createRound({ ...positional, demo: true }), createRound({ ...flags, demo: true }));
  const random = parseDemoArgs("random random --seed 0");
  assert.deepEqual(createRound({ ...random, demo: true }), createRound({ ...random, demo: true }));
  assert.equal(demoResult("normal").tier, "miss");
  assert.equal(demoResult("chance").tier, "small");
  assert.deepEqual(parseDemoArgs("--help"), { help: true });
});
test("invalid demo input is rejected before an animation starts", () => {
  for (const value of ["--seed -1", "--seed 4294967296", "--seed 1.5", "--message", "--seed --message 1", "--unknown 1", "jackpot nudge extra", "jackpot --result small", "--seed 1 --seed 2"]) {
    assert.throws(() => parseDemoArgs(value), value);
  }
  for (const value of ["oops", "jackpot unknown", "miss nudge", "miss revival", "jackpot --message 0", "jackpot --message 6"]) {
    assert.throws(() => createRound({ ...parseDemoArgs(value), demo: true }), value);
  }
});
test("all patterns finish on the preselected result; every winning pattern can pair with every win", () => {
  for (const tier of TIERS) {
    for (const pattern of PATTERNS) {
      if (tier === "miss" && ["nudge", "revival"].includes(pattern)) continue;
      const round = demoResult(tier, { pattern, seed: 42, message: 1 });
      const final = reelState(round, round.plan.revealAt);
      assert.deepEqual(final.reels, FINAL_REELS[tier]);
      assert.equal(final.stopped, true);
      assert.equal(reelState(round, round.plan.revealAt - 1).stopped, false);
      assert.equal(round.plan.marqueeAt, round.plan.revealAt + 1300);
    }
  }
});
test("nudge holds an adjacent symbol, advances one glyph, then lands on the intended win", () => {
  const round = demoResult("jackpot", { pattern: "nudge", seed: 4 });
  const near = reelState(round, round.plan.stops[2] + 50);
  assert.deepEqual(near.reels.slice(0, 2), ["7", "7"]);
  assert.notEqual(near.reels[2], "7");
  assert.equal(near.stopped, false);
  const halfway = round.plan.resumeAt + (round.plan.revealAt - round.plan.resumeAt) / 2;
  assert.equal(reelState(round, halfway).nudgeProgress, 0.5);
  assert.notDeepEqual(reelArt(round, halfway, 80), reelArt(round, round.plan.stops[2] + 50, 80));
  assert.deepEqual(reelState(round, round.plan.revealAt).reels, ["7", "7", "7"]);
});
test("reach and tease delay the last reel; revival has a blackout then a restart", () => {
  const reach = demoResult("jackpot", { pattern: "reach", seed: 7 });
  const tease = demoResult("jackpot", { pattern: "tease", seed: 7 });
  assert.ok(reach.plan.stops[2] - reach.plan.stops[1] > 1800);
  assert.ok(tease.plan.revealAt > reach.plan.revealAt);
  const revival = demoResult("jackpot", { pattern: "revival", seed: 7 });
  assert.equal(reelState(revival, revival.plan.stops[2] + 1).blackout, true);
  assert.equal(reelState(revival, revival.plan.resumeAt + 1).blackout, false);
  assert.equal(reelState(revival, revival.plan.resumeAt + 1).stopped, false);
});
test("all five phrases have valid large glyphs and enough time to finish scrolling", () => {
  const chosen = new Set();
  for (let i = 1; i <= 5; i++) {
    const round = demoResult("jackpot", { pattern: "revival", message: i, seed: 2 });
    chosen.add(round.message);
    for (const width of [24, 80, 160]) {
      const art = sloganArt(width, round.message);
      assert.equal(art.length, 7);
      assert.ok(art.every((line) => line.length === art[0].length));
      const view = new SlotView(round, "high", () => {}, () => {}, () => 24, { width });
      try { assert.ok(view.minimumDuration() >= marqueeEnd(width, round.message, round.plan.marqueeAt)); }
      finally { view.dispose(); }
    }
  }
  assert.deepEqual(chosen, new Set(MESSAGES));
});
test("every animation fits the terminal throughout spin, fake stop, restart, win and marquee", () => {
  for (const tier of TIERS) {
    for (const pattern of PATTERNS) {
      if (tier === "miss" && ["nudge", "revival"].includes(pattern)) continue;
      const round = demoResult(tier, { pattern, seed: 42, message: 3 });
      const times = [0, ...round.plan.stops, round.plan.resumeAt, round.plan.resumeAt + 160, round.plan.revealAt, round.plan.marqueeAt + 1000];
      for (const elapsed of times) {
        for (const [width, height] of [[24, 10], [80, 24]]) {
          const lines = renderFullscreen(round, elapsed, width, height);
          assert.equal(lines.length, height);
          for (const line of lines) assert.equal(stripAnsi(line).length, width);
          for (const line of renderFrame(round, elapsed, width)) assert.ok(stripAnsi(line).length <= width);
        }
      }
    }
  }
});
test("random mode displays a draw label without a fabricated prompt score", () => {
  const round = createRound({ mode: "random", seed: 42 });
  const frame = stripAnsi(renderFrame(round, round.plan.revealAt + 1, 60).join("\n"));
  assert.match(frame, /LUCKY DRAW/);
  assert.doesNotMatch(frame, /\/100|PROMPT SIGNALS/);
});

test("published seeds retain their results, timing and messages across refactors", async () => {
  const { readFile } = await import("node:fs/promises");
  const fixtures = JSON.parse(await readFile(new URL("./fixtures/seeded-rounds.json", import.meta.url), "utf8"));
  for (const { options, expected } of fixtures) assert.deepEqual(createRound(options), expected);
});
