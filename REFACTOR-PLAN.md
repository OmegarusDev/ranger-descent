# Corridor System Refactor Plan — COMPLETED

## Summary of Changes

### Phase 1: Core Coordinate System (CorridorSim.js)
- **Player gets real world position**: `playerWorldX` (lateral) and `playerWorldZ` (forward)
- **Enemies get absolute `worldZ`**: Instead of relative `dist`, enemies now have absolute world positions
- **Relative distance computed each tick**: `relDist = e.worldZ - this.playerWorldZ`
- **Player auto-advances**: `playerWorldZ += PLAYER_SPEED` each tick
- **All behavior code updated**: Uses `e.worldZ` for movement, `relDist` for distance checks

### Phase 2: Wave Sections + Segment Generation
- **SEGMENT_LENGTH = 800**: Each wave section is ~800 world units (one screen height)
- **Enemies placed at absolute positions**: Spawned between `playerWorldZ + 200` and `segmentEndZ - 50`
- **Pre-placed enemies**: Enemies are positioned along the segment before the wave starts
- **Wave clears when all enemies dead**: Or player reaches end of segment

### Phase 3: Junction System
- **Dynamic junction choices**: 1-3 directions (forward, left, right)
- **Enemy type labels**: Each direction shows what enemies are there
- **Camera rotation**: Smooth 0.3s rotation when choosing non-forward direction
- **Junction overlay**: Dynamic UI with enemy type labels

### Phase 4: Visual Polish + Floor Scrolling
- **Floor scrolling**: Grid offset by `playerWorldZ % cellSize` creates movement illusion
- **Torch scrolling**: Torches shift position relative to player
- **Enemy size increases**: All enemies ~20% larger for better visibility

## Files Modified

### CorridorSim.js (Complete Rewrite)
- Added `playerWorldX`, `playerWorldZ`, `segmentIndex`, `segmentStartZ`, `segmentEndZ`
- Added `junctionChoices`, `junctionPending`, `turnAngle`, `turnTarget`, `turning`
- Rewrote `createEnemy()` to use `worldZ` instead of `dist`
- Rewrote `_tickEnemies()` to compute relative distance each frame
- Added `_showJunction()`, `_pickJunctionEnemies()`, `chooseJunction()`, `turnComplete()`, `_advanceSegment()`
- Updated `_startWave()` to place enemies at absolute positions
- Updated all projectile systems to use absolute `worldZ`
- Updated `getAllEntities()` to compute relative depths

### main.js (Junction + Rendering Updates)
- Removed old bend/junction state variables
- Added `showJunctionOverlay()` with dynamic button generation
- Updated `drawCorridorStraight()` with floor scrolling via `scrollOffset`
- Removed unused `drawCorridorPath()` function
- Removed unused corridor path imports
- Updated junction overlay CSS classes

### index.html (Junction UI)
- Simplified junction overlay to flex-based layout
- Added CSS classes for junction buttons and title

## Key Metrics

| Metric | Value |
|--------|-------|
| Segment Length | 800 world units |
| Player Speed | 4.5 units/frame (270 units/sec) |
| Time per Segment | ~3 seconds |
| Enemies per Segment | 3-8 (scales with wave) |
| Turn Duration | ~0.3 seconds |
| Enemy Size Increase | ~20% larger |

## How It Works Now

1. **Run starts**: Player at `worldZ = 0`, segment from 0 to 800
2. **Wave begins**: Enemies placed at absolute positions between 200 and 750
3. **Player advances**: Floor scrolls under player as `worldZ` increases
4. **Enemies approach**: Each enemy's `worldZ` decreases toward player
5. **Combat**: Arrows fly, enemies take damage, status effects apply
6. **Wave ends**: All enemies dead or player reaches segment end
7. **Junction appears**: Show choices with enemy type labels
8. **Player chooses**: Direction determines camera rotation and next segment
9. **New segment**: `segmentStartZ = playerWorldZ`, `segmentEndZ = playerWorldZ + 800`
10. **Repeat**: New wave begins in new segment

## What Was Removed

- Old bend/junction system (bends array, corridorPath, etc.)
- drawCorridorPath() function (curved corridor rendering)
- corridorPath.js imports in main.js (still used by engine)
- Old junction overlay HTML (replaced with dynamic generation)

## What Works

✅ Player physically moves through corridor (floor scrolling)  
✅ Enemies placed at absolute positions along segment  
✅ Junction system with enemy type labels  
✅ Camera rotation at junctions  
✅ All enemy behaviors updated for new coordinate system  
✅ Projectile systems updated  
✅ Auto-magic system updated  
✅ Enemy size increased for visibility
