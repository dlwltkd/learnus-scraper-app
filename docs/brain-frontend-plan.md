# Course Brain — Frontend Plan

Decisions taken: entry point on **course detail**, build runs **in the background with a
push when ready**, answers carry **tappable citations**, chat is a **full screen**.

---

## 0. Backend prerequisites (this plan depends on them)

The corpus today contains **files only**. Everything else a citation could point at is
either unstored or unassembled:

| source | state | needed for citations |
|---|---|---|
| Lecture files (PDF/ipynb) | ✅ stored with text, week, page markers | ready |
| VOD transcripts | ✅ stored | assemble into corpus |
| Board posts | ✅ `content` stored | assemble into corpus |
| **Assignment bodies** | ❌ only title/due/url | scrape + store |
| **Announcements** | ❌ scraped then discarded, no table | table + store |

So "not just PDFs" is real work, not a rendering detail: two of the five source types
don't exist in the database yet. The frontend below assumes all five, and degrades
cleanly to whatever is present.

---

## 1. Entry point — course detail

A single row under the stats block, above the content sections:

```
┌──────────────────────────────────┐
│  0        0        0             │
│ 동강     과제     게시판           │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│ 강의 브레인에게 질문하기        › │
│ 자료 28 · 강의 12 · 공지 5        │
└──────────────────────────────────┘
```

Three states in the same container, so the row never jumps:

- **Not built** — "브레인 만들기 · 강의 자료를 학습시켜요"
- **Building** — "학습 중… 12/28" with a thin determinate bar
- **Ready** — counts, tappable through to chat

Gated on the Labs toggle: hidden entirely when the brain is off, exactly like the
auto-watch controls.

## 2. Labs toggle

A second switch in 개발자 옵션 beside 자동 시청, wired to a new `brain_enabled` on the
user, following the existing `auto_watch_enabled` pattern end to end. Its subtitle states
the cost honestly — building transcribes lectures and spends API credit — because this
toggle is what authorises that spend.

## 3. Build — background with push

Tapping build enqueues a job and returns immediately with a toast. The row switches to
its building state, polls while the screen is open, and a push arrives on completion.
Reuses the existing job/worker machinery and the notification patterns already in place
for transcription.

Progress is reported as **"n of m 자료"**, never as a time estimate — `vods.duration` is
frequently null, so any minutes-remaining figure would be wrong for some courses.

---

## 4. The chat screen — design

The brief is "modern, clean, AI-like". Concretely that means the answer is the interface
and everything else recedes.

### Message treatment

**Assistant messages have no bubble.** Full-width prose on the page background at 17px
with generous line height — the same way a document reads. Bubbles are a messenger
convention: they imply short conversational turns and actively fight a 200-word grounded
answer with sources.

**User messages are a bubble**, right-aligned, `surfaceMuted`, max 80% width. The
asymmetry is the point: it distinguishes speaker without decorating the assistant's text,
and it's what every current AI product converged on for good reason.

```
                    ┌──────────────────────────┐
                    │ 6주차에서 뭘 배웠어?       │
                    └──────────────────────────┘

  6주차는 셸(shell)과 원격 서버 작업을 다뤘어요.
  기본 명령어와 파이프라인을 먼저 설명하고,
  이어서 SSH로 원격 서버에 접속하는 방법을…

  ┌────────┐ ┌────────┐ ┌────────┐
  │ 6-1 셸 │ │ 6-2 원격│ │ HW2    │
  └────────┘ └────────┘ └────────┘
```

### Streaming

Tokens stream in with a thin caret at the tail. No typing dots, no skeleton — the text
*is* the progress indicator, and dots on top of streaming text is two loading states for
one operation.

### Citations

A horizontal row of compact chips **below** the answer, not inline markers. Inline
footnotes shred Korean prose and force the eye to jump mid-sentence; a row underneath
keeps the answer readable and the sources scannable.

Each chip carries a type glyph and a short label. Tap opens the right thing per type:

| source | chip | tap |
|---|---|---|
| Lecture page | `6-1 셸 p.12` | **renders that page inline** |
| Assignment | `HW2` | assignment detail |
| Announcement / post | `공지 12/05` | post detail |
| VOD transcript | `6-1 강의` | transcript screen |

### Inline slide rendering

Tapping a lecture-page chip expands the rendered page **in place**, as a bordered image
card in the message flow, with the page number and a tap-to-fullscreen affordance. It
does not navigate away — the answer stays on screen beside its evidence, which is the
whole point of citing.

