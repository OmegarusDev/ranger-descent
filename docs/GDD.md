# Ranger Descent — Game Design Document (archived)

> **Archived.** This document lags the live game. Prefer the running code under `src/` and the README for current behavior. Kept for historical design notes.

## Overview

Ranger Descent is a roguelite dungeon crawler with on-rails corridor combat. The player stays centered on screen while the dungeon scrolls toward them. Enemies approach in waves, arrows fly via slingshot, and the corridor bends and forks as you descend deeper. Between runs, spend coin to upgrade stats and equipment.

**Genre:** Roguelite dungeon crawler / corridor action  
**Platform:** Web (HTML5 Canvas)  
**Perspective:** 2.5D, player-centered corridor

---

## Core Loop

1. **Descend** through a 10-section dungeon (100 floors total)
2. **Fight** waves of enemies using slingshot arrows
3. **Die** or **reach an elevator** (every 10 floors)
4. **Bank souls** earned from kills
5. **Upgrade** stats at the hub (exponential cost scaling)
6. **Unlock** companions, classes, and equipment
7. **Repeat** — each run goes a little further

The game is intentionally punishing at the start: 10 HP, 1 damage arrows, enemies with 10 HP that hit for 4. Progress comes from dying, upgrading, and trying again.

---

## Player

### Stats

| Stat | Effect |
|------|--------|
| **DMG** | Arrow damage (base 1) |
| **SPD** | Attack speed / cooldown reduction |
| **HP** | Maximum health (base 10) |
| **Crit** | Critical hit chance (%) |

Armor comes from equipment, not stats.

### HP System

- Player has 10 HP at start
- Enemies deal 4 damage per hit (first enemy type)
- Contact damage: enemies that reach the player deal damage
- No extra lives at launch (unlockable later)

### Classes

| Class | Attack Type | Description |
|-------|-------------|-------------|
| **Ranger** | Slingshot arrows | Drag-and-release aiming, elemental arrow deck |
| **Swordsman** | Auto-melee swipe | Auto-attacks when enemies enter range, cooldown-based |

- **Ranger** is available from the start
- **Swordsman** is unlocked by beating the final boss
- Future classes: Mage, Summoner (planned, not implemented yet)

### Ranger Mechanics

- **Slingshot:** Drag to aim, release to fire. Direction and power from drag vector.
- **Arrow Deck:** 20-card deck, 4-card HUD queue. Draw, shuffle, level up, fuse.
- **Arrow Types:** normal, fire, oil, moss, poison, ice, piercing (7 base types)
- **Fusion:** Two Lvl 5 arrows → compound arrow (10 recipes)
- **Spell Slots:** 2 active ability slots (future: elemental spells)

### Swordsman Mechanics

- **Auto-attack:** When enemy enters melee range and within front cone, auto-swipe
- **Cooldown:** Affected by DEX stat and weapon weight
- **Weapon Types:** dagger (fast), sword (balanced), greatsword (slow, heavy), axe (medium)
- **Weapon Quality:** +damage, +dex bonus, special effects

---

## Companions

### Overview

Companions are NPCs found during runs. They fight alongside you, have their own HP, and can be unlocked permanently through a sacrifice mechanic.

### Companion Types

| Type | HP | Damage | Interval | Range | Special |
|------|-----|--------|----------|-------|---------|
| **Warrior** | 30 | 3 | 2.5s | 4 | Block (15%), Taunt, Party Phys Up |
| **Mage** | 20 | 5 | 3.0s | 9 | AoE Blast, fire element |
| **Rogue** | 25 | 2 | 1.2s | 5 | +20% soul drops |

### Finding Companions

- 5% chance per floor to find a companion
- Never on the first floor of a section
- When found: companion appears with entrance animation, joins party
- First companion found is always Warrior (then Mage, then Rogue)

### Companion Combat

- Auto-attack nearest enemy within range every `interval` seconds
- Projectiles use `ownerId: "companion"` for damage calculation
- Companion damage scales with player DMG upgrades

### Companion Abilities (Warrior)

- **Block (Passive):** 15% chance to block incoming player damage, reduced by 50%
  - Affected by character sheet stats and equipped shield
- **Taunt (Active):** All enemies within range retarget to warrior for 3 seconds
  - Has cooldown, can be set to auto-fire
