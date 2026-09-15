# Manual Smoke Checklist

Run this checklist against a local build after changes to simulation, saves, or
run UI. Mark each item pass/fail and record the build number.

## Combat

- Start a new run from the hub.
- Fire straight, left, and right shots.
- Confirm cooldown, damage, enemy contact, coins, and arrow recovery behave normally.
- Confirm Twin Shot still fires both projectiles.
- Open the Field bag during active combat and confirm combat continues.
- Confirm the HUD Quick Pouch uses a bound bag item without opening or pausing the bag.
- Confirm wood arrows have no manual discard or snap action.
- Fill the quiver with wood, collect a non-wood arrow, and confirm the wood shaft is replaced and shown as discarded.

## Terminal States

- Die from contact damage and confirm only one death screen appears.
- Confirm no additional coins or loot are awarded after death.
- Complete the final boss and confirm victory banking occurs once.
- Return to the hub and confirm quiver, bag, coins, and stash are reconciled once.

## Elevators

- Reach an elevator checkpoint.
- Confirm the purse is banked and recoverable stash is reconciled.
- Reload at the checkpoint and confirm banked progress is preserved.
- Choose Return to surface and confirm the hub opens with the checkpointed rewards.
- Choose Continue descent and confirm the next block starts normally.
- Verify the final elevator leads to the final boss choice.

## Junctions

- Clear a hall and acknowledge its loot.
- Confirm the junction screen appears only after the approach.
- Confirm the hall report accounts for recovered, stashed, and discarded shafts before Continue.
- Test left, forward, and right choices with touch/click and keyboard input.
- Confirm the selected choice is used without rerolling its encounter.
- Confirm Escape to surface banks the run once.

## Save Reloads

- Reload from the hub with normal equipment and bag data.
- Reload after malformed legacy-like data in a development save fixture.
- Confirm unknown arrow types normalize safely and wood is not stored.
- Confirm invalid elevators and duplicate notebooks normalize safely.
- Confirm ordinary mid-run state is not falsely presented as a resumable run.

## Responsive UI

- Test the hub and Training sheet on a narrow portrait viewport.
- Test the hub and Training sheet on a wide landscape viewport.
- Open each Training `(i)` hint by touch and keyboard.
- Confirm the Bag, Quick Pouch, loot, elevator, and junction overlays have usable buttons.
- From the hub storage chest, sell a loose potion or armour piece and confirm the bow cannot be sold.
- Confirm Loadout starts with 2 bag slots and 1 Quick Pouch slot.
- Confirm Shop Pack lists Bag Slot 3 for ₡100 and Pouch Slot 2 for ₡200.
- After buying the second pouch slot, confirm Pouch Slot 3 is locked until the bag also has 3 slots.
- Confirm the run HUD Quick Pouch matches pouch capacity, and Field bag lists bag slots (not a second pouch).
