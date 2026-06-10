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