This is why `render_page()` was built as a cache: first tap costs ~1s to rasterise, every
tap after is instant, and the PNGs can be purged without losing anything.

### Empty state

Not a blank screen with a prompt box. Three or four suggested questions **derived from
the actual course** — the weeks that exist, the most recent assignment, an announcement
title — so the first interaction demonstrates what the brain knows rather than asking the
student to guess.

### Header

Course name, and one quiet line of provenance: `자료 28 · 강의 12 · 공지 5`. It tells the
student what the answers are grounded in, which is the honest framing for a thing that
can be wrong.

### Restraint

One accent colour (the existing primary), used for interactive elements only. No
gradients, no glow, no avatar bubbles, no "AI" sparkle iconography beyond the single
entry point. The screen should look like a well-set document that happens to answer back.

---

## 4b. The library — a navigable structure, not just chat

Chat answers questions you know how to ask. A student also needs to *browse* — "where is
the week 6 handout", "what did I miss", "show me every slide deck". So the brain has two
faces behind one entry point:

```
┌──────────────────────────────────┐
│  컴퓨팅연구개론                    │
│  ┌──────────┬──────────┐         │
│  │   대화    │   자료    │         │
│  └──────────┴──────────┘         │
```

A segmented control, not two separate destinations — they are two views of one corpus, and
a citation in chat deep-links straight into the library viewer.

### Structure: by week, because that is what we captured

Every artifact carries `section` + `week`, so the tree builds itself with no extra work:

```
▸ Week 1 [01 Sep – 07 Sep]                      2
    📄  Lecture 1-1: Intro                    25p
    📄  Lecture 1-2: A glimpse of AI/CS       75p

▾ Week 6 [06 Oct – 12 Oct]                      5
    📄  Lecture 6-1: Introduction to Shell    23p
    ▶   Video Lecture 6-1: Intro to Shell   28min  ✓
    ✎   Homework 2: Academic website        ~10/12
    💬  Class Q&A · 3 posts
    ⓘ   이번 주는 퀴즈가 없습니다

▸ Week 8 [20 Oct – 26 Oct]                      9
```

Sections collapse, with a count on the header. Ordered by section index, so it matches the
course page exactly — the student's existing mental model, not a new one.

A secondary **유형별** (by type) grouping is a filter chip row, not a second tree: 전체 /
자료 / 강의 / 과제 / 공지. Same list, different predicate.

### Item rows carry state, not decoration

Each row shows what the student needs to triage: page count for decks, duration and watched
state for videos, due date for assignments, post count for boards. The type glyph is the
one icon, since here it genuinely differentiates siblings — a week mixes decks, videos,
assignments and notices, and the glyph is the fastest way to tell them apart.

Anything not yet in the corpus (an untranscribed lecture, a file that failed extraction)
renders dimmed with a quiet label rather than being hidden. A library that silently omits
things teaches you not to trust it.

### The artifact viewer

Tapping an item opens the thing itself, by type:

| type | viewer |
|---|---|
| PDF | paged view backed by `render_page`, swipe between pages, extracted text available |
| ipynb | rendered markdown + fenced code |
| video | existing VOD flow; transcript beside it when present |
| assignment | instructions, due date, link out to Moodle |
| board / label | the text |

The PDF viewer is where the render cache earns its place a second time: the same
`render_page` endpoint that backs inline chat citations backs page-by-page browsing, so
the two features share one mechanism and one cache.

Every viewer gets one consistent action: **"이 자료에 대해 질문하기"**, which opens chat
pre-scoped to that artifact. Browsing and asking become one loop instead of two features.

### What this needs from the backend

Beyond what exists: a single `GET /courses/{id}/library` returning the week-grouped tree
with per-item type, state and corpus status, plus `GET /files/{id}/page/{n}` for rendered
pages. Both read from tables already populated.

---

## 5. Order of work

1. ~~Backend: assignment bodies + announcements~~ — **done**. Assignment instructions are
   scraped and stored; announcements turned out to already be captured as board posts.
   Folder contents, `resource` files and inline `label` text are now scraped too.
2. Backend: corpus assembly across all source types, with per-item provenance.
3. Backend: `brain_enabled`, build job, status endpoint, chat endpoint (streaming),
   `library` endpoint, `render_page` endpoint.
4. Frontend: Labs toggle → course detail row → **library** → artifact viewers →
   chat screen → citations → inline slides.

The library is deliberately placed before chat in step 4. It reads from data that already
exists, needs no model call, and is the fastest way to see whether the corpus is actually
complete and correctly organised — which is exactly what has to be true before any answer
built on it can be trusted.
