# UI Refinement Plan — LearnUs Connect

Scope: refine the existing visual language. Not a redesign, not a re-identity.
No new dependencies, no component API changes, no navigation changes.

---

## What the first attempt got wrong

It treated "modern and clean" as license to replace the app's identity: a new
typeface, icon tiles deleted, section headers rebuilt, rows restructured into
grouped lists. That is an overhaul, and it threw away things that were working.

**The icons stay.** The tinted icon tiles on rows, section headers, and stat items
are part of how this app reads, and they make screens scannable at a glance. They are
not the problem.

**What was actually right in that attempt:** removing the heavy shadows. That single
change made the app look current without touching its personality. This plan is built
around that insight — change the *qualities* of the existing elements, not the elements
themselves.

---

## Principle

Every item below has to pass one test: *does this change how the app looks, without
changing what the app is?* If a change would make a returning user feel like they
opened a different app, it does not belong here.

---

## 1. Elevation — the main change

The soft 16–32px blur shadows under every card are the single most dated thing in the
UI, and they are why everything reads at the same visual level.

- Cards keep their shape and their border, and lose the drop shadow.
- Separation comes from the existing 1px border, which is already there.
- One shadow survives, for things that genuinely float: the tab bar, modals, action
  sheets, and toasts. That shadow gets tightened to y2 / blur 8 / 6%.

This is confirmed to look right — it was visible in the emulator before the revert.

## 2. Corner radius

20px on cards reads soft and slightly dated. Drop card radius to **14**; sheets and
modals to **16**; pills stay full. Icon tiles keep their proportional radius so they
still look like the same component, just slightly crisper.

## 3. Typography — tighten, don't replace

**No new font.** The system stack stays.

The current scale has almost nothing between 15 and 18px, so headings, row titles and
body text all read at one weight. Tighten the existing steps so hierarchy comes through:

- Screen titles stay 28/700.
- Section headers 18/600 (unchanged).
- Row titles 16/600 — currently 15, slightly too close to the metadata.
- Metadata and captions 13/500 with a clear tertiary color.

Numbers in the stat row get `tabular-nums` so they stop shifting width as they change.

## 4. Color — trim the unused, keep the identity

The blue identity stays exactly as it is. The palette just stops carrying vocabulary
the app never uses:

- Remove the five gradient presets, the glass surfaces, and `primaryGlow` — nothing
  reads them today except one or two dead references.
- Keep `accent` / `secondary` / `tertiary` and the course color set. They are used, and
  the course colors are what make the Courses screen legible.
- One fix with real meaning: on the stat row, `0 놓친 과제` currently renders in green
  as loudly as `1 놓친 강의` renders in red. A zero count should be neutral — nothing is
  wrong, so nothing should be colored. Only a non-zero missed count stays red.

## 5. Spacing

Card padding and section gaps are inconsistent because each screen re-declares them.
Normalize to the existing `Spacing` scale — 16 card padding, 24 between sections,
20 screen gutter — without changing any layout structure.

## 6. Two real display bugs

These are user-visible defects the redesign happened to surface, worth fixing on their
own merit:

- **Raw ISO timestamps.** Home shows `2026-08-19T04:39:02.106Z 마감`. A small
  `formatDeadline()` helper renders "3일 남음" / "오늘 23:59 마감" instead. Confirmed
  working before the revert.
- **`ID: 7001` on course rows.** An internal Moodle id shown to students. Remove the
  line; the course name is the identifier that matters. (The colored bar and book icon
  on those cards **stay** — they were fine.)

## 7. Out of scope

Icon tiles, section header structure, row layout, the card-per-row pattern, the tab
bar's active pill, custom fonts, grouped list components, and anything that changes
navigation or information architecture.

---

## Order of work

1. Elevation + radius in `constants/theme.ts` — the single highest-impact step, and
   verifiable in the emulator immediately.
2. Type scale tightening in the same file.
3. Palette trim (dead tokens only) + the zero-count color fix.
4. Spacing normalization pass across screens.
5. The two display bugs.

Each step verified in the emulator in demo mode, light and dark, before the next.

Steps 1–3 are theme-only and touch no screen files, so they are trivially revertible if
the direction is still wrong.
