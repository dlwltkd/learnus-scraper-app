# AI briefing — designing the detail sheet

The cards were refined in 0.6.2 and again in pass 2. The sheet they open was not, so
tapping a card crosses from the current design language into the old one. But restyling
it is not enough: the sheet's structure is what makes it feel empty and generic, and that
is worth fixing first.

Captured on `Medium_Phone_API_36.1`, light mode, real account.

## What is actually wrong

**Two languages.** The card is flat with a hairline border, one accent, no decorative
icons. The sheet lifts off the page with `shadow.lg`, and carries four accent colours and
four icon tiles — a green status tile, then red, amber and indigo section tiles, then a
purple box. On top of a dashboard that has none of that.

**The structure assumes content that usually is not there.** 긴급 and 예정 and 공지사항
each render their header whether or not they hold anything. On a calm week that is three
coloured icons over three grey apologies. The sheet is longest in ceremony exactly when it
has least to say.

**Urgency is encoded twice.** Items are split into 긴급 and 예정, and then each item
carries a due badge saying 오늘 / D-1 / D-3. The split is a threshold the student did not
choose, expressing the same axis the badge already expresses precisely.

**The status is stated four times.** Card badge, card chip, sheet tile, sheet text.

## The organising idea

> **The sheet should be as long as the week is busy.**

A calm course should produce a short sheet — that emptiness is information, and it should
be felt as brevity rather than narrated as three "없어요" lines. A heavy week should
produce a long one. Length becomes the signal you read before any words.

Everything below follows from that.

## Structure

Sections render only when they hold something. There are no empty-state rows.

```
┌────────────────────────────────────────┐
│ 인공지능개론                     [여유] │  name + the same badge the card used
│ 여유로운 한 주예요!                     │  the model's one-line verdict
├────────────────────────────────────────┤
│ 할 일                                   │  ← only if there are items
│ ┌────────────────────────────────────┐ │
│ │ 📄  Homework 1: Academic CV   D-1 │ │  urgent first, badge carries urgency
│ │ ▶   Lecture 5-2               D-3 │ │
│ └────────────────────────────────────┘ │
│                                         │
│ 공지사항                          NEW   │  ← only if there is one
│ ┌────────────────────────────────────┐ │
│ │ 중간고사 범위가 공지되었어요…       │ │
│ └────────────────────────────────────┘ │
│                                         │
│ AI 코멘트                               │
│ ┌────────────────────────────────────┐ │
│ │ ✨ 여유를 활용해 기초 개념을 …      │ │
│ └────────────────────────────────────┘ │
└────────────────────────────────────────┘
```

On a calm week that collapses to a header and one comment. Three lines, no apologies.

### Why one list instead of 긴급 / 예정

Concatenating urgent then upcoming preserves the ordering the API already produces, so no
date parsing is needed, and the due badge keeps saying precisely what the section split
said approximately. One header disappears, one empty state disappears, and the student
reads a single queue in the order they will actually do it.

### Why the header mirrors the card

Same badge, same status word, same type scale. The sheet should read as the card
expanding, not as a new screen. That continuity is what makes a modal feel like a detail
view rather than a context switch.

### Facts before interpretation

Deadlines are what the student acts on; the AI comment is a read on them. Tasks and
announcements come first, the comment closes. The status line is the exception — it earns
the top because it is a summary, not advice.

## Visual language

Adopt what the rest of the app already uses:

| Element | Treatment |
|---|---|
| Section headers | `typography.overline`, `textTertiary`, no tile — same as the brain settings screen |
| Item lists | grouped surface, hairline border, dividers between rows |
| Item icons | kept: 📄 vs ▶ distinguishes siblings in a mixed list, the library rule |
| Status | the card's badge, reused verbatim |
| AI 코멘트 | standard surface + border; sparkle kept, purple dropped |
| Sheet container | flatten `shadow.lg`; it is the last surface still lifting off the page |

The sparkle **earns its place**: it marks the one block that is model-written rather than
scraped, which is a distinction the student should be able to see. The purple tint does
not — it is a fourth accent introduced for a single element.

## Correctness carried along

- **Dark mode.** Due badges are hardcoded `#FEE2E2` / `#FEF3C7` on `#DC2626` / `#D97706`
  — light-mode pink and cream that stay near-white and glare in dark. Same class of bug
  0.6.2 fixed on the dashboard. Move to `colors.error` / `colors.warning`.
- Also hardcoded: `#EF4444`, `#F59E0B`, `#6366F1`, `rgba(139,92,246,…)`.
- **Token drift.** 10 raw `borderRadius` and 10 raw `fontSize` literals in
  `createModalStyles`.
- **The emoji.** `긴급한 항목이 없어요 👍` is the only emoji in this surface — and it
  disappears with the empty states anyway.

## The card, while we are here

- **Duplicate status.** The badge (top right) and the chip (bottom left) say the same word
  when the counts are zero. Render chips only when they carry a count — `긴급 2` says
  something the badge does not; `여유` does not.
- **The void.** `CARD_HEIGHT` is fixed at 195, so a course with no priority item shows a
  large blank band. Let the status message take that space and keep the footer pinned, so
  the card is calm rather than empty.

## Out of scope

What the model writes — the wording of `status_message` and `insight` — is a prompt
question, not a design one. Worth a separate look: the comment reads generically
("여유를 활용해 기초 개념을 복습해 보세요"), and no layout fixes that.

## Verification

Card and sheet, light and dark, in three states: populated, announcement-only, and fully
calm. The populated state matters most — the due badge findings only appear when there
are items to show, so I will need to force one rather than wait for a busy week.
