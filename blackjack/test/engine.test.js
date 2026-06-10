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

test("natural vs dealer 21 (3 cards) is a push (Gymnasium cmp on 21 vs 21 is 0)", () => {
  const env = new E.BlackjackEnv(cardRng([1, 10, 10, 5, 6]));
  env.reset();                       // player natural 21, dealer 15 -> draws 6 -> 21
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
