# GameSEL — Blackjack & FrozenLake 6x6 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two standalone browser games (Blackjack with chips, FrozenLake 6x6 with slippery toggle), each with an in-browser Q-learning AI demo, faithful to Gymnasium toy-text environment logic.

**Architecture:** Each game lives in its own folder with a pure, DOM-free engine module (Gymnasium logic), a DOM-free tabular Q-learning agent, and a UI layer that renders hand-crafted SVG/CSS art. Scripts use classic-script + CommonJS dual export (NOT ES modules) so games run from `file://` double-click AND tests run under plain Node.

**Tech Stack:** Vanilla HTML/CSS/JS, zero dependencies, zero build step. Tests: plain Node scripts with `assert`.

**Spec:** `docs/superpowers/specs/2026-06-10-gamesel-blackjack-frozenlake-design.md`

---

## Critical constraints (read first)

1. **NO ES modules.** Chrome blocks `import` from `file://`. Every `js/*.js` file uses this dual-export pattern, and `index.html` loads them with plain `<script src>` tags in order (engine → ai → ui):

```js
const BlackjackEngine = (() => {
  // ...implementation...
  return { /* public API */ };
})();
if (typeof module !== "undefined" && module.exports) module.exports = BlackjackEngine;
```

2. **No external runtime assets required.** All art is inline SVG/CSS. Web fonts may be linked but every font-family must have a good local fallback so the game still looks right offline.
3. **Engines/agents never touch the DOM.** They accept an injectable `rng` function (default `Math.random`) so tests can seed them.
4. **Gymnasium action conventions are non-negotiable:** Blackjack `1=Hit, 0=Stick`; FrozenLake `0=Left, 1=Down, 2=Right, 3=Up`.

---

### Task 1: Scaffold + git init

**Files:** Create folders `blackjack/{css,js,test}`, `frozenlake/{css,js,test}`.

