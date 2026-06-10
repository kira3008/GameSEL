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
