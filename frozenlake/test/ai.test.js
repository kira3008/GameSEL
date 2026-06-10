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
