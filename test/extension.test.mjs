import test from "node:test";
import assert from "node:assert/strict";
import { registerSlot } from "../src/extension.ts";

const flush = () => new Promise((resolve) => setImmediate(resolve));
const assistant = (text) => ({ role: "assistant", content: [{ type: "text", text }] });

function harness(t, { mode = "tui", delayed = false } = {}) {
  const events = new Map();
  const commands = new Map();
  const overlays = [];
  const notices = [];
  const tui = { terminal: { rows: 24, columns: 80 }, requestRender() {} };
  const ctx = { mode, ui: {
    notify: (message, level) => notices.push({ message, level }),
    custom(factory, options) {
      let resolve, reject;
      const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
      const overlay = { options, reject, resolve, closes: 0, view: undefined,
        mount() {
          this.view = factory(tui, {}, {}, () => { this.closes++; resolve(); });
          return this.view;
        },
      };
      overlays.push(overlay);
      if (!delayed) overlay.mount();
      return promise;
    },
  } };
  const emit = (name, event = {}) => events.get(name)?.(event, ctx);
  registerSlot({ on: (name, handler) => events.set(name, handler), registerCommand: (name, spec) => commands.set(name, spec.handler) });
  t.after(() => {
    emit("session_shutdown");
    for (const overlay of overlays) assert.ok(!overlay.view || overlay.view.disposed, "every mounted view must release its timer");
  });
  return {
    overlays, notices, emit,
    input: (text = "質問", source = "interactive") => emit("input", { text, source }),
    command: (args, name = "slot") => commands.get(name)(args, ctx),
  };
}

test("input continues immediately while generation events update and settle the overlay", async (t) => {
  const h = harness(t);
  assert.deepEqual(h.input(), { action: "continue" });
  const overlay = h.overlays[0];
  const view = overlay.view;
  assert.equal(view.activityStarted, false);
  h.emit("agent_start");
  h.emit("message_update", { message: assistant("partial") });
  assert.equal(view.text, "partial");
  h.emit("message_update", { message: { role: "user", content: "ignored" } });
  assert.equal(view.text, "partial");
  h.emit("message_end", { message: { role: "assistant", content: [
    { type: "text", text: "final" }, { type: "toolCall", name: "ignored" }, { type: "text", text: "answer" },
  ] } });
  assert.equal(view.text, "final\nanswer");
  h.emit("agent_settled", { aborted: false });
  assert.equal(view.status, "done");
  assert.equal(overlay.closes, 0);
  view.now = () => view.started + view.minimumDuration() + 1000;
  view.tick();
  await flush();
  assert.equal(view.disposed, true);
  assert.equal(overlay.closes, 1);
});

test("a second input replaces the first overlay and stale completion cannot detach the new one", async (t) => {
  const h = harness(t);
  h.input("first");
  h.input("second");
  const [first, second] = h.overlays;
  assert.equal(first.view.disposed, true);
  assert.equal(first.closes, 1);
  await flush();
  h.emit("agent_start");
  h.emit("message_update", { message: assistant("new answer") });
  assert.equal(second.view.text, "new answer");
  assert.equal(first.view.text, "");
  h.emit("agent_settled", { aborted: true });
  assert.equal(second.closes, 1);
});

test("stop invalidates an overlay whose UI factory has not mounted yet", async (t) => {
  const h = harness(t, { delayed: true });
  h.input();
  await h.command("stop");
  const overlay = h.overlays[0];
  overlay.mount();
  assert.equal(overlay.view.disposed, true);
  await flush();
  assert.equal(overlay.closes, 1);
  h.emit("message_update", { message: assistant("late") });
  assert.equal(overlay.view.text, "");
});

test("a delayed stale factory closes without taking ownership of the current overlay", async (t) => {
  const h = harness(t, { delayed: true });
  h.input("first");
  h.input("second");
  const [first, second] = h.overlays;
  second.mount();
  first.mount();
  await flush();
  assert.equal(first.closes, 1);
  assert.equal(second.view.disposed, false);
  h.emit("message_update", { message: assistant("current") });
  assert.equal(second.view.text, "current");
  await h.command("stop");
  assert.equal(second.closes, 1);
});

