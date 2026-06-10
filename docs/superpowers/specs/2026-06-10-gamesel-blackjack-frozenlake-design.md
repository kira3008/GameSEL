# GameSEL — Blackjack & FrozenLake 6x6 Design

**Date:** 2026-06-10
**Status:** Approved by user

## Overview

Two standalone browser games, each in its own folder, with game logic faithful to
[Gymnasium](https://gymnasium.farama.org/) toy-text environments and an in-browser
Q-learning AI demo in the spirit of
[moripiri/Reinforcement-Learning-on-FrozenLake](https://github.com/moripiri/Reinforcement-Learning-on-FrozenLake).
No build step, no server, no dependencies — opening `index.html` plays the game.

User decisions (all confirmed):
- **Tech:** Pure web (HTML/CSS/JS), no Python backend.
- **Mode:** Human player is primary; each game has an AI demo (Q-learning trained in-browser).
- **FrozenLake slippery:** toggle on/off in the UI (off = deterministic, on = Gymnasium default physics).
- **Blackjack rules:** Gymnasium `Blackjack-v1` core logic + a chip/betting layer (start 1,000 chips, natural pays 3:2).

## Directory layout

```
GameSEL/
├── blackjack/
│   ├── index.html
│   ├── css/style.css
│   └── js/engine.js   # pure Gymnasium Blackjack-v1 logic, no DOM
│       js/ai.js       # tabular Q-learning agent, no DOM
│       js/ui.js       # rendering, animation, input
│   └── test/engine.test.js   # node test/engine.test.js
└── frozenlake/
    ├── index.html
    ├── css/style.css
    └── js/engine.js   # 6x6 FrozenLake environment, no DOM
        js/ai.js       # tabular Q-learning agent, no DOM
        js/ui.js       # rendering, animation, input
    └── test/engine.test.js
```

Engines are pure ES modules (state in, state out, injectable RNG) so they are testable
with plain Node (`node test/engine.test.js`, no framework) and reusable by both the UI
and the AI trainer.

## Game 1 — Blackjack

### Engine (Gymnasium Blackjack-v1 fidelity)

- Infinite deck: draw uniformly from `[1,2,3,4,5,6,7,8,9,10,10,10,10]` with replacement
  (1 = Ace; 10 covers 10/J/Q/K — UI may render a random face for tens).
- `usableAce(hand)`: hand contains 1 and `sum(hand) + 10 <= 21`.
- `sumHand(hand)`: raw sum, +10 if usable ace.
- Player action **Hit**: draw a card; bust (>21) ends round with reward −1.
- Player action **Stand**: dealer draws while `sumHand(dealer) < 17`; reward is
  `cmp(score(player), score(dealer))` → +1 / −1 / 0.
- **Natural** (first two cards = Ace + ten-card) winning pays 1.5 (Gymnasium `natural=True`).
- Observation tuple for the AI: `(playerSum, dealerShowing, usableAce)`.

### Chip layer (on top of the engine, not inside it)

- Start with 1,000 chips. Bet before each round (chip denominations 5/25/100/500).
- Win pays 1:1, natural pays 3:2, push returns the bet, loss forfeits it.
- Bankroll persists via `localStorage`; "reset bankroll" available when broke.

### AI demo

- Tabular Q-learning over observation states (playerSum 4–21 × dealerShowing 1–10 × usableAce),
  epsilon-greedy with decay; trains tens of thousands of episodes headless in well under a second.
- "AI plays" mode: trained agent plays animated rounds; UI shows the agent's
  Hit/Stand decision per state (optionally the learned policy chart).

### Art direction

Luxurious casino: deep felt table, hand-crafted SVG playing cards, chip stack
animations, card-deal/flip transitions. Built with the frontend-design skill.

## Game 2 — FrozenLake 6x6

### Engine (Gymnasium FrozenLake fidelity, upscaled map)

- 6x6 custom map (repo's default is 4x4; this project upsizes per user request):

  ```
  S F F F H F
  F F H F F F
  F H F F H F
  F F F H F F
  H F F F F H
  F H F F F G
  ```

  8 holes (22% density), at least two distinct safe paths S→G (BFS-verified in tests).
- Actions: 0=Left, 1=Down, 2=Right, 3=Up (Gymnasium order).
- Moving off-grid keeps the agent in place.
- **Slippery on** (Gymnasium `is_slippery=True`): intended direction executes with 1/3
  probability, each perpendicular direction 1/3 each.
- **Slippery off**: deterministic movement.
- Reward 1.0 on reaching G; episode ends on H (lose) or G (win).

### Controls

Arrow keys / WASD plus on-screen D-pad buttons. Slippery toggle in the UI.

### AI demo (spirit of the reference repo)

- Tabular Q-learning (36 states × 4 actions), epsilon-greedy with decay — the repo's
  core algorithm, on the bigger map.
- Train button runs episodes headless with progress (episode count, success rate).
- Q-value visualization on the board: per-tile best-action arrows and value heat
  coloring, so the learned policy is visible.
- "AI plays" mode animates the trained agent walking to the goal.

### Art direction

Winter/ice theme matching Gymnasium's imagery: elf character, cracked-ice holes,
gift box at the goal, frozen-lake tile sheen, fall-in and victory animations.
Built with the frontend-design skill.

## Testing / success criteria

- `node blackjack/test/engine.test.js` and `node frozenlake/test/engine.test.js` pass:
  dealer-draws-to-17 rule, usable-ace accounting, natural payout, bust detection,
  cmp rewards; map validity (BFS path exists, correct tile counts), off-grid clamping,
  slippery distribution (seeded RNG, ≈1/3 each over many samples), terminal states.
- Each game is playable start-to-finish by opening its `index.html` in a browser.
- AI demo in each game reaches a sensible policy (FrozenLake non-slippery: trained
  agent reaches goal reliably; Blackjack: policy approximates basic strategy).

## Non-goals

- No real Gymnasium/Python runtime, no server, no build tooling.
- No Double Down / Split / Insurance in Blackjack.
- No map editor or alternative map sizes beyond the fixed 6x6.
