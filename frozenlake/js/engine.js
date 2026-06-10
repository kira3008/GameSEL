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