test("UI failure releases the active view and the next input can recover", async (t) => {
  const h = harness(t);
  h.input();
  h.overlays[0].reject(new Error("UI failed"));
  await flush();
  assert.equal(h.overlays[0].view.disposed, true);
  assert.equal(h.overlays[0].closes, 1);
  assert.equal(h.notices.at(-1).level, "warning");
  h.input();
  h.emit("agent_start");
  h.emit("message_update", { message: assistant("recovered") });
  assert.equal(h.overlays[1].view.text, "recovered");
});

test("a stale UI rejection cannot close or warn about the replacement overlay", async (t) => {
  const h = harness(t, { delayed: true });
  h.input("first");
  h.input("second");
  h.overlays[1].mount();
  h.overlays[0].reject(new Error("stale failure"));
  await flush();
  assert.equal(h.notices.length, 0);
  assert.equal(h.overlays[1].view.disposed, false);
  h.emit("agent_start");
  assert.equal(h.overlays[1].view.activityStarted, true);
});

test("abort, stop and shutdown close an overlay once and ignore late generation events", async (t) => {
  const h = harness(t);
  h.input();
  const overlay = h.overlays[0];
  h.emit("agent_settled", { aborted: true });
  h.emit("agent_settled", { aborted: true });
  h.emit("message_update", { message: assistant("late text") });
  h.emit("agent_start");
  await h.command("stop");
  h.emit("session_shutdown");
  assert.equal(overlay.closes, 1);
  assert.equal(overlay.view.disposed, true);
  assert.equal(overlay.view.text, "");
});

test("settings control automatic input, modes and intensity while demos remain available", async (t) => {
  const h = harness(t);
  await h.command("off");
  h.input();
  assert.equal(h.overlays.length, 0);
  await h.command("jackpot nudge --message 3 --seed 42", "slot-demo");
  assert.equal(h.overlays[0].view.result.demo, true);
  assert.equal(h.overlays[0].view.result.plan.pattern, "nudge");
  h.emit("message_update", { message: assistant("not for demo") });
  assert.equal(h.overlays[0].view.text, "");
  await h.command("mode random");
  assert.equal(h.overlays[0].view.disposed, true);
  await h.command("intensity low");
  await h.command("on");
  h.input();
  const view = h.overlays[1].view;
  assert.equal(view.result.mode, "random");
  assert.equal(view.result.score, null);
  assert.equal(view.intensity, "low");
  assert.equal(h.overlays[1].options.overlayOptions.anchor, "center");
  await h.command("mode score");
  assert.equal(view.disposed, true);
  h.input();
  assert.equal(h.overlays[2].view.result.mode, "score");
});

test("invalid commands and demo help leave the active animation untouched", async (t) => {
  const h = harness(t);
  h.input();
  for (const value of ["mode unknown", "intensity extreme", "on extra"]) await h.command(value);
  for (const value of ["--seed -1", "miss nudge", "jackpot --message 6", "--help"]) await h.command(value, "slot-demo");
  assert.equal(h.overlays.length, 1);
  assert.equal(h.overlays[0].view.disposed, false);
  assert.match(h.notices.at(-1).message, /1: GREAT PROMPT RECEIVED/);
  await h.command("");
  assert.match(h.notices.at(-1).message, /ON.*high.*score/);
});

test("noninteractive and blank input never starts an overlay", (t) => {
  const h = harness(t);
  h.input(" ");
  h.input("extension", "extension");
  h.input("rpc", "rpc");
  assert.equal(h.overlays.length, 0);
});

for (const mode of ["rpc", "print"]) {
  test(`${mode} mode does not open an overlay`, async (t) => {
    const h = harness(t, { mode });
    h.input();
    await h.command("", "slot-demo");
    assert.equal(h.overlays.length, 0);
    assert.match(h.notices.at(-1).message, /interactive mode/);
  });
}

test("assistant errors are displayed when a message has no text", (t) => {
  const h = harness(t);
  h.input();
  h.emit("message_end", { message: { ...assistant(""), errorMessage: "provider error" } });
  assert.equal(h.overlays[0].view.text, "provider error");
});