- [ ] **Step 1:** `git init` in `GameSEL/`, then `git add docs && git commit -m "docs: spec and plan for GameSEL"`
- [ ] **Step 2:** Create the six folders (empty for now; they'll be populated by later tasks).

---

### Task 2: Blackjack engine (TDD)

**Files:**
- Test: `blackjack/test/engine.test.js`
- Create: `blackjack/js/engine.js`

- [ ] **Step 1: Write the failing test** — full content of `blackjack/test/engine.test.js`:

```js
const assert = require("assert");
const E = require("../js/engine.js");

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("ok -", name); }
  catch (err) { failed++; console.error("FAIL -", name, "\n  ", err.message); }
}

// rng helper: returns values that make drawCard yield exactly these cards, in order
function cardRng(cards) {
  const queue = cards.slice();
  return () => {
    const card = queue.shift();
    if (card === undefined) throw new Error("cardRng queue empty");
    return E.DECK.indexOf(card) / E.DECK.length + 1e-9;
  };
}

test("DECK is the Gymnasium infinite deck", () => {
  assert.deepStrictEqual(E.DECK, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10, 10]);
});

test("usableAce: ace counts as 11 only when it does not bust", () => {
  assert.strictEqual(E.usableAce([1, 2]), true);      // 3 -> 13
  assert.strictEqual(E.usableAce([1, 10, 10]), false); // 21 -> 31 busts
  assert.strictEqual(E.usableAce([5, 9]), false);      // no ace
});

test("sumHand applies usable ace", () => {
  assert.strictEqual(E.sumHand([1, 10]), 21);
  assert.strictEqual(E.sumHand([1, 1]), 12);   // one ace as 11, one as 1
  assert.strictEqual(E.sumHand([10, 10, 5]), 25);
});

test("isBust / score", () => {
  assert.strictEqual(E.isBust([10, 10, 5]), true);
  assert.strictEqual(E.score([10, 10, 5]), 0);
  assert.strictEqual(E.score([10, 9]), 19);
});

test("isNatural only for exactly ace + ten-card", () => {
  assert.strictEqual(E.isNatural([1, 10]), true);
  assert.strictEqual(E.isNatural([10, 1]), true);
  assert.strictEqual(E.isNatural([1, 9]), false);
  assert.strictEqual(E.isNatural([1, 10, 10]), false);
});

test("reset deals player then dealer, two cards each; obs shape", () => {
  const env = new E.BlackjackEnv(cardRng([5, 6, 10, 9]));
  const obs = env.reset();
  assert.deepStrictEqual(env.player, [5, 6]);
  assert.deepStrictEqual(env.dealer, [10, 9]);
  assert.deepStrictEqual(obs, [11, 10, false]); // playerSum, dealerShowing, usableAce
});

test("hit that busts ends round with reward -1", () => {
  const env = new E.BlackjackEnv(cardRng([10, 6, 5, 5, 10]));
  env.reset();                       // player 16, dealer 10
  const r = env.step(1);             // hit -> 26, bust
  assert.strictEqual(r.reward, -1);
  assert.strictEqual(r.done, true);
});

test("stick: dealer draws to 17+, player 20 beats dealer bust", () => {
  const env = new E.BlackjackEnv(cardRng([10, 10, 10, 6, 10]));
  env.reset();                       // player 20, dealer 16
  const r = env.step(0);             // dealer draws 10 -> 26 bust
  assert.strictEqual(E.sumHand(env.dealer), 26);
  assert.strictEqual(r.reward, 1);
  assert.strictEqual(r.done, true);
});

test("dealer stands on exactly 17", () => {
  const env = new E.BlackjackEnv(cardRng([10, 9, 10, 7]));
  env.reset();                       // player 19, dealer 17
  const r = env.step(0);
  assert.strictEqual(env.dealer.length, 2); // no extra draw
  assert.strictEqual(r.reward, 1);          // 19 beats 17
});

test("push returns reward 0", () => {
  const env = new E.BlackjackEnv(cardRng([10, 10, 10, 10]));
  env.reset();                       // 20 vs 20
  assert.strictEqual(env.step(0).reward, 0);
});

test("natural blackjack win pays 1.5", () => {
  const env = new E.BlackjackEnv(cardRng([1, 10, 10, 7]));
  env.reset();                       // player natural 21, dealer 17
  assert.strictEqual(env.step(0).reward, 1.5);
});

test("natural vs dealer 21 (3 cards) still wins 1.5 (Gymnasium cmp on 21 vs 21 is 0)", () => {
  // player natural 21 vs dealer 21 -> cmp = 0 -> push, no 1.5 (matches Gymnasium)
  const env = new E.BlackjackEnv(cardRng([1, 10, 10, 5, 6]));
  env.reset();                       // dealer 15, draws 6 -> 21
  assert.strictEqual(env.step(0).reward, 0);
});

test("step after done throws", () => {
  const env = new E.BlackjackEnv(cardRng([10, 10, 10, 10]));
  env.reset();
  env.step(0);
  assert.throws(() => env.step(0));
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
```

- [ ] **Step 2: Run to verify it fails** — `node blackjack/test/engine.test.js` → expect `Cannot find module '../js/engine.js'`.
- [ ] **Step 3: Implement** — full content of `blackjack/js/engine.js`:

```js
/* Blackjack engine — faithful port of Gymnasium Blackjack-v1
 * (gymnasium/envs/toy_text/blackjack.py), natural=True, sab=False.
 * Actions: 1 = Hit, 0 = Stick. No DOM access. */
const BlackjackEngine = (() => {
  const DECK = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10, 10];

  const drawCard = (rng) => DECK[Math.floor(rng() * DECK.length)];
  const drawHand = (rng) => [drawCard(rng), drawCard(rng)];
  const rawSum = (hand) => hand.reduce((a, b) => a + b, 0);
  const usableAce = (hand) => hand.includes(1) && rawSum(hand) + 10 <= 21;
  const sumHand = (hand) => rawSum(hand) + (usableAce(hand) ? 10 : 0);
  const isBust = (hand) => sumHand(hand) > 21;
  const score = (hand) => (isBust(hand) ? 0 : sumHand(hand));
  const isNatural = (hand) =>
    hand.length === 2 && hand.includes(1) && hand.includes(10);
  const cmp = (a, b) => (a > b) - (a < b);

  class BlackjackEnv {
    constructor(rng = Math.random) {
      this.rng = rng;
      this.done = true;
    }
    reset() {
      this.player = drawHand(this.rng);
      this.dealer = drawHand(this.rng);
      this.done = false;
      return this.obs();
    }
    obs() {
      return [sumHand(this.player), this.dealer[0], usableAce(this.player)];
    }
    step(action) {
      if (this.done) throw new Error("episode finished - call reset()");
      let reward = 0;
      if (action === 1) {
        this.player.push(drawCard(this.rng));
        if (isBust(this.player)) {
          this.done = true;
          reward = -1;
        }
      } else {
        this.done = true;
        while (sumHand(this.dealer) < 17) this.dealer.push(drawCard(this.rng));
        reward = cmp(score(this.player), score(this.dealer));
        if (isNatural(this.player) && reward === 1) reward = 1.5;
      }
      return { obs: this.obs(), reward, done: this.done };
    }
  }

  return { DECK, drawCard, drawHand, usableAce, sumHand, isBust, score, isNatural, BlackjackEnv };
})();
if (typeof module !== "undefined" && module.exports) module.exports = BlackjackEngine;
```

- [ ] **Step 4: Run to verify pass** — `node blackjack/test/engine.test.js` → all tests `ok`, exit 0.
- [ ] **Step 5: Commit** — `git add blackjack && git commit -m "feat(blackjack): Gymnasium-faithful engine with tests"`

---

### Task 3: Blackjack Q-learning agent (TDD)

**Files:**
- Test: `blackjack/test/ai.test.js`
- Create: `blackjack/js/ai.js`

- [ ] **Step 1: Write the failing test** — full content of `blackjack/test/ai.test.js`:

```js
const assert = require("assert");
const E = require("../js/engine.js");
const A = require("../js/ai.js");

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("ok -", name); }
  catch (err) { failed++; console.error("FAIL -", name, "\n  ", err.message); }
}

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("greedy action picks argmax Q", () => {
  const agent = new A.QAgent({ epsilon: 0, rng: mulberry32(1) });
  const obs = [15, 10, false];
  agent.q[agent.key(obs)] = [0.5, -0.2]; // stick better than hit
  assert.strictEqual(agent.act(obs, true), 0);
});

test("update moves Q toward target", () => {
  const agent = new A.QAgent({ alpha: 0.5, gamma: 1, rng: mulberry32(1) });
  const obs = [15, 10, false];
  agent.update(obs, 1, -1, null, true);
  assert.strictEqual(agent.q[agent.key(obs)][1], -0.5); // 0 + 0.5*(-1 - 0)
});

test("trained agent beats always-hit and roughly matches basic strategy EV", () => {
  const rng = mulberry32(42);
  const agent = new A.QAgent({ rng });
  const env = new E.BlackjackEnv(rng);
  agent.train(env, 200000);

  // evaluate greedy policy
  let total = 0;
  const N = 20000;
  for (let i = 0; i < N; i++) {
    let obs = env.reset(), done = false;
    while (!done) {
      const r = env.step(agent.act(obs, true));
      obs = r.obs; done = r.done; total += r.reward;
    }
  }
  const ev = total / N;
  // optimal basic-strategy EV in this env is about -0.05; always-hit is about -0.65
  assert.ok(ev > -0.15, `trained EV too low: ${ev}`);
});

test("agent learns to stand on 20", () => {
  const rng = mulberry32(7);
  const agent = new A.QAgent({ rng });
  agent.train(new E.BlackjackEnv(rng), 200000);
  assert.strictEqual(agent.act([20, 10, false], true), 0);
  assert.strictEqual(agent.act([20, 6, false], true), 0);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
```

- [ ] **Step 2: Run to verify it fails** — `node blackjack/test/ai.test.js` → `Cannot find module '../js/ai.js'`.
- [ ] **Step 3: Implement** — full content of `blackjack/js/ai.js`:

```js
/* Tabular Q-learning agent for Blackjack. State = "sum|dealer|ace". No DOM. */
const BlackjackAI = (() => {
  class QAgent {
    constructor({ alpha = 0.02, gamma = 1.0, epsilon = 1.0, epsilonMin = 0.01, rng = Math.random } = {}) {
      this.alpha = alpha;
      this.gamma = gamma;
      this.epsilon = epsilon;
      this.epsilonMin = epsilonMin;
      this.rng = rng;
      this.q = {}; // key -> [qStick, qHit]
      this.trainedEpisodes = 0;
    }
    key(obs) { return obs[0] + "|" + obs[1] + "|" + (obs[2] ? 1 : 0); }
    values(obs) {
      const k = this.key(obs);
      if (!this.q[k]) this.q[k] = [0, 0];
      return this.q[k];
    }
    act(obs, greedy = false) {
      if (!greedy && this.rng() < this.epsilon) return this.rng() < 0.5 ? 1 : 0;
      const v = this.values(obs);
      return v[1] > v[0] ? 1 : 0;
    }
    update(obs, action, reward, nextObs, done) {
      const v = this.values(obs);
      const nextMax = done ? 0 : Math.max(...this.values(nextObs));
      v[action] += this.alpha * (reward + this.gamma * nextMax - v[action]);
    }
    /* Train n episodes; epsilon decays linearly to epsilonMin across them. */
    train(env, episodes) {
      const epsStart = this.epsilon;
      for (let ep = 0; ep < episodes; ep++) {
        this.epsilon = Math.max(this.epsilonMin, epsStart * (1 - ep / episodes));
        let obs = env.reset(), done = false;
        while (!done) {
          const action = this.act(obs);
          const r = env.step(action);
          this.update(obs, action, r.reward, r.obs, r.done);
          obs = r.obs; done = r.done;
        }
        this.trainedEpisodes++;
      }
      this.epsilon = this.epsilonMin;
    }
  }
  return { QAgent };
})();
if (typeof module !== "undefined" && module.exports) module.exports = BlackjackAI;
```

- [ ] **Step 4: Run to verify pass** — `node blackjack/test/ai.test.js` → all `ok` (the 200k-episode tests take a few seconds).
- [ ] **Step 5: Commit** — `git add blackjack && git commit -m "feat(blackjack): Q-learning agent with tests"`

---

### Task 4: Blackjack UI + art (frontend-design skill)

**Files:**
- Create: `blackjack/index.html`, `blackjack/css/style.css`, `blackjack/js/ui.js`

This task is creative; the implementer MUST apply the frontend-design skill for a distinctive, production-grade casino look (deep felt table, hand-crafted inline-SVG cards, chip animations, deal/flip transitions). Functional contract (non-negotiable):

- [ ] **Step 1: Build the UI implementing this contract:**
  - Loads scripts as classic scripts in order: `js/engine.js`, `js/ai.js`, `js/ui.js`. Works from `file://` (no modules, no fetch, no external images).
  - **Betting:** bankroll starts at 1000 chips, persisted in `localStorage` key `gamesel.blackjack.bankroll`; chip buttons 5/25/100/500 add to current bet, plus clear-bet; Deal button locked until bet ≥ 5; "reset bankroll" control appears when bankroll < 5.
  - **Round flow:** Deal → player Hit/Stand using `BlackjackEngine.BlackjackEnv` exactly (one env per round; UI never re-implements rules). Dealer's second card renders face-down until the player stands or the round ends. Payouts: win +bet, natural win +1.5×bet, push 0, loss −bet.
  - **Card rendering:** engine card values 1→A, 2–9 literal, 10→ display face chosen randomly from {10,J,Q,K} with a random suit at deal time (display only — never affects engine values). Cards are inline SVG, no image files.
  - **Status displays:** player sum (with "soft" indicator when usable ace), dealer showing card; end-of-round banner (Win / Lose / Push / Blackjack!) with chip delta.
  - **AI demo panel:** "Train AI" button trains `BlackjackAI.QAgent` (≥100,000 episodes, run in chunks via `setTimeout`/`requestAnimationFrame` so a progress bar can update); after training, "AI plays" toggle makes the agent play animated rounds automatically (its Hit/Stand choice shown as a badge before each action); a small policy readout shows the agent's recommended action for the player's current hand even in manual play ("AI khuyên: Hit/Stand").
  - Vietnamese UI labels (the user is Vietnamese): e.g. Chia bài / Rút (Hit) / Dừng (Stand) / Cược / Thắng / Thua / Hòa / Xì dách!.
  - Keyboard: H = hit, S = stand, Enter = deal.
- [ ] **Step 2: Verify** — open `blackjack/index.html` in a browser; play a full round manually; train AI; watch AI play 3+ rounds. No console errors.
- [ ] **Step 3: Commit** — `git add blackjack && git commit -m "feat(blackjack): casino UI with AI demo"`

---

### Task 5: FrozenLake engine (TDD)

**Files:**
- Test: `frozenlake/test/engine.test.js`
- Create: `frozenlake/js/engine.js`

- [ ] **Step 1: Write the failing test** — full content of `frozenlake/test/engine.test.js`:

```js
const assert = require("assert");
const E = require("../js/engine.js");

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("ok -", name); }
  catch (err) { failed++; console.error("FAIL -", name, "\n  ", err.message); }
}

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("default map is 6x6 with 1 S, 1 G, 8 H, 26 F", () => {
  const m = E.MAP_6X6;
  assert.strictEqual(m.length, 6);
  m.forEach((row) => assert.strictEqual(row.length, 6));
  const all = m.join("");
  const count = (ch) => all.split(ch).length - 1;
  assert.strictEqual(count("S"), 1);
  assert.strictEqual(count("G"), 1);
  assert.strictEqual(count("H"), 8);
  assert.strictEqual(count("F"), 26);
});

test("a safe path S->G exists (BFS)", () => {
  const m = E.MAP_6X6;
  const n = 6;
  const start = 0;
  const seen = new Set([start]);
  const queue = [start];
  let found = false;
  while (queue.length) {
    const s = queue.shift();
    const r = Math.floor(s / n), c = s % n;
    if (m[r][c] === "G") { found = true; break; }
    if (m[r][c] === "H") continue;
    [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].forEach(([nr, nc]) => {
      if (nr >= 0 && nr < n && nc >= 0 && nc < n && !seen.has(nr * n + nc)) {
        seen.add(nr * n + nc);
        queue.push(nr * n + nc);
      }
    });
  }
  assert.ok(found, "no safe path from S to G");
});

test("reset returns start state 0", () => {
  const env = new E.FrozenLakeEnv({ slippery: false });
  assert.strictEqual(env.reset(), 0);
});

test("deterministic moves and edge clamping", () => {
  const env = new E.FrozenLakeEnv({ slippery: false });
  env.reset();
  assert.strictEqual(env.step(E.UP).state, 0);    // off-grid: stay
  assert.strictEqual(env.step(E.LEFT).state, 0);  // off-grid: stay
  assert.strictEqual(env.step(E.RIGHT).state, 1); // (0,0)->(0,1)
  assert.strictEqual(env.step(E.DOWN).state, 7);  // (0,1)->(1,1)
});

test("stepping into a hole terminates with reward 0", () => {
  const env = new E.FrozenLakeEnv({ slippery: false });
  env.reset();
  env.step(E.RIGHT); env.step(E.RIGHT); env.step(E.RIGHT); // state 3
  const r = env.step(E.RIGHT);                              // state 4 = H
  assert.strictEqual(r.state, 4);
  assert.strictEqual(r.reward, 0);
  assert.strictEqual(r.done, true);
});

test("reaching the goal gives reward 1", () => {
  const env = new E.FrozenLakeEnv({ slippery: false });
  env.reset();
  // verified safe walk: R,D(stay col1? no) — use explicit path:
  // (0,0)->(0,1)->(1,1)->(1,0)->(2,0)->(3,0)->(3,1)->(3,2)->(4,2)->(4,3)->(5,3)->(5,4)->(5,5)
  const path = [E.RIGHT, E.DOWN, E.LEFT, E.DOWN, E.DOWN, E.RIGHT, E.RIGHT, E.DOWN, E.RIGHT, E.DOWN, E.RIGHT, E.RIGHT];
  let r;
  for (const a of path) r = env.step(a);
  assert.strictEqual(r.state, 35);
  assert.strictEqual(r.reward, 1);
  assert.strictEqual(r.done, true);
});

test("step after done throws", () => {
  const env = new E.FrozenLakeEnv({ slippery: false });
  env.reset();
  env.step(E.RIGHT); env.step(E.RIGHT); env.step(E.RIGHT); env.step(E.RIGHT); // hole
  assert.throws(() => env.step(E.LEFT));
});

test("slippery: actual direction is intended or perpendicular, ~1/3 each", () => {
  const rng = mulberry32(123);
  const env = new E.FrozenLakeEnv({ slippery: true, rng });
  const counts = { 0: 0, 1: 0, 2: 0, 3: 0 };
  const N = 9000;
  for (let i = 0; i < N; i++) {
    env.reset();
    const r = env.step(E.RIGHT); // intended RIGHT(2); perpendiculars DOWN(1), UP(3)
    counts[r.actualAction]++;
  }
  assert.strictEqual(counts[E.LEFT], 0); // opposite never happens
  [E.DOWN, E.RIGHT, E.UP].forEach((a) => {
    assert.ok(Math.abs(counts[a] - N / 3) < N * 0.05, `direction ${a}: ${counts[a]}`);
  });
});

test("non-slippery: actualAction always equals chosen action", () => {
  const env = new E.FrozenLakeEnv({ slippery: false });
  env.reset();
  assert.strictEqual(env.step(E.RIGHT).actualAction, E.RIGHT);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
```

- [ ] **Step 2: Run to verify it fails** — `node frozenlake/test/engine.test.js` → `Cannot find module '../js/engine.js'`.
- [ ] **Step 3: Implement** — full content of `frozenlake/js/engine.js`:

```js
/* FrozenLake engine — faithful port of Gymnasium FrozenLake-v1
 * (gymnasium/envs/toy_text/frozen_lake.py) on a custom 6x6 map.
 * Actions: 0=LEFT, 1=DOWN, 2=RIGHT, 3=UP. States: row*6+col. No DOM. */
const FrozenLakeEngine = (() => {
  const LEFT = 0, DOWN = 1, RIGHT = 2, UP = 3;

  // Custom 6x6 map (8 holes, multiple safe paths; BFS-verified in tests)
  const MAP_6X6 = [
    "SFFFHF",
    "FFHFFF",
    "FHFFHF",
    "FFFHFF",
    "HFFFFH",
    "FHFFFG",
  ];

  class FrozenLakeEnv {
    constructor({ map = MAP_6X6, slippery = true, rng = Math.random } = {}) {
      this.map = map;
      this.nrow = map.length;
      this.ncol = map[0].length;
      this.slippery = slippery;
      this.rng = rng;
      this.done = true;
      this.startState = map.join("").indexOf("S");
    }
    get nStates() { return this.nrow * this.ncol; }
    tile(state) {
      return this.map[Math.floor(state / this.ncol)][state % this.ncol];
    }
    reset() {
      this.state = this.startState;
      this.done = false;
      return this.state;
    }
    /* Gymnasium slippery physics: intended dir 1/3, each perpendicular 1/3. */
    step(action) {
      if (this.done) throw new Error("episode finished - call reset()");
      let actual = action;
      if (this.slippery) {
        const r = this.rng();
        if (r < 1 / 3) actual = (action - 1 + 4) % 4;
        else if (r >= 2 / 3) actual = (action + 1) % 4;
      }
      let row = Math.floor(this.state / this.ncol);
      let col = this.state % this.ncol;
      if (actual === LEFT) col = Math.max(col - 1, 0);
      else if (actual === DOWN) row = Math.min(row + 1, this.nrow - 1);
      else if (actual === RIGHT) col = Math.min(col + 1, this.ncol - 1);
      else if (actual === UP) row = Math.max(row - 1, 0);
      this.state = row * this.ncol + col;
      const t = this.tile(this.state);
      const reward = t === "G" ? 1 : 0;
      this.done = t === "G" || t === "H";
      return { state: this.state, reward, done: this.done, actualAction: actual };
    }
  }

  return { LEFT, DOWN, RIGHT, UP, MAP_6X6, FrozenLakeEnv };
})();
if (typeof module !== "undefined" && module.exports) module.exports = FrozenLakeEngine;
```

- [ ] **Step 4: Run to verify pass** — `node frozenlake/test/engine.test.js` → all `ok`, exit 0.
- [ ] **Step 5: Commit** — `git add frozenlake && git commit -m "feat(frozenlake): 6x6 Gymnasium-faithful engine with tests"`

---

### Task 6: FrozenLake Q-learning agent (TDD)

**Files:**
- Test: `frozenlake/test/ai.test.js`
- Create: `frozenlake/js/ai.js`

- [ ] **Step 1: Write the failing test** — full content of `frozenlake/test/ai.test.js`:

```js
const assert = require("assert");
const E = require("../js/engine.js");
const A = require("../js/ai.js");

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("ok -", name); }
  catch (err) { failed++; console.error("FAIL -", name, "\n  ", err.message); }
}

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("q-table sized states x 4, starts at zero", () => {
  const agent = new A.QAgent({ nStates: 36, rng: mulberry32(1) });
  assert.strictEqual(agent.q.length, 36);
  assert.deepStrictEqual(agent.q[0], [0, 0, 0, 0]);
});

test("update moves Q toward target", () => {
  const agent = new A.QAgent({ nStates: 36, alpha: 0.5, gamma: 0.9, rng: mulberry32(1) });
  agent.q[5] = [0, 0, 1, 0];
  agent.update(4, 2, 0, 5, false); // target = 0 + 0.9*1
  assert.ok(Math.abs(agent.q[4][2] - 0.45) < 1e-9);
});

test("non-slippery: trained greedy policy reaches the goal", () => {
  const rng = mulberry32(99);
  const env = new E.FrozenLakeEnv({ slippery: false, rng });
  const agent = new A.QAgent({ nStates: env.nStates, rng });
  agent.train(env, 5000);

  let s = env.reset(), done = false, reward = 0, steps = 0;
  while (!done && steps < 100) {
    const r = env.step(agent.act(s, true));
    s = r.state; done = r.done; reward = r.reward; steps++;
  }
  assert.strictEqual(reward, 1, "greedy policy failed to reach goal");
});

test("slippery: trained policy succeeds well above random baseline", () => {
  const rng = mulberry32(7);
  const env = new E.FrozenLakeEnv({ slippery: true, rng });
  const agent = new A.QAgent({ nStates: env.nStates, rng });
  agent.train(env, 30000);

  let wins = 0;
  const N = 2000;
  for (let i = 0; i < N; i++) {
    let s = env.reset(), done = false, steps = 0;
    while (!done && steps < 200) {
      const r = env.step(agent.act(s, true));
      s = r.state; done = r.done; steps++;
      if (r.reward === 1) wins++;
    }
  }
  // random walk on this 6x6 slippery map wins <2%; trained should be far better
  assert.ok(wins / N > 0.15, `slippery win rate too low: ${wins / N}`);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
```

- [ ] **Step 2: Run to verify it fails** — `node frozenlake/test/ai.test.js` → `Cannot find module '../js/ai.js'`.
- [ ] **Step 3: Implement** — full content of `frozenlake/js/ai.js`:

```js
/* Tabular Q-learning agent for FrozenLake (array Q-table, states x 4 actions).
 * Same algorithm family as moripiri/Reinforcement-Learning-on-FrozenLake. No DOM. */
const FrozenLakeAI = (() => {
  class QAgent {
    constructor({ nStates = 36, alpha = 0.1, gamma = 0.99, epsilon = 1.0, epsilonMin = 0.05, rng = Math.random } = {}) {
      this.nStates = nStates;
      this.alpha = alpha;
      this.gamma = gamma;
      this.epsilon = epsilon;
      this.epsilonMin = epsilonMin;
      this.rng = rng;
      this.q = Array.from({ length: nStates }, () => [0, 0, 0, 0]);
      this.trainedEpisodes = 0;
      this.recentResults = []; // 1 = win, 0 = loss; capped at 500 for success-rate UI
    }
    act(state, greedy = false) {
      if (!greedy && this.rng() < this.epsilon) return Math.floor(this.rng() * 4);
      const v = this.q[state];
      // random tie-break so untrained agent doesn't always pick LEFT
      let best = [0];
      for (let a = 1; a < 4; a++) {
        if (v[a] > v[best[0]]) best = [a];
        else if (v[a] === v[best[0]]) best.push(a);
      }
      return best[Math.floor(this.rng() * best.length)];
    }
    update(s, a, reward, s2, done) {
      const nextMax = done ? 0 : Math.max(...this.q[s2]);
      this.q[s][a] += this.alpha * (reward + this.gamma * nextMax - this.q[s][a]);
    }
    /* Train n episodes (callable repeatedly in chunks for progress UIs).
     * Epsilon decays multiplicatively per episode toward epsilonMin. */
    train(env, episodes, maxSteps = 200) {
      for (let ep = 0; ep < episodes; ep++) {
        let s = env.reset(), done = false, steps = 0, won = 0;
        while (!done && steps < maxSteps) {
          const a = this.act(s);
          const r = env.step(a);
          this.update(s, a, r.reward, r.state, r.done);
          if (r.reward === 1) won = 1;
          s = r.state; done = r.done; steps++;
        }
        this.epsilon = Math.max(this.epsilonMin, this.epsilon * 0.9995);
        this.trainedEpisodes++;
        this.recentResults.push(won);
        if (this.recentResults.length > 500) this.recentResults.shift();
      }
    }
    successRate() {
      if (!this.recentResults.length) return 0;
      return this.recentResults.reduce((a, b) => a + b, 0) / this.recentResults.length;
    }
    bestAction(state) { return this.act(state, true); }
    stateValue(state) { return Math.max(...this.q[state]); }
  }
  return { QAgent };
})();
if (typeof module !== "undefined" && module.exports) module.exports = FrozenLakeAI;
```

- [ ] **Step 4: Run to verify pass** — `node frozenlake/test/ai.test.js` → all `ok`.
- [ ] **Step 5: Commit** — `git add frozenlake && git commit -m "feat(frozenlake): Q-learning agent with tests"`

---

### Task 7: FrozenLake UI + art (frontend-design skill)

**Files:**
- Create: `frozenlake/index.html`, `frozenlake/css/style.css`, `frozenlake/js/ui.js`

Creative task; implementer MUST apply the frontend-design skill for a distinctive winter/ice look matching Gymnasium's imagery (elf character, cracked-ice holes, gift box goal, tile sheen, fall-in + victory animations). Functional contract (non-negotiable):

- [ ] **Step 1: Build the UI implementing this contract:**
  - Classic scripts in order: `js/engine.js`, `js/ai.js`, `js/ui.js`. Works from `file://` (no modules, no fetch, no external images; all art inline SVG/CSS).
  - **Board:** 6x6 grid rendered from `FrozenLakeEngine.MAP_6X6` (never hard-code tiles in UI); elf sprite stands on current state; smooth move animation between tiles; fall-into-hole animation; goal celebration animation.
  - **Controls:** Arrow keys + WASD + on-screen D-pad (4 buttons, Gymnasium order internally). Reset button. Slippery toggle (default OFF for humans); when ON and `actualAction !== chosenAction`, show a clear "trượt!" (slipped!) indicator and animate the actual direction.
  - **HUD:** step counter, wins/losses this session, result banner (thắng = reach gift, thua = fall in hole) with replay button.
  - **AI panel (Q-learning demo):** "Huấn luyện AI" button trains `FrozenLakeAI.QAgent` on a headless env with the CURRENT slippery setting — non-slippery ≥5,000 episodes, slippery ≥30,000, chunked via `setTimeout`/`requestAnimationFrame` with progress (episodes done, success rate from `agent.successRate()`); Q-value overlay toggle paints each safe tile with best-action arrow (`agent.bestAction`) and heat color scaled by `agent.stateValue`; "AI chơi" button animates the trained agent playing on the visible board step by step.
  - Retraining resets the agent when the slippery setting changed since last training.
  - Vietnamese UI labels.
- [ ] **Step 2: Verify** — open `frozenlake/index.html`; reach the goal manually (non-slippery); fall in a hole; toggle slippery and observe slips; train AI; enable Q overlay; watch AI win. No console errors.
- [ ] **Step 3: Commit** — `git add frozenlake && git commit -m "feat(frozenlake): 6x6 winter UI with Q-learning demo"`

---

### Task 8: Final verification + README

**Files:**
- Create: `README.md` (how to play both games, one paragraph each, Vietnamese)

- [ ] **Step 1:** Run all four test files; all pass:
  `node blackjack/test/engine.test.js; node blackjack/test/ai.test.js; node frozenlake/test/engine.test.js; node frozenlake/test/ai.test.js`
- [ ] **Step 2:** Browser smoke-test both games per Task 4/7 verify steps (or closest available automation).
- [ ] **Step 3:** Write `README.md`, commit: `git add . && git commit -m "docs: README"`

---

## Self-review notes

- Spec coverage: engine fidelity (Tasks 2, 5), chip layer + AI demos + art (Tasks 4, 7), 6x6 map + slippery toggle (Tasks 5, 7), tests (Tasks 2, 3, 5, 6, 8). README added for usability.
- Action conventions, natural-payout edge case (natural vs dealer 21 → push), edge clamping, and slippery perpendicular rule are all pinned by tests.
- UI tasks intentionally specify contracts, not pixel-level code: visual design is produced at execution time under the frontend-design skill, which is the point of "claude design" art.
