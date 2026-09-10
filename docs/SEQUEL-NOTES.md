# Sequel / later-concept notes

Ideas shelved for this Ranger Descent iteration. Not in the live build.

## Floor alchemy (substrate)

Earlier prototypes tracked corridor **floor tiles** (oil, moss, water, ice, fire, …) and reacted when elemental arrows hit them — e.g. fire on oil → AoE blast, ice on water → freeze.

That system was removed from this build: portrait hall combat doesn’t support deliberate floor aiming, and finishing it properly wants **3D aim** (pick a point on the ground / depth), which is also shelved for this concept pass.

Worth revisiting in a sequel (or a later mode) if aiming expands beyond the current slingshot lane.

## Magic (hexes & prayers)

**DORMANT BY DESIGN.** `AutoMagicSystem`, `hexUnlock`, and `prayerUnlock`
stay in code for a dedicated future Magic patch. They are not clutter, are not
part of ordinary runs, and must not be integrated during the current cleanup.
This is unrelated to floor alchemy.
