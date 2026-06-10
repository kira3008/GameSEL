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
