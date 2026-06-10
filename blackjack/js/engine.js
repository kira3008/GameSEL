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
