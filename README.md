<p align="center">
  <a href="https://omegarusdev.github.io/ranger-descent/" style="display:inline-block;padding:16px 52px;font:bold 26px sans-serif;color:#fff;background:#1f9d2f;border-radius:12px;text-decoration:none;">▶ PLAY RANGER'S DESCENT</a>
</p>
<p align="center">
  <a href="https://omegarusdev.github.io/ranger-descent/">
    <img src="https://img.shields.io/badge/▶_PLAY_NOW-playable_in_browser-brightgreen?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Play Now" height="40" />
  </a>
</p>
<p align="center"><strong>Installable PWA.</strong> On Android Chrome: Open site → menu → <em>Install app</em> / Add to Home screen. It updates itself each time you open it (when online).</p>

# Ranger's Descent

A roguelite dungeon crawler with on-rails corridor combat. You are the last Ranger — an archer bound to an endless descent through a shifting dungeon. Slingshot arrows at waves of enemies, navigate branching corridors, and grow stronger with every run.

## Install (WebAPK / home screen)

1. Open [the live game](https://omegarusdev.github.io/ranger-descent/) in **Chrome** (Android) or Safari (iOS).
2. **Android:** browser menu → **Install app** / **Add to Home screen** — Chrome builds a lightweight WebAPK.
3. **iOS:** Share → **Add to Home Screen**.
4. Each cold open checks the live site for a new build and reloads onto it when online.

## Features

- **On-rails corridor combat** — aim and fire arrows in real time while the dungeon scrolls forward
- **Slingshot aiming** — pull back to charge, release to fire. Pull opposite to your target direction
- **Roguelite progression** — earn souls, unlock upgrades, and push deeper each run
- **Branching dungeons** — choose your path at junctions. Every corridor has different enemies
- **Deep equipment system** — 13 armour materials × 6 quality tiers across head, body, and feet slots
- **Quiver management** — collect and manage arrows, swap between normal and elemental types
- **23+ enemy types** — from slimes and goblins to vampires, liches, and boss encounters

## Controls

- **Drag** to aim (slingshot — pull back opposite to fire direction)
- **Release** to fire an arrow
- **Click** junction choices to select your path

## How to play

1. **Hub** — spend souls on training upgrades, buy arrows and armour in the shop, equip your loadout
2. **Descent** — fight through waves of enemies in a scrolling corridor
3. **Junction** — choose left, right, or forward. Each path has different enemies and rewards
4. **Death** — return to the hub with earned souls. Upgrade, re-equip, try again

## Run locally

No build step required — vanilla HTML/CSS/ES modules.

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000` in your browser.

## Development

- `src/engine/` — rendering engine, camera, 2.5D primitives (no game imports allowed)
- `src/game/` — simulation, enemies, quiver, progression
- `src/data/` — config constants
- `docs/GDD.md` — full game design document
- `docs/ENEMY-ROSTER.md` — enemy type reference

## Links

- [Game Design Document](docs/GDD.md)
- [Enemy Roster](docs/ENEMY-ROSTER.md)
