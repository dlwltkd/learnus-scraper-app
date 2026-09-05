# Second Pass — What Else Is Worth Changing

Audit of the app after the first refinement commit (`b4d5165`). Same conservative rule
as before: change the *qualities* of what exists, never remove or restructure it. Icons
stay, cards stay, layout stays.

Ranked by value per unit of risk. Every item lists what it touches.

---

## A. The same fact is displayed in two different formats

**Home** now reads `3일 남음`. **동영상 강의** still reads `~ 8/18/2026 마감`. Identical
data, two formats, two screens — and the second one is the format we just decided was
worse. Course detail has a third variant.

This is the most visible remaining inconsistency, and the fix already exists: route the
remaining call sites through `formatDeadline()`.

*Touches:* 3 call sites in `VideoLecturesScreen.tsx`, 1 in `CourseDetailScreen.tsx`.
*Risk:* very low — the helper already ships and is proven on Home.

## B. The app speaks in two voices, sometimes for the same event

The Korean register is split roughly down the middle, and the split is not by context:

| Event | Both forms in use |
|---|---|
| A failure | `실패했습니다` ×3 and `실패했어요` ×2 |
| A save | `저장되었습니다` and `저장되었어요` |

The greeting on Home is `좋은 아침이에요`, and the newer strings lean casual-polite
(`-어요`), so that is the app's actual voice. The formal `-습니다` strings read as
leftovers, and they cluster in error messages — exactly where a friendlier register
helps most.

*Touches:* ~20 string literals across 8 files. No logic.
*Risk:* very low, but it is user-facing copy — worth a skim before merge.

## C. Section headers have two unrelated treatments

- **Dashboard:** 32px tinted rounded icon tile, then the title.
- **동영상 강의:** bare 20px inline icon, then the title.

Same concept, two designs, and they sit one tab apart. Since the icons are staying, the
fix is to pick the tile treatment and apply it to both — this *adds* consistency without
removing anything.

*Touches:* `SectionHeader` in `VideoLecturesScreen.tsx` (and the same local component in
`CourseDetailScreen.tsx`).
*Risk:* low.

## D. Settings icon colors follow no rule

Reading down the list: 언어 purple, 앱 둘러보기 orange, 도움말 green, 피드백 blue,
이용약관 grey, 개인정보 처리방침 grey. Two rows are already neutral, so the palette is
half-abandoned rather than deliberate.

Keeping the tiles, the smallest honest rule is: **color for rows that do something,
neutral for rows that are reference material** (legal, terms, privacy). That is close to
what the screen already does — it just finishes the thought.

*Touches:* the icon color map in `SettingsScreen.tsx`.
*Risk:* low.

## E. Empty states are inconsistent, and italic

Only 2 of the screens with empty states use the shared `EmptyState` component. Board,
the Dashboard AI modal, and Flashcards each roll their own bare grey sentence.

Separately: `EmptyState`, `CourseDetailScreen`'s `InlineEmpty`, and `VodTranscriptScreen`
all set `fontStyle: 'italic'`. Android has no italic Hangul face, so the system
synthesizes an oblique by shearing the glyphs — it looks like a rendering fault rather
than emphasis. Dropping italic is a one-line change per site and a clear improvement.

*Touches:* 4 style declarations, plus routing 3 bare empty states through the existing
component.
*Risk:* low. No new component.

## F. Course detail says its own name twice

The nav bar shows `데이터구조`; the hero card underneath shows `데이터구조` again, then
`0 / 0 / 0` counters for 동강 / 과제 / 게시판 — the same three sections that follow
immediately below with their own headers.

Removing the duplicated title from the hero card is the smallest fix. The counters can
stay; they at least summarize.

*Touches:* one JSX block in `CourseDetailScreen.tsx`.
*Risk:* low.

## G. Hardcoded colors that ignore dark mode — a real bug

`DashboardScreen.tsx` carries 16 hardcoded hex values, and the AI summary's
`STATUS_CONFIG` is the worst of them:

```
calm:   '#10B981'   busy: '#F59E0B'   urgent: '#EF4444'
```

These are baked light-mode values. In dark mode they do not shift, so the AI briefing
cards render their status colors at light-mode saturation against a near-black surface.
`components/Toast.tsx` has the same problem with 5 more.

Pointing them at `colors.success` / `colors.warning` / `colors.error` fixes dark mode and
removes the hardcoding in one step.

*Touches:* `DashboardScreen.tsx`, `components/Toast.tsx`.
*Risk:* low, and it fixes a defect rather than changing a design.

## H. Minor, listed for completeness

- **Row height jitter.** Rows with a subtitle and rows without sit at different heights
  in the same group (visible in Settings and VOD). A `minHeight` on the row would settle
  it.
- **VOD row furniture stacks.** The 마감/완료 badge and the ⋮ button stack vertically,
  making those rows taller than their neighbours.
- **`요약 생성하기`** still reads as an oversized floating pill now that the shadows are
  gone — flagged last time, unchanged.

---

## Suggested order

**Do first — defects and inconsistencies, essentially no design judgment involved:**
A (deadline formats), G (dark-mode colors), E (italic empty states), F (duplicate title).

**Do next — small design decisions, all reversible:**
C (section headers), D (settings icon rule).

**Do only if you want it — user-facing copy:**
B (register). Highest reward for consistency, but it changes words students read, so it
deserves its own review pass.

## Explicitly still out of scope

Icon tiles, card-per-row, the tab bar pill, course color bars, custom fonts, navigation,
information architecture, and any new shared components.
