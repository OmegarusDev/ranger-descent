# Enemy Roster — Full Design

## Core Families (Early Game)

### Slime Family
- **Slime** — HP 10, basic enemy, lurches forward
- **Large Slime** — HP 30, splits into 2 Slimes on death
- **Huge Slime** — HP 60, splits into 2 Large Slimes

### Goblin Family
- **Goblin Runt** — HP 8, fast, dodges side to side
- **Goblin Warrior** — HP 18, slower, tankier, heavier dodges
- **Goblin Chieftain** — HP 40, slow but devastating

### Spider Family (floor 1+)
- **Spider** — HP 6, fast, small, might poison
- **Giant Spider** — HP 25, larger, more poison damage
- **Spider Queen** — BOSS, summons spiders, venomous

---

## Undead Family (floor 3+)

### Undead Tier List (weakest → strongest)
1. **Ghoul** — HP 15, slow, basic melee
2. **Wight** — HP 30, stronger ghoul, hits harder
3. **Wraith** — HP 18, incorporeal, takes NO physical damage (needs magic/elemental arrows)
4. **Vampire** — HP 35, drains health on hit
5. **Vampire Lord** — HP 60, stronger vampire, faster
6. **Lich** — HP 50, ranged magic + summons minions

### Undead Bosses
- **Death Knight** — HP 250, heavy armor, charges
- **Lich King** — HP 300, summons waves of undead
- **Dread Lord** — HP 280, drains life, powerful magic

---

## Skeleton Family (floor 3+)
- **Skeleton** — HP 50, slow melee warrior
- **Skeleton Archer** — HP 25, stops at range, fires bone arrows
- **Hauler** — HP 80, massive skeleton, slow but devastating

---

## Bat (floor 2+, replaces Flyer)
- **Bat** — HP 6, very fast, tiny, might poison, goes straight for you

---

## Elemental Family (floor 5+)
- **Imp** — HP 10, fire elemental, fast
- **Scamp** — HP 18, ice elemental, slows you
- **Demon** — HP 45, powerful fire/ice, larger

---

## Orc Family (floor 6+)
- **Orc** — HP 35, strong melee
- **Ogre** — HP 70, very strong, slow
- **Troll** — HP 50, regenerates health

---

## Boss Roster

### Elevator Bosses (every 10 waves)
- **Floor 10** — Mini-boss (scaled-up regular enemy)
- **Floor 20** — Mini-boss
- **Floor 30** — Mini-boss
- **Floor 40** — Mini-boss
- **Floor 50** — Mini-boss
- **Floor 60** — Mini-boss
- **Floor 70** — Mini-boss
- **Floor 80** — Mini-boss
- **Floor 90** — Mini-boss
- **Floor 100** — FINAL BOSS

### Unique Bosses
- **Death Knight** — Undead warrior, heavy armor
- **Lich King** — Undead mage, summons army
- **Dread Lord** — Undead lord, life drain
- **Spider Queen** — Spider matriarch, venomous
- **Demon Lord** — Elemental fire boss
- **Orc Warlord** — Orc boss, brutal melee

---

## Enemy Spawn Progression

| Floor | Enemies Available |
|-------|-------------------|
| 1-2   | Slime, Goblin Runt, Spider, Bat |
| 3-4   | + Large Slime, Goblin Warrior, Skeleton, Ghoul |
| 5-6   | + Imp, Giant Spider, Wight, Orc |
| 7-8   | + Skeleton Archer, Vampire, Ogre |
| 9-9   | + Huge Slime, Goblin Chieftain, Hauler, Wraith |
| 10    | BOSS (Death Knight or similar) |
| 11-14 | + Vampire Lord, Lich, Troll |
| 15+   | All regular enemies, bosses appear |

---

## Notes
- Wraith takes NO physical damage — must use elemental arrows
- Lich is ranged + summoner (fires magic, spawns minions)
- Spider Queen can be a floor 50 or floor 100 boss
- Vampire family drains health on hit
- Elementals weak to opposite element (fire ↔ ice)
- Undead weak to holy/positive energy
- Orcs are pure physical, no resistances
