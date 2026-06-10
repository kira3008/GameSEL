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
  // safe walk: (0,0)->(0,1)->(1,1)->(1,0)->(2,0)->(3,0)->(3,1)->(3,2)->(4,2)->(4,3)->(5,3)->(5,4)->(5,5)
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
