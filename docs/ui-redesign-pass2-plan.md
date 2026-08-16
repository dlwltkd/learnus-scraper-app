# UI redesign — pass 2

Follow-up to `ui-refinement-plan.md` (shipped as 0.6.2). That pass fixed the
*surface* language: shadows, radius, type scale. This pass fixes the *symbol*
language, which drifted further while the course-brain screens were built.

Same constraints as before: no behaviour changes, no flashy work, no icon purge
for its own sake. Refine what is there.

## What the emulator shows

Captured on `Medium_Phone_API_36.1`, light mode, real account (8 courses,
컴퓨팅연구개론 fully built).

| Screen | State |
|---|---|
| Dashboard | 0.6.2 surfaces holding. Three decorative icon tiles. |
| 내 강의실 | Same 📖 glyph in all 8 rows. |
| Course detail | Same 💬 glyph 4× in one group. Three card treatments. |
| Library | **Correct.** Monochrome glyphs that discriminate. |
| Brain chat | Clean, but copy defects and a dead zone. |

## The core finding

The app is running **two icon languages at once**, and they mean opposite things.

**Language A — decorative tile** (older screens). A rounded square filled with a
tinted background, holding a filled multicolour glyph. It sits next to a label
that already says the same thing: a clipboard beside 과제/퀴즈, a video camera
beside 놓친 강의, a calendar beside 다가오는 과제, a book beside every course, a
speech bubble beside every board.

**Language B — bare discriminator** (library screen). A single-weight monochrome
line glyph, no tile, no colour. 💬 for a board row, 📄 for a file row, sitting in
a mixed list where the glyph is the fastest way to tell one row's *kind* from
its neighbour's.

Language B is right and Language A is the drift. The rule we already agreed on:

> An icon earns its place when it distinguishes siblings, not when it echoes
> the container.

Language A fails that test every time it appears. The proof is on the course
detail screen: the two cards with **no icon at all** — 강의 자료 둘러보기 and
강의 브레인에게 질문하기 — are the cleanest, most readable elements on the
screen, and they are the two most important actions.

So: converge on Language B. This removes decoration without removing a single
icon that carries meaning, which is exactly the line drawn in the earlier
rejection ("icons are good").

## Changes

### 1. Retire the decorative tile

Drop the tinted tile + multicolour glyph wherever the glyph repeats across
siblings or restates its own label.

- **Courses list** — remove the book tile. The colour already lives in the top
  accent bar; the tile duplicates it and the glyph is identical in all 8 rows.
  Row becomes: accent bar, name, chevron.
- **Course detail, 게시판 group** — remove the three 💬 tiles and the header's
  💬 tile. Board titles already read as boards.
- **Dashboard section headers** — remove the tiles beside AI 브리핑 and
  다가오는 과제. A header is already a header.
- **Keep**: the tab bar (icons are the only label at that size), status glyphs
  (✓ 완료), and every library glyph.

### 2. Stop dimming items the brain has not learned

Library rows for items outside the corpus are greyed out
(`Class Files / 아직 학습 안 됨`). Dimming reads as *disabled*, but the file
opens and reads perfectly well — only the brain's knowledge of it is missing.

Corrected while implementing: the flag is `in_corpus`, not "studied by the user",
so a full inversion would have been wrong. The fix is narrower — the title keeps
full weight, and the existing caption carries the state on its own.

### 3. One card treatment per screen

Course detail currently shows three: white standalone (nav cards), white grouped
with dividers (게시판), grey filled (VOD rows). Standardise on white grouped with
dividers for lists; keep standalone white only for the two nav actions, which are
deliberately distinct.

### 4. Dashboard stat hierarchy

`이번 주 학습 현황` puts label above number. Numbers are the content; they should
lead. Swap to number-then-label, matching the course detail stat card, which
already does it correctly.

### 5. Copy defects

- Brain chat suggestion leaks a raw Moodle section title into a Korean sentence:
  `Week 8 [20 October - 26 October]에는 뭘 배웠나요?` → `8주차에는 뭘 배웠나요?`
  (reuse `shortenWeek()`, already written for the library).
- Brain chat header says `자료 28 · 강의 12 · 과제 7 기준으로 답해요` but the
  body below says 공지 are included too. Add 공지 to the header count.
- Library header totals disagree: `자료 28 · 강의 12 · 과제 7 · 공지 13` (60)
  against `49/50개 학습됨`. Make the denominator the same set it counts.
- Course detail VOD rows repeat the course name, which is the screen title.

### 6. Token drift

`DashboardScreen.tsx` carries 23 raw `borderRadius` and 23 raw `fontSize`
literals that bypass the theme, which is why it drifts first every time. Move
them onto `layout.radius` / `typography`.

## Out of scope

Cross-screen navigation changes, the empty-state void on the brain chat (needs a
product decision about what belongs there), dark mode beyond verifying parity,
and anything touching the corpus or backend.

## Verification

Emulator pass over all five screens, before/after, plus a re-check that no icon
removed was carrying information a sibling did not.

## Outcome

Net −67 lines, no new colour literals, `tsc` clean. Measured on device:

- **Courses** — all 8 rows now fit without scrolling (was ~7 with the last cut off).
- **Dashboard** — one more assignment row above the fold.
- **Library** — header arithmetic now resolves: `28 + 12 + 7 + 3 = 50`, matching
  the `49/50` denominator below it. Previously the 공지 figure counted posts (13)
  while the denominator counted boards, so the numbers could not be reconciled.
- **Chat** — `Week 8 [20 October - 26 October]에는 뭘 배웠나요?` now reads
  `8주차에는 뭘 배웠나요?`.

Two things deliberately **not** changed after looking at them on device:

- **Plan item 3 (one card treatment).** The grey filled row and the white grouped
  row turned out to encode a real distinction — items carrying status (완료,
  overdue) versus plain navigation lists — and it holds consistently on both the
  dashboard and course detail. Flattening them would have removed information.
- **Dark mode.** The app's theme is an explicit stored preference rather than a
  system follow, so `cmd uimode night yes` does not exercise it. Since every edit
  here removed colour usage and added none, parity is unaffected; verified by
  diffing for new literals rather than by screenshot.

## Still open

`DashboardScreen.tsx` still carries ~23 raw `fontSize` and ~23 raw `borderRadius`
literals that bypass the theme (plan item 6). Left for a separate pass: it is a
mechanical change across a 1,668-line file and does not belong in a commit about
the symbol language.