- **Party Phys Up (Active):** +25% physical damage to player and companions for 5 seconds
  - Has cooldown, can be set to auto-fire

### Ability Auto-Setting

- Per-ability toggle (ON/OFF) in HUD
- Default: OFF (player must manually activate)
- Settings option to change default to ON
- When ON: ability fires as soon as cooldown is ready

### Companion Loyalty (Elevator Escape)

When reaching an elevator, companions may "escape" (leave your side):

| HP | Leave Chance |
|----|-------------|
| ≥ 40% | 0% (always stay) |
| < 40% | 80% leave |
| < 25% | 90% leave |
| < 10% | 100% leave |

- Regardless of whether they stay or leave, they are **unlocked permanently** for future runs
- Player chooses "Let them go" or "Keep them" — but companion may refuse based on HP
- If kept, they continue fighting for the rest of this run only (not unlocked yet)

### Companion Progression

- Companions have their own upgrade tree (future feature)
- Equipment affects companion stats (shield for warrior, etc.)
- Companion slots: 1 at start, upgradeable to 2

---

## Dungeon Structure

### Sections & Elevators

- **10 sections**, each containing **10 floors**
- **10 elevators** (one at the end of each section)
- Total: **100 floors**

### Floor Progression

- Each floor has 2-3 waves of enemies
- Difficulty scales per-floor and per-elevator
- New enemy types introduced at specific floors
- Old enemy types phased out as sections progress

### Elevator Transitions

1. Clear floor 10 of a section → boss wave (scaled-up enemy)
2. Boss defeated → corridor stops
3. Elevator animation plays
4. Choice screen:
   - "Continue to Section X" (next floor)
   - "Return to Hub" (bank souls, companions may escape)
5. Companion loyalty check if applicable

### Section Enemy Progression

| Section | Floors | New Enemies | Phased Out |
|---------|--------|-------------|------------|
| 1 | 1-10 | Slimes, Goblins → Skeletons (miniboss) | — |
| 2 | 11-20 | Orcs, Wolves | Slimes |
| 3 | 21-30 | Wraiths, Liches | Goblins |
| 4 | 31-40 | Demons, Imps | Wolves |
| 5 | 41-50 | Elementals, Golems | Orcs |
| 6 | 51-60 | Dark Knights, Necromancers | Skeletons |
| 7 | 61-70 | Dragons, Wyverns | Wraiths |
| 8 | 71-80 | Aberrations, Beholders | Imps |
| 9 | 81-90 | Fiends, Pit Lords | Elementals |
| 10 | 91-100 | Final Boss + unique enemies | All previous |

### Minibosses

- Appear at floor 10 of each section (before elevator)
- Scaled-up regular enemy: 5x HP, 2x damage
- Introduces new enemy type for that section

---

## Enemy Types

### Section 1: Slimes & Goblins

| Type | HP | DMG | Speed | Size | Souls | Behavior |
|------|-----|-----|-------|------|-------|----------|
| Slime | 10 | 4 | 80 | 0.8 | 1 | advance |
| Goblin | 8 | 3 | 120 | 0.6 | 1 | swarm |
| Goblin Shaman | 12 | 5 | 60 | 0.7 | 2 | hover (ranged) |
| Goblin King (miniboss) | 50 | 8 | 50 | 1.5 | 10 | charge |

### Difficulty Scaling

- Per-floor: +10% HP/damage per floor within section
- Per-elevator: +50% HP/damage at section transitions
- Non-linear: enemy type mix also affects difficulty

---

## Souls & Upgrades

### Souls Per Kill

| Enemy Type | Souls |
|------------|-------|
| Slime | 1 |
| Goblin | 1 |
| Skeleton | 2 |
| Orc | 2 |
| Tougher variants | 3+ |
| Boss kills | 10+ |

### Upgrade Costs (Exponential)

| Upgrade | Base Cost | Multiplier |
|---------|-----------|------------|
| +1 DMG | 10 souls | x1.8 per level |
| +1 SPD | 12 souls | x1.8 per level |
| +5 HP | 15 souls | x1.8 per level |
| +2% Crit | 20 souls | x1.8 per level |
| +1 Companion Slot | 50 souls | x2.0 |

---

## Corridor & Camera

### Coordinate System

