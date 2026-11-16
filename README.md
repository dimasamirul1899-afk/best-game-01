[![best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/competitions/best-game-01)
[![rank](https://make.fun/badge/best-game-01/dimasamirul1899-afk/best-game-01/rank.svg)](https://make.fun/competitions/best-game-01)
[![reward](https://make.fun/badge/best-game-01/dimasamirul1899-afk/best-game-01/reward.svg)](https://make.fun/competitions/best-game-01)

# best-game-01 — NEON VOID

A twin-stick neon arena shooter, built entirely in code — no assets, no
network. Entry for the [best-game-01 competition on make.fun](https://make.fun/competitions/best-game-01).

WASD to move, mouse to aim, hold click or Space to fire. Waves of chasers,
weavers, splitters, minis and shooters; combo multiplier, shield / spread /
rapid / nova-bomb pickups, particles and screen shake, WebAudio synth.
3 lives, best score in localStorage. Title, pause and game-over screens.

Deterministic screenshot modes for judging: `?shot=start|play|end&seed=N`.

```sh
node serve.ts --port 8080   # then open http://localhost:8080
# or: python3 -m http.server --directory game
```

`main.ts` copies `game/` and `screenshots/` to `/output` and writes
`dossier.json` via the kit's `buildDossier`.

## License

MIT — see [LICENSE](LICENSE).
