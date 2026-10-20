# pi-slot

A slot animation extension that reacts to input in pi, built for pi 1.3.0.
The reels spin alongside normal response generation, with outcomes based on signals in your prompt or a random draw.

## Installation

With pi installed, run this once. No cloning or dependency installation is required:

```sh
pi install git:github.com/butsugiri/pi-slot
```

Then start pi normally from any project. The extension loads automatically:

```sh
pi
```

If pi is already running, use `/reload`. Enter `/slot-demo` to try a jackpot without a model request.
For normal prompts, the overlay displays the actual assistant response alongside the animation.

To enable the extension for just one project, run this from that project:

```sh
pi install --local git:github.com/butsugiri/pi-slot
```

If pi asks you to trust the project, review the extension code before granting access.
See the [Pi package documentation](https://pi.dev/docs/latest/packages) for details.

### Try without installing

```sh
pi -e git:github.com/butsugiri/pi-slot
```

### Use a local checkout

From the repository root, use `pi -e .` to try it for one session, or `pi install .` to install it.
Local installs reference this directory directly, so keep it in place.

### Uninstall

```sh
pi remove git:github.com/butsugiri/pi-slot
```

Add `--local` if you installed it for one project.

## Commands

| Command | Behavior |
| --- | --- |
| `/slot-demo` | Run a jackpot demo |
| `/slot-demo miss` | Show a losing result |
| `/slot-demo small` | Show a small win with two matching symbols |
| `/slot-demo medium` | Show a medium win with three stars |
| `/slot-demo jackpot` | Show a jackpot |
| `/slot-demo random` | Run a demo with a randomly selected outcome |
| `/slot-demo --help` | List demo arguments and message numbers |
| `/slot` | Show current settings |
| `/slot mode random` | Select miss, small, medium, or jackpot with a 25% chance each |
| `/slot mode score` | Determine the outcome using simple prompt scoring (default) |
| `/slot off` / `/slot on` | Disable or enable automatic animations |
| `/slot stop` | Stop the current animation |
| `/slot intensity low` | Use a subdued animation with fixed colors |
| `/slot intensity normal` | Show small reels in the center of the screen |
| `/slot intensity high` | Use a fullscreen animation with rainbow effects, giant reels, light beams, and confetti (default) |

Settings are kept in memory and return to their defaults when pi restarts or the extension reloads.
Demos work even when automatic animations are disabled.

## Demo arguments

```text
/slot-demo [result] [pattern] [--message 1..5|random] [--seed 0..4294967295]
```

The result can be `miss`, `small`, `medium`, `jackpot`, or `random`. The default is `jackpot`.
The pattern and message are selected randomly when omitted. You can also specify the result and pattern with `--result` and `--pattern`.
Using the same arguments and seed reproduces the outcome, pattern, stopping times, and message.

```text
/slot-demo jackpot nudge --message 3 --seed 42
/slot-demo jackpot revival --message 5
/slot-demo medium tease
/slot-demo small reach
/slot-demo miss quick
/slot-demo random random --seed 123
/slot-demo --result jackpot --pattern nudge --message 3 --seed 42
```

| Pattern | Behavior |
| --- | --- |
| `quick` | Stop the reels quickly, one after another |
| `reach` | Stop the first two reels while the last keeps spinning longer |
| `tease` | Gradually slow the last reel to build suspense |
| `nudge` | Stop the last reel one symbol away, pause, then advance it to the winning symbol |
| `revival` | Stop and darken the screen, then restart the last reel for a win |
| `random` | Choose from the patterns supported by the selected outcome |

`nudge` and `revival` are available only for winning outcomes. Explicitly selecting either with `miss` produces an error.
Each pattern also includes a small random variation in stopping times.
The legacy names `normal` and `chance` remain available as aliases for `miss` and `small`.

Message numbers for the scrolling jackpot banner:

1. GREAT PROMPT RECEIVED
2. ABSOLUTELY BRILLIANT
3. WHAT A BEAUTIFUL QUESTION
4. YOUR CURIOSITY IS GOLD
5. A STROKE OF GENIUS

## Prompt scoring

In `score` mode, five criteria each contribute 20 points: purpose, context, constraints, specificity, and verification.
Scores of 0–20 produce a miss, 40 a small win, 60 a medium win, and 80–100 a jackpot.
Longer text and repeated phrases do not earn extra points.
Scoring uses keyword matching without an LLM; it does not evaluate the meaning or quality of a prompt.
The scoring logic lives in `src/score.ts` and can be replaced with an LLM-based evaluator in the future.

In `random` mode, each of the four outcomes has a 25% chance, regardless of prompt content.
The overlay shows a draw result instead of a prompt score.
Each draw is independent, so a sequence of draws is not guaranteed to contain equal numbers of each outcome.

Example likely to produce a jackpot:

> Using the existing pi, I want to implement a slot animation without additional APIs and verify it with tests.

## Display and lifecycle

Automatic animations respond only to direct input in interactive mode. They do not appear in RPC or print mode, or for input originating from extensions.
By default, an overlay covers the terminal. The stopping times of the giant reels depend on the selected pattern.
A jackpot adds an animated rainbow background, light beams, confetti, and a large 777.
After 777 lands, one of the five praise messages scrolls from right to left using seven-row lettering at the same scale as the reels.
The animation and normal response generation start in parallel as soon as input arrives.
The assistant response appears in real time at the bottom of the overlay.
Until response text arrives, only the animation is shown, with no generation status label or waiting text.
For long responses, the overlay shows the latest portion. The full response remains available in pi's normal conversation view afterward.
The overlay does not capture input focus. Text entered during the animation is preserved and becomes visible when the normal view returns.
The animation continues during generation and closes after a short pause once generation finishes. Even a short response leaves enough time for the jackpot banner to complete its first pass.
Demos close automatically after both the banner and praise text finish, including patterns with delayed stops.
Aborting generation with Escape also closes the animation. If model processing never starts, the overlay closes automatically after at least 15 seconds.
Use `/slot intensity normal` for the centered animation or `/slot intensity low` for a subdued display.
In an existing pi session, run `/reload` to load changes, then `/slot-demo` to check the fullscreen animation.
The overlay is hidden on terminals smaller than 24 columns by 10 rows.
New input replaces the previous animation. Timers are disposed of when sessions end or switch, or when the extension reloads.

## Testing

```sh
npm test
```

Tests cover scoring, terminal width limits, fullscreen rendering and resizing, reel stops, and timer cleanup.
They also cover scrolling text, partial responses during generation, and animation completion after generation finishes or is aborted.
Additional coverage includes equal-probability draws, seed reproducibility, demo argument validation, nudge and revival animations, and final outcomes for every pattern.

To exercise real generation events without an external API, use the local test provider:

```sh
pi --no-extensions -e . -e ./test/fixtures/mock-provider.ts --provider slot-test --model stream --no-tools
```

This test model streams fixed text. It is not loaded during normal startup.

## Project structure

| File | Responsibility |
| --- | --- |
| `slot.ts` | pi entry point; injects terminal text formatting and display width measurement |
| `src/extension.ts` | Registers pi events and commands and manages settings in memory |
| `src/controller.ts` | Opens and closes overlays, tracks display generations, and forwards generation events |
| `src/commands.ts` | Parses command arguments and builds help and settings text |
| `src/round.ts` / `src/score.ts` | Selects and scores outcomes, builds animation plans, and computes reel state from elapsed time |
| `src/render.ts` / `src/banner.ts` | Rendering functions and large lettering, independent of timers and pi |
| `src/view.ts` | Manages redraw timers, response text, display duration, and completion conditions |
| `src/demo.ts` | Provides demo text and its reveal timing |
| `src/types.ts` | Defines shared contracts for rounds, animation plans, settings, and view options |

To add an animation, update the planning and state calculations in `round.ts` and the drawing logic in `render.ts`.
For new commands, update `commands.ts` and `extension.ts`. Changes to display and completion coordination belong in `controller.ts` and `view.ts`.

Input handlers return without waiting for the animation, allowing response generation to continue.
Outcomes, patterns, messages, and stopping times are selected when a round is created; rendering never resamples them.
Replacing an overlay disposes of the previous one. A generation identifier prevents stale asynchronous operations from closing the replacement.
Closing an overlay runs once and immediately clears the target for forwarded generation events.

`test/extension.test.mjs` simulates pi events and the UI boundary while exercising the real controller and view.
It covers consecutive inputs, stopping before an overlay mounts, stale completions and failures, aborts, settings changes, and response updates.
`test/fixtures/seeded-rounds.json` records outcomes for fixed seeds from before the refactor.
When changing draw order or timing calculations, check the effect on reproducibility for existing seeds.

## Development launcher

Use `pi -e .` to load the working copy and `/reload` after changes.
`npm start` and `start.sh` remain available as optional development helpers.