- Player at origin (0, 0) always centered on screen
- `worldX`: lateral offset (pixels, + = right)
- `dist`: distance ahead of player (pixels, + = further away)
- Enemies spawn at `dist = SPAWN_DIST` (350px), approach player (dist decreases)
- Arrows fire forward (dist increases) with lateral component

### Perspective Projection

- `scale = K / (K + dist)` (K = 800)
- `screenX = playerScreenX + worldX * scale`
- `screenY = playerScreenY - dist * scale * VScale`
- VScale = 0.45

### Corridor Turns

- Corridor bends smoothly using Chaikin subdivision
- Bends occur between waves (30% chance, increases with depth)
- Bend types: left 30°, right 30°, S-curve
- Bend radius: 500px
- Camera rotates smoothly, player stays centered

### Junctions

- T-junction: corridor splits left and right
- Y-split: corridor forks at ~30° angles
- Player chooses direction via arrow buttons on screen
- Both branches visible at junction point

---

## Meta-Progression

### Persistent Upgrades

- Player stats (DMG, SPD, HP, Crit levels)
- Companion slots (1 → 2)
- Unlocked companions
- Unlocked classes
- Highest floor reached
- Total souls earned

### Save System

- localStorage persistence
- Auto-save on: run end, elevator transition, hub visit
- No cloud save (web game)

### Hub Screen

- Class selector (if multiple unlocked)
- Companion loadout (drag into slots)
- Upgrade shop (spend souls on stat boosts)
- "Begin Run" button
- Stats display (highest floor, total kills, total souls)

---

## Controls

### Ranger (Slingshot)

- **Drag** to aim (direction = fire direction)
- **Release** to fire arrow
- **Power** scales with drag distance
- No keyboard required (touch-friendly)

### Swordsman (Future)

- **Tap** to attack (auto-targets nearest enemy in cone)
- No drag needed
- Cooldown-based

### UI Buttons

- **Junction arrows:** Tap left/right at forks
- **Ability buttons:** Tap to activate (or set to auto)
- **Spell slots:** 2 active ability slots

---

## Technical Architecture

### Engine Boundary

- `src/engine/` must NEVER import from `src/game/`
- Engine provides: rendering, camera, input, particles, drawing utilities
- Game provides: sim logic, state management, entity definitions

### Key Files

| File | Purpose |
|------|---------|
| `src/engine/corridorCamera.js` | Perspective projection, path-based turns |
| `src/engine/corridorPath.js` | Chaikin subdivision, path walking |
| `src/engine/RenderEngine2D5.js` | Canvas rendering pipeline |
| `src/engine/prims25.js` | 2.5D primitives (boxes, cylinders) |
| `src/engine/drawUtil.js` | Color/geometry helpers |
| `src/engine/fx.js` | Particle VFX system |
| `src/game/CorridorSim.js` | Main simulation loop |
| `src/game/GameStateManager.js` | Phase state machine, souls, upgrades |
| `src/game/CompanionManager.js` | Companion definitions, AI, formation |
| `src/game/ElevatorManager.js` | Floor/elevator tracking |
| `src/game/QuiverDeckManager.js` | Arrow deck, queue, fusion |
| `src/game/AutoMagicSystem.js` | Hexes and prayers (dormant until Magic patch) |
| ~~`src/game/SubstrateGrid.js`~~ | Removed — see `docs/SEQUEL-NOTES.md` (floor alchemy / 3D aim) |
| `src/game/InputHandler.js` | Slingshot + melee input |
| `src/game/SaveManager.js` | localStorage persistence |
| `src/data/config.js` | Tunable constants |
| `src/data/classDefs.js` | Player class definitions |
| `src/main.js` | Entry point, game loop, rendering |

### Coordinate Rules

- All positions relative to player at origin
- Enemy `dist` decreases as they approach
- Projectile `dist` increases as they fly forward
- Camera projection handles perspective transform
- Depth sort by `dist` value

---

## Future Features (Post-Launch)

- Extra lives (unlockable via meta-progression)
- Mage player class (AoE spells, crowd control)
- Summoner player class (turrets, minions)
- Equipment system (weapons, shields, armor)
- Companion upgrade tree
- Additional elevator types (shop, rest area)
- Daily challenge runs
- Leaderboards
