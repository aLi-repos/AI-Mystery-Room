# MysteryAI — The AI Mystery Room
## Product & Technical Specification (spec.md)

**Status:** REVISED (v0.3) — final specification; Decision Register D1–D11 complete (Section 15.3); awaiting final implementation authorization
**Version:** 0.3
**Date:** 2026-11-01
**Scope of this document:** Specification only. No application code, dependencies, database initialization, or infrastructure has been created.

---

## Document Conventions

This specification separates what the workshop requires from what is recommended by this document.

| Tag | Meaning |
|---|---|
| `[W]` | Requirement stated in or directly implied by the workshop ("Step-by-Step Build Guide — AI Mystery Room"). |
| `[R]` | Recommended improvement added by this specification. Not a workshop requirement; can be descoped without violating the workshop. |

MVP scope is governed by the **Decision Register (Section 15.3)**, which records decisions D1–D11 as approved or deferred (none remain open). Features are additionally marked:

| Tag | Meaning |
|---|---|
| `[MVP]` | In scope for the MVP — locked by the Decision Register. |
| `[DEFERRED]` | Deliberately deferred from the MVP by decision (D5/D6 and related). Design is retained in this document for a later phase; building it now violates agreed scope. |

**MVP in one paragraph:** one complete predefined mystery in the database, played at Easy/Medium/Hard, with server-authoritative progression, deterministic answer validation, timer and scoring, and **AI-generated contextual progressive hints** (Gemini, via a provider-independent adapter) with static fallback so the game stays playable when the AI provider is down.

**Verified workshop content (the only workshop material available):**
- Workshop title: "Step-by-Step Build Guide — AI Mystery Room".
- Workshop phases: 1) Project Overview, 2) Create a Detailed Specification, 3) Set Up the Project, 4) Build the Application, 5) Test and Deploy, 6) Final Submission.
- Product description: an AI-powered interactive mystery / escape-room experience where players solve mysteries, investigate clues, answer puzzles, and progress through different rooms.

No other workshop artifacts (rubrics, deliverable checklists, grading criteria) were available when this document was written. Anything beyond the list above is treated as `[R]` or as an explicit assumption (Section 15).

**Table of contents**

1. Project Overview
2. Core Features
3. User Flows
4. AI Architecture
5. Technical Architecture
6. Database Design
7. API Design
8. UI/UX Requirements
9. Security and Reliability
10. Testing Strategy
11. Deployment Strategy
12. MVP and Future Enhancements
13. Acceptance Criteria
14. Development Roadmap
15. Assumptions, Risks, Decision Register & Consistency Verification
- Appendix A — Workshop Traceability Matrix

> **Decision Register:** all decisions **D1–D11 are resolved** in **Section 15.3** (approved or deferred). **Section 15.4 records that no decisions remain open.**

---

## 1. Project Overview

### 1.1 Project Name `[W]`
**MysteryAI — The AI Mystery Room**

### 1.2 Project Type `[W]`
AI-powered interactive mystery escape-room **web application**. Single-player for the MVP; played in the browser.

### 1.3 Problem Statement `[R]`
Escape-room and mystery games are engaging but static: existing web mystery games ship a fixed set of hand-written rooms, so replay value collapses after a player finishes the available content. Writing new, well-balanced mystery content is expensive and slow. At the same time, raw LLM chatbots are open-ended but lack game structure — no timer, no scoring, no validated progression, no sense of "winning."

MysteryAI addresses both gaps: it uses generative AI to add live, contextual intelligence to a structured game — AI-authored progressive hints that respond to the player's current stage and progress — while a conventional backend keeps authoritative control of progression, scoring, and validation so that the result is a real game rather than an unbounded chat. AI mystery generation is designed for but **deferred from the MVP** (D5); the MVP ships one complete, polished predefined mystery (D4).

### 1.4 Project Objectives `[W]` (primary) / `[R]` (secondary)

| # | Objective | Tag |
|---|---|---|
| O1 | Deliver a playable AI-powered mystery escape-room web app in which a player registers, selects a mystery and difficulty, solves a sequence of stages under a timer, and receives a final score. | `[W]` |
| O2 | Use AI in the game experience. In the MVP: AI generates contextual progressive hints during play (live). AI mystery generation (D5) and AI answer judging (D6) are deferred with their architecture retained in Sections 4.1–4.3. | `[W]` (workshop: AI scenarios/puzzles/clues/evaluation/hints), scope per Decision Register |
| O3 | Keep game progression authoritative on the backend — AI never advances the game by itself. | `[W]` (stated as a requirement for this specification) |
| O4 | Ship a functional MVP first; avoid unnecessary infrastructure and enterprise complexity. | `[W]` |
| O5 | Keep running costs at or near zero using free-tier hosting and free-tier AI calls. | `[R]` |
| O6 | Produce an implementation-ready specification so build work can proceed phase by phase. | `[W]` (workshop phase 2) |

### 1.5 Target Audience `[R]`

- **Primary:** casual puzzle / mystery players (teens and adults) playing in a browser, session length 15–45 minutes.
- **Secondary:** workshop participants, students, and hobby developers using the project as a portfolio piece.
- **Tertiary (post-MVP):** hosts and communities running friendly competitions.

### 1.6 Unique Selling Proposition `[R]`

> **A living hint system — a game that stays honest.**
> A polished, hand-finished mystery runs on a strict escape-room engine — timer, stages, scoring, gated rooms — while a live AI hint engine reads the current case state and writes contextual, progressive nudges tuned to where the player actually is. The model advises; the backend decides. AI-authored mysteries are the next room behind this one (D5).

### 1.7 Non-Goals (MVP) `[R]`
- No AI mystery/puzzle generation during play (deferred, D5) — the MVP mystery is predefined and stored in the database.
- No AI answer judging (deferred, D6) — deterministic normalization and matching only.
- No multiplayer, leaderboards, or social features (post-MVP).
- No native mobile apps; responsive web only.
- No user-generated mystery editor (post-MVP).
- No payments, accounts tiers, or monetization.
- No real-time socket infrastructure beyond lightweight polling for timer/state refresh.
- No additional infrastructure (containers, queues, Redis, separate services) and no dependencies beyond the minimal list in Section 5.6.

---

## 2. Core Features

### A. Player Management

| Feature | Details | Tag |
|---|---|---|
| Registration | Email + password + display name. Optional single-field email-only signup is not used for MVP. | `[W]` |
| Login / Logout | Session-based login with secure, HTTP-only cookies. | `[W]` |
| Guest mode | One-click "Play as Guest": creates a user row with `is_guest = true`, no password. Guest progress is stored and can be upgraded later by setting a password on the same account. Practical for MVP because it removes signup friction during demos. | `[R]` |
| Player dashboard | Shows display name, mysteries attempted/completed, average score, total hints used, current in-progress session (resume button), and recent history. | `[W]` |
| Game history & progress | Per-session record: mystery, difficulty, result (completed / timed out / abandoned), score, time used, hints used, stages solved, timestamp. History is viewable and persists across logins. | `[W]` |

### B. Mystery Room System

| Feature | Details | Tag |
|---|---|---|
| Mystery content | **MVP ships exactly one (1) complete, polished, playable mystery** (D4), stored in the database and browsable through the same library UI as a future multi-mystery catalog — the architecture stays library-ready. | `[W]` (mystery scenarios), D4 locks the count at one |
| Difficulty levels | **Easy, Medium, Hard**, chosen before the session starts and fixed for that session. The single MVP mystery supports all three difficulties: difficulty selects a **session profile** (time limit + scoring) — it does not change the mystery's content or stage count. | `[W]` |
| Multiple stages per mystery | The MVP mystery contains **exactly five (5) stages** (D10). Stage count is content-defined and identical across difficulty profiles. | `[W]` |
| Stage contents | Each stage contains: (1) **narrative** text, (2) **one or more clues**, (3) exactly **one puzzle/challenge**. | `[W]` |
| Gate progression | A stage unlocks only after the current stage's puzzle is validated as solved by the backend. No skipping; no forward navigation. | `[W]` |

**Difficulty profiles (implementation-ready defaults) `[R]` — applied at session creation:**

| Parameter | Easy | Medium | Hard |
|---|---|---|---|
| Stages per mystery (MVP content) | 5 | 5 | 5 |
| Session time limit | 20 min | 30 min | 45 min |
| Base points per solved stage | 100 | 150 | 200 |
| Completion bonus (all stages solved in time) | 100 | 200 | 300 |
| Hint levels available per stage | 3 | 3 | 3 |
| Hint penalty per level used | 10% of that stage's base | 10% | 10% |
| Time bonus | `0.20 × stageBaseSum × remainingTimeFraction` (rounded) | same | same |
| Theoretical max score (5 stages) | 700 | 1100 | 1500 |

- Stage points = `max(0, base − round(base × 0.10 × hintLevelsUsedForStage))`.
- Total score = `Σ(stage points) + timeBonus + completionBonus(if all stages solved before expiry)`, clamped at ≥ 0.
- Profiles live in code configuration (Section 2B table), not in the `mysteries` row, so future mysteries reuse them unchanged.
- Puzzle types allowed in MVP: `multiple_choice`, `text_input` (riddle / short answer), `numeric_code` (combination locks), `cipher` (letter/word lock). The MVP mystery should exercise at least three of the four.

### C. AI Mystery Engine

**MVP AI surface `[MVP]` — what actually runs live in the MVP:**

| Capability | Details | Tag |
|---|---|---|
| Contextual AI hint generation | Live Gemini call per hint request, aware of stage, difficulty, hint level, and attempt count (full detail in Section 2D / 4.4). **This is the AI feature that demonstrates the AI-powered application.** | `[W]` (hints) `[MVP]` |
| AI case-closure paragraph | One short AI-written paragraph on the results page summarizing the player's run; static template fallback. Cosmetic only — no game state. | `[R]` `[MVP]` |
| Deterministic answer evaluation | Server-side normalization + alias matching against the stored answer key (Section 4.3). No AI call on the answer path. | `[W]` (evaluate player answers) `[MVP]`, D6 |
| Post-solution explanations | After a stage is solved, the stored in-world explanation is shown ("Here is how the cipher decoded to…"). Content comes from the seeded mystery. | `[W]` `[MVP]` |
| Seed-time content validation | Consistency checks run when the predefined mystery is seeded (contiguous stages, every answer derivable from its stage's clues, no duplicate answers). | `[W]` (consistency) `[MVP]`, seed-time |

**Deferred (designed, not built in MVP):**

| Capability | Details | Tag |
|---|---|---|
| AI mystery/scenario generation | Batched generation of a full mystery (stages, clues, puzzles, answer keys) — design retained in Section 4.1. | `[W]` `[DEFERRED — D5]` |
| AI puzzle & riddle generation | Puzzle generation with server-only canonical answers — design retained in Section 4.2. | `[W]` `[DEFERRED — D5]` |
| AI-assisted answer judging | Constrained judge for ambiguous free-text answers — design retained in Section 4.3 (Tier 2). | `[W]` `[DEFERRED — D6]` |

### D. AI Hint System *(primary `[MVP]` AI feature)*

| Feature | Details | Tag |
|---|---|---|
| On-demand hints | Player presses "Request a hint" for the current stage. | `[W]` |
| AI-powered contextual hints | Each hint is generated by the AI from the live game context (stage narrative, clues, puzzle, canonical answer, hint level, granted levels, failed-attempt count) — not a canned string. Generated once per (stage, level), then served from cache so wording is consistent and repeat requests cost nothing. | `[W]` (AI hints), Additional Requirement 1 `[MVP]` |
| Progressive hints | Fixed **3 levels** per stage: L1 = orienting nudge, L2 = partial reasoning / narrowed focus, L3 = strong clue that still stops short of the answer. | `[W]` (progressive), `[R]` (3 levels, exact wording rules) |
| Never reveal the full answer in hint 1 | Enforced twice: prompt rules forbid full answers in **any** hint (stricter than the requirement), and a server-side guard rejects/re-generates any hint that contains the canonical answer verbatim. | `[W]` |
| Always playable without the AI provider | Every stage also ships a pre-authored static fallback hint bank (seeded). If Gemini is unavailable, times out, or is rate-limited, the same hint request returns the static hint (`source:"static"`) — progression, penalties, and hint counts behave identically. **The AI is never a single point of failure.** | Additional Requirement 2 `[MVP]` |
| Hint tracking | Hint levels granted are recorded per stage and per session; they drive score penalties and appear in results and history. Each grant stores whether the content was `ai` or `static`. | `[W]` |

### E. Game Mechanics

| Mechanic | Details | Tag |
|---|---|---|
| Countdown timer | Server-authoritative: `expires_at = started_at + difficulty limit`. The client renders a countdown derived from server timestamps (clock-skew corrected). On expiry the session auto-completes as `timed_out` with partial score. | `[W]` |
| Score calculation | Formula in Section 2B table; computed only on the server. | `[W]` |
| Hint penalties | Deducted per hint level used, per stage (Section 2B). | `[W]` |
| Stage progression | Locked → Unlocked → Solved state machine per stage; backend transitions only. | `[W]` |
| Completion status | Session status: `in_progress`, `completed`, `timed_out`, `abandoned`. | `[W]` |
| Final results & performance summary | Results page: total score, per-stage breakdown, time used vs. limit, hints used, accuracy %, rank label (e.g., Novice Detective / Detective / Master Sleuth), and shareable summary. | `[W]` (results), `[R]` (breakdown/rank label) |

### F. Player Experience

| Feature | Details | Tag |
|---|---|---|
| Responsive interface | Mobile-first; usable from 360 px to desktop. | `[W]` |
| Interactive mystery room interface | Stage narrative panel, clue board, puzzle panel, timer, hint control, and progress rail for stages. | `[W]` |
| Clear navigation | Persistent header (logo, timer, hint, exit), stage progress indicator, back navigation only to non-solved informational views — never past a solved stage's answer gate. | `[W]` |
| Loading & error states | Skeletons/spinners for AI calls, inline errors with retry, toast feedback, and a "degraded mode" notice when AI is unavailable. | `[W]` |
| Visual feedback | Correct: green pulse + confirmation; incorrect: red shake + attempt count + "try again / need a hint?" prompt. Never reveal correctness of partial answers beyond a binary result. | `[W]` |

---

## 3. User Flows

Each flow lists entry → steps → system behavior → exit state. All server-side transitions reference the API in Section 7.

### 3.1 New player registration `[W]`
1. Land on landing page → click **Play Now** → registration form (email, password, display name).
2. Client validates format and password strength (min 8 chars) → `POST /api/auth/register`.
3. Server hashes password (bcrypt), creates user, starts session cookie → redirects to dashboard.
4. Errors: email already registered (inline field error), weak password, server error (retry).
- **Exit:** player dashboard (authenticated).

### 3.2 Login and dashboard `[W]`
1. `/login` → `POST /api/auth/login` → session cookie set on success.
2. Dashboard loads `GET /api/me/summary` (stats + the `inProgress` resume card) and `GET /api/me/history` (recent entries).
3. Errors: invalid credentials (generic message — no account enumeration), rate-limited attempts.
- **Exit:** dashboard with resume-in-progress card and history preview.

### 3.3 Selecting a mystery `[W]`
1. Dashboard → **Play** → `GET /api/mysteries`. The MVP returns **one published mystery** (the seeded content); the list UI is built for a catalog, so adding mysteries later requires no UI change.
2. Card shows title, tagline, setting, stage count, supported difficulties, estimated minutes, best score by this player.
- **Exit:** mystery detail view.

### 3.4 Choosing difficulty `[W]`
1. On mystery detail, player selects **Easy / Medium / Hard** (default: Easy).
2. UI shows the implications of the selected profile: time limit and point values (stage content is identical across difficulties).
- **Exit:** "Start Mystery" CTA enabled.

### 3.5 Starting a mystery `[W]`
1. `POST /api/sessions { mysteryId, difficulty }`.
2. Server creates `game_sessions` row, sets `started_at`, `expires_at` (now + profile time limit), `current_stage_number = 1`, status `in_progress`, and creates `stage_progress` rows (all locked except stage 1).
3. Content comes from the predefined mystery — session start never waits on the AI (AI calls happen only for hints later). *(On-demand generation during start is deferred, D5.)*
- **Exit:** mystery room view showing stage 1.

### 3.6 Investigating clues `[W]`
1. Room view fetches current stage payload from `GET /api/sessions/:id` — narrative, clues, puzzle prompt/options, time remaining, hints already granted for that stage. **Never** canonical answers or future stages' content.
2. Player reads narrative, expands clues one by one (all clues for the stage are available from the start; order is suggestive, not gating).
- **Exit:** puzzle panel focused.

### 3.7 Submitting answers `[W]`
1. Player submits answer in puzzle panel → `POST /api/sessions/:id/answers { stageId, answer }`.
2. Server sanitizes, normalizes, and evaluates deterministically against the stored answer key (Section 4.3 — no AI call on this path). Rate limit: 6 submissions/minute/session.
3. **Correct** → server marks stage `solved`, awards points, unlocks next stage, returns `explanation` + updated session state; UI shows success feedback and, if another stage exists, an "Enter next room" transition.
4. **Incorrect** → server records the attempt, returns `incorrect` with attempt count; answer key unchanged; UI shows red feedback. After 5 consecutive wrong attempts, response includes `suggestHint: true` (UI nudges toward hints; progression is never forced).
- **Exit:** stage solved (continue) or attempt recorded (retry).

### 3.8 Requesting hints `[W]`
1. Player clicks **Hint** → `POST /api/sessions/:id/hints { stageId }`.
2. Server checks hint level already granted for that stage (< 3), records grant, and returns the stored/generated hint for the next level.
3. If no hint is cached for that stage, server calls the AI with a strict hint prompt; the response passes the answer-leakage guard (Section 9.6) before being stored and returned. On AI failure, the stored fallback hint is returned.
4. UI shows the hint in an overlay, notes the score penalty, and updates remaining hints ("Hint 2 of 3").
- **Exit:** hint displayed; score projection updated.

### 3.9 Unlocking subsequent stages `[W]`
1. Trigger: validated correct answer for the current stage.
2. Server transitions stage `solved`, next stage `unlocked`, increments `current_stage_number`, returns the next stage payload in the same response (avoids an extra round trip).
3. UI plays a short "room unlocked" transition, then renders the new narrative/clues/puzzle.
- **Exit:** next stage active; repeat 3.6–3.9.

### 3.10 Completing the mystery `[W]`
1. Final stage solved → server sets status `completed`, `completed_at`, computes final score and breakdown, marks completion bonus.
2. Alternate endings: `timed_out` (server detects expiry on next request or via scheduled sweep; score = solved stages only), `abandoned` (player exits mid-game via explicit confirmation).
- **Exit:** results route.

### 3.11 Viewing final scores and history `[W]`
1. `GET /api/sessions/:id/result` → results page: total score, breakdown table, time used, hints used, accuracy, rank label, and AI-generated one-paragraph case closure (cosmetic only).
2. "Play another" → mystery selection; "Dashboard" → `GET /api/me/history` list with links to prior results.
- **Exit:** dashboard or new session.

---

## 4. AI Architecture

**Golden rule `[W]`:** the AI *proposes content and feedback*; the **backend owns state**. The model never writes to the database directly, never transitions a stage, never scores a session, and never receives the player's session authority. Every progression decision is a server-side branch on validated data.

### 4.1 Mystery generation `[DEFERRED — D5]` (design retained for a future phase)
- **MVP reality:** the MVP mystery is **predefined and seeded into the database** (one complete, human-reviewable artifact). It may be *authored with* AI assistance offline, but no generation happens at runtime, and no endpoint generates mysteries in the MVP.
- **Future trigger:** seed script for new content, or on-demand `POST /api/mysteries/generate` (endpoint spec kept in Section 7.9, marked deferred).
- **Batched single call:** one request generates the complete mystery object (metadata + all stages + clues + puzzles + answer keys + 3 hints per stage + explanation per stage) so tone, plot, and answers stay mutually consistent.
- **Prompt structure:** system prompt (rules, output schema, difficulty parameters, forbidden content) + user prompt (theme seed or player preferences) + JSON-schema/structured-output constraint.
- **Post-processing (server):** schema validation → normalize answers → run consistency checks (each canonical answer derivable from its stage's clues; stage numbering contiguous; no duplicate answers; no real personal data; no copyrighted characters) → persist in a transaction. Failed checks ⇒ one repair re-prompt; second failure ⇒ fall back to the existing static content and flag the artifact.
- **The same consistency checks run at seed time in the MVP** (applied to the predefined mystery), so the validation machinery is built and exercised now — only the generation call is deferred.

### 4.2 Puzzle & answer-key rules (applies to MVP content; generation `[DEFERRED — D5]`)
- Allowed types: `multiple_choice` (4 options, exactly one correct), `text_input`, `numeric_code`, `cipher`.
- Every puzzle **must** include a `canonicalAnswer` and an `acceptedAnswers` alias list (e.g., `"the key"` / `"key"`), persisted in the server-only `stage_answers` table and never serialized to any client response. This holds whether content is hand-authored, AI-assisted offline, or (later) generated at runtime.

### 4.3 Answer evaluation — deterministic only in the MVP `[W]` evaluation, D6
- **MVP (authoritative, no AI):** normalize (trim, lowercase, collapse whitespace, strip punctuation/diacritics, optional Levenshtein ≤ 2 for answers ≥ 5 chars) and compare against `acceptedAnswers`. Covers all MVP puzzle types including multiple choice and numeric codes. Cost: zero, latency: ~0, and the answer path never depends on provider availability. Correctness is decided **only** here, by backend code.
- **Result recording:** `player_answers.evaluated_by = deterministic` for every MVP submission (audit field retained for the deferred judge).
- **[DEFERRED — D6] Tier-2 constrained AI judge:** retained design for free-text answers in the gray band: judge prompt receives only the puzzle prompt, canonical answer, and candidate answer; must return `{"verdict":"correct"|"incorrect","confidence":0..1,"reason":"..."}`; backend would accept `correct` only if the schema validates **and** confidence ≥ 0.85. If re-enabled, the judge *advises* — only the backend's threshold decision advances the stage, preserving the golden rule.

### 4.4 Context-aware hint generation `[MVP]` — the primary live AI feature
- Inputs to the prompt: stage narrative, clues, puzzle prompt, canonical answer, hint level, previously granted hint levels, and the player's failed attempts (count only, not their content).
- Rules in the system prompt: level-specific tone, never output the canonical answer or an accepted alias, never output a multiple-choice option verbatim as "the answer," max length per level (L1 ≤ 25 words, L2 ≤ 40, L3 ≤ 60).
- Server-side leakage guard: reject the hint if it contains the normalized canonical answer as a substring (or similarity > 0.9) → one re-generation → if it fails again, return the static fallback hint for that stage instead.
- **Resolution order per (stage, level):** ① `ai_hint_cache` hit → return; ② live Gemini call → validate → store in `ai_hint_cache` → return with `source:"ai"`; ③ provider failure/timeout/leakage-reject → return seeded static hint with `source:"static"`. The player always receives a hint; scoring and hint counts are identical in all three paths.
- **Caching:** generated once per (stage, level) — repeated requests are free, consistent, and never re-expose the answer.

### 4.5 Conversation and game-state management
- The MVP does **not** run an open-ended chat. Each AI call is a **stateless, purpose-scoped request** with all needed context injected from the DB. MVP call purposes: `hint` (per request, cached) and `closure` (once per results page, cached per session). `generate` and `judge` purposes exist in the adapter contract but are wired to deferred features only (D5/D6).
- Game state lives exclusively in the relational DB (Section 6). The AI provider never sees a session token and receives no ability to mutate anything.
- Context passed to the model is assembled per call from `mystery → stage → session` rows, keeping prompts small and reproducible.
- Conversation-style "talk to characters" is a post-MVP enhancement (Section 12.3).

### 4.6 Structured JSON responses
All AI calls use provider-enforced structured output (JSON mode / schema-constrained decoding) and are validated on receipt with a schema library (Zod).

**MVP contract — hint output (`purpose:"hint"`):**

```jsonc
{ "level": 1,
  "content": "string (≤25 words for L1, ≤40 for L2, ≤60 for L3)",
  "reasoning": "string — not returned to the client" }
```
Validated by Zod → leakage guard (Section 4.4) → persisted to `ai_hint_cache`. Only `content` is ever returned to the client.

**MVP contract — closure output (`purpose:"closure"`):**

```jsonc
{ "paragraph": "string (40–80 words, in-world tone, no answers, no strategy spoilers" }
```

**[DEFERRED — D5] Mystery generation output (one per mystery):**
{
  "title": "string",
  "tagline": "string",
  "setting": "string",
  "theme": "string",
  "difficulty": "easy | medium | hard",
  "stages": [
    {
      "stageNumber": 1,
      "title": "string",
      "narrative": "string (60-120 words)",
      "clues": [{ "clueNumber": 1, "content": "string" }],
      "puzzle": {
        "type": "multiple_choice | text_input | numeric_code | cipher",
        "prompt": "string",
        "options": ["A", "B", "C", "D"],   // only for multiple_choice
        "canonicalAnswer": "string",       // server-only after validation
        "acceptedAnswers": ["string"]
      },
      "explanation": "string shown after solving",
      "hints": [ { "level": 1, "content": "string" },
                 { "level": 2, "content": "string" },
                 { "level": 3, "content": "string" } ]
    }
  ]
}
```

```jsonc
// [DEFERRED — D6] Judge output (never produced in the MVP)
{ "verdict": "correct | incorrect", "confidence": 0.0-1.0, "reason": "string" }
```

### 4.7 Input validation
- Every AI request body is validated **before** the prompt is built (length caps: player-provided text ≤ 200 chars; enum fields strictly checked) to prevent prompt injection and token blowup.
- Player text is wrapped as data (`<candidate_answer>...</candidate_answer>`), with system instructions stating that the content inside tags is untrusted data, never instructions. (MVP: attempt counts are sent, not attempt contents.)

### 4.8 AI error handling
- Timeouts: 8 s hint, 8 s closure (20 s reserved for future generation calls); one retry with jitter on 429/5xx.
- Schema violation: one repair prompt including the validation errors; second violation ⇒ fallback path (static hint / static closure template).
- All AI failures are logged with request id, purpose, latency, and token usage — never with the API key or full player text beyond length/summary.

### 4.9 Fallback when the AI provider is unavailable `[MVP]` (Additional Requirement 2)
- **Content:** the seeded mystery never needs the AI — sessions, stages, puzzles, explanations, and scoring are fully provider-independent.
- **Hints:** served from the seeded static hint bank (3 levels per stage) whenever the AI path fails; identical UX, penalty, and hint counters; response marked `source:"static"` so degraded play is observable but never blocking.
- **Evaluation:** deterministic matching is independent of the provider, so progression always keeps working.
- **Closure:** static results template if the AI call fails.
- **Circuit breaker:** 3 consecutive provider failures ⇒ the service switches to `degraded` mode for 60 s (no further AI calls attempted until the probe succeeds); sessions show a subtle "classic case file mode" notice. Recovery is automatic; `/api/health` reports `aiProvider:"degraded"` while active.

### 4.10 AI provider — Gemini via provider-independent adapter `[MVP]` (Decision D2)

**Verified against official documentation on 2026-11-01** ([ai.google.dev/gemini-api/docs/pricing](https://ai.google.dev/gemini-api/docs/pricing), [ai.google.dev/gemini-api/docs/rate-limits](https://ai.google.dev/gemini-api/docs/rate-limits)):

| Fact | Verified detail |
|---|---|
| Availability | Gemini Developer API offers a **Free tier** ("free input & output tokens", limited model access) and paid tiers (Tier 1+, billing account required). |
| Free-tier models (text) | Flash-class models are listed as free-of-charge on the official pricing page — `gemini-3.6-flash`, `gemini-3.8-flash`, `gemini-3.5-flash-lite`. Model lists, tier access, and limits change over time; this specification makes **no claims about models other than the Flash-class models it uses**, and does not restate any claim beyond what the cited pages say. Re-verify at P4 (D8). |
| Paid pricing (applies when a project's free quota is exhausted) | `gemini-3.5-flash-lite`: **$0.30 / 1M input, $2.50 / 1M output**; `gemini-3.6-flash` / `gemini-3.8-flash`: $0.75 / $3.75 per 1M through 2026-12-31 (rises 2027-01-01). Thinking tokens bill as output. |
| Rate limits | RPM / TPM / RPD **per project** (not per key), varying by model and usage tier. **Exact per-model numbers are not published on the docs page** — they are shown per project in Google AI Studio. Paid tiers additionally have spend-based limits ($10 per rolling 10 min at Tier 1). **Documented free-tier access does not guarantee any particular project's quota** — a project's real quota must be observed with its own key (D8, verified in P4). |
| Structured output | Supported natively (JSON schema / structured-output mode) — used for all contracts in Section 4.6. |
| Context caching (provider feature) | A separate Gemini API feature whose availability and pricing **vary by model** — the official pricing table lists it as "Not available" for some models. **Not used by this project** (see caching distinction below). |
| Compatibility | The official docs offer an OpenAI-compatibility endpoint; the adapter targets the Gemini REST API directly regardless. |

**Adapter design (no extra dependency):**
- Interface: `AIProvider { hint(req): HintOut; closure(req): ClosureOut; generate?(…); judge?(…) }` — one internal module; route handlers depend on the interface, never on Gemini specifics.
- Implementation uses plain `fetch` against `https://generativelanguage.googleapis.com/v1beta/models/{AI_MODEL}:generateContent` (JSON mime), so **no SDK package is required** (Additional Requirement 5). Swapping providers later = one new implementation of the interface.
- Config via env: `AI_PROVIDER=gemini`, `AI_API_KEY` (server-only), `AI_MODEL`.
- **Model (Decision D8, approved):** initial default **`gemini-3.6-flash`**, kept configurable through **`AI_MODEL`**. During **P4**, verify actual API availability, the account's quotas, free-tier eligibility and current pricing; **do not assume that documented free-tier access guarantees any particular project's quota.** If the project's quota is insufficient, either use paid tier at the cost envelope below or rely on the static-hint fallback — gameplay is unaffected either way.
- **Caching — explicit distinction:** every "cache/cache" in this specification means **application-level caching in our own database** (`ai_hint_cache`, Section 6.2): the guarded hint text for a given (stage, level) is stored once and served thereafter. **Gemini API context caching is an entirely different, provider-side feature; this project does not use it, does not depend on it, and makes no availability assumption about it for any model.**
- **Cost envelope (derived from the paid prices above):** a hint call ≈ 1k input + ~150 output tokens; a closure call ≈ 1k + ~200. Maximum **15 hints per session (5 stages × 3 levels)** ≈ 15k input + 2.3k output ≈ 0.02M tokens → **$0 on the free tier**; at paid `gemini-3.5-flash-lite` rates ≈ (0.015M × $0.30) + (0.0023M × $2.50) ≈ **$0.01 per session**, plus < $0.001 for the closure. The per-(stage,level) cache caps generation at **15 calls per mystery ever** (across all players), so AI spend is structurally bounded.
- **Pre-integration verification checklist (P4, per D8):** create a key → read **this project's** live rate limits/quotas in AI Studio (not just the documentation) → confirm free-tier eligibility for the chosen model → review current pricing → one live `hint` smoke call → confirm response shape against Section 4.6 → record the confirmed model in `.env.example`.

---

## 5. Technical Architecture

**Repository inspection result:** the project folder is **empty** (no source files, no package manifests, no existing stack). The stack below is therefore chosen from scratch for cost, beginner-friendliness, and minimal infrastructure — per the instruction to recommend a simple stack for an empty repo.

### 5.1 Recommended stack — "Next.js monolith" `[R]`

| Layer | Choice | Why |
|---|---|---|
| Frontend + Backend | **Next.js (App Router) + TypeScript**, single codebase | One repo, one deploy, API routes replace a separate server. Fewer moving parts than a split SPA + Node service; beginner-friendly and free-tier friendly. |
| Styling | **Tailwind CSS** + a small set of shared UI components | Fast to build a consistent dark, cinematic theme; no design-system overhead. |
| Database | **PostgreSQL (Neon free tier)** | Free, serverless, scales from a hobby project; SQL relations match the data model in Section 6. |
| ORM | **Prisma** | Schema-first migrations, typed queries, easy seeding. |
| Auth | **Auth.js (NextAuth) Credentials provider** with **bcrypt** password hashing and HTTP-only session cookies (JWT strategy) | Standard, well-documented, avoids hand-rolling session security. |
| AI provider | **Gemini API** (D2, approved) through a **provider-independent adapter** (Section 4.10); model/base URL/key via env vars; verified pricing & quota notes in Section 4.10 | Free-tier eligible for Flash-class models; structured output; adapter keeps the app provider-agnostic. **Re-verify quotas/costs before integration (P4).** |
| Validation | **Zod** on all API inputs **and** AI outputs | One library for both directions. |
| Testing | **Vitest** (unit), **Playwright** (E2E) | Modern, fast, low config. |
| Deployment | **Vercel** (frontend + API), **Neon** (DB) | Generous free tiers, git-based deploys, no servers to manage. |
| Package manager | **npm** (D7, approved) | Ships with Node — maximum beginner familiarity, zero extra tooling. |

**Deliberately excluded for the MVP:** Docker/Kubernetes, Redis, message queues, microservices, GraphQL, websockets, Elasticsearch, CQRS, separate admin CMS, AI SDK packages (plain `fetch` adapter instead). If a feature (e.g., live multiplayer) later requires them, they are explicitly post-MVP (Section 12.3).

### 5.2 Alternative stack (if a split deploy is preferred) `[R]`
- **Vite + React** SPA (Vercel/Netlify) + **Express + TypeScript** API (**Render free tier**) + Neon Postgres.
- Trade-off: two deploys and CORS to configure, but a clearer frontend/backend separation for learning purposes. Choose this only if the team specifically wants an independent REST backend.

### 5.3 High-level architecture

```
Browser (Next.js client components)
   │  fetch over HTTPS, SameSite=Lax session cookie
   ▼
Next.js Route Handlers (/api/*)  ── Zod validation ── rate limiting
   │                 │
   │                 ├── Prisma ──► PostgreSQL (Neon)
   │                 │
   │                 └── Game service (authoritative state machine,
   │                     scoring, deterministic answer matching)
   ▼
AI adapter — provider-independent interface (timeout, retry, circuit breaker, Zod validation)
   │
   ▼
Gemini API (generateContent, JSON output)  (key server-side only)
```

### 5.4 API communication `[R]`
- Same-origin REST (`/api/...`), JSON in/out, no public CORS.
- Uniform envelope: success = resource JSON; error = `{"error":{"code":"STRING_CODE","message":"human readable","details":{}}}`.
- Client uses a single typed fetch wrapper (loading/error/success states, retries only for idempotent GETs).
- Timer uses server timestamps (`serverNow` in session payload) to correct clock skew; no websockets in MVP (payload refresh after each action + 15 s poll while active).

### 5.5 Environment variables

| Name | Purpose | Secret |
|---|---|---|
| `DATABASE_URL` | Postgres connection string | Yes |
| `AUTH_SECRET` | Signs session JWTs / cookies | Yes |
| `AI_PROVIDER` | Provider selector (`gemini`) — keeps the adapter generic | No |
| `AI_API_KEY` | Gemini API key (server-only) | Yes |
| `AI_BASE_URL` | `https://generativelanguage.googleapis.com/v1beta` (default) | No |
| `AI_MODEL` | Model id — **default `gemini-3.6-flash` (D8)**, configurable; re-verified in P4 | No |
| `AI_TIMEOUT_MS` / `AI_MAX_RETRIES` | Resilience tuning | No |
| `NEXT_PUBLIC_APP_URL` | Canonical URL for links | No |
| `RATE_LIMIT_*` | Window/max overrides (optional) | No |
| `AI_LIVE_TESTS` | Enables live AI smoke tests in CI (off by default) | No |

`.env.example` (committed) lists names and safe defaults only; `.env` (real values) stays git-ignored.

### 5.6 Minimal dependency list `[MVP]` (Additional Requirement 5)

| Kind | Packages | Purpose |
|---|---|---|
| Runtime | `next`, `react`, `react-dom` | App framework |
| Runtime | `tailwindcss` (+ PostCSS) | Styling |
| Runtime | `prisma`, `@prisma/client` | Database ORM |
| Runtime | `next-auth`, `bcryptjs` | Auth + password hashing (bcryptjs = pure-JS bcrypt, no native build issues on free hosts) |
| Runtime | `zod` | Input & AI-output validation |
| Dev | `typescript`, `@types/*`, `eslint`, `prettier` | Tooling |
| Dev | `vitest`, `@playwright/test` | Testing |

**No other dependency may be added to the MVP without a written justification in this spec** — notably: no AI SDK (plain `fetch`), no state-management library, no component/UI kit, no data-fetching library, no CSS framework beyond Tailwind. AI calls are hand-rolled through the adapter (Section 4.10).

---

## 6. Database Design

PostgreSQL via Prisma. Table names are plural; ids are `uuid` (default `gen_random_uuid()`); all timestamps are `timestamptz` UTC.

### 6.1 Entity-relationship summary

```
users 1──n game_sessions n──1 mysteries 1──n stages 1──n clues
                │                              1──n hints (static fallback bank)
                │                              1──n ai_hint_cache (AI-generated, cached)
                │                              1──1 stage_answers (server-only)
                ├──1 n stage_progress n──1 ┘
                ├──1 n player_answers
                └──1 n score_breakdowns (1:1)
users 1──n game_sessions        game_history = VIEW over sessions + scores
```

### 6.2 Entities

**`users`** — player accounts `[W]` (registration/login), guest flag `[R]`

| Field | Type | Constraints |
|---|---|---|
| `id` | uuid | PK |
| `email` | citext | UNIQUE, nullable (null only for guests) |
| `password_hash` | text | nullable (null for guests until upgraded) |
| `display_name` | varchar(40) | NOT NULL, required |
| `is_guest` | boolean | NOT NULL, default `false` |
| `guest_expires_at` | timestamptz | nullable; guest cleanup horizon (30 days) `[R]` |
| `created_at` | timestamptz | NOT NULL, default now() |

Check: `is_guest = true` ⇒ `password_hash IS NULL`. Partial unique index on lower(email) where email is not null.

**`mysteries`** — mystery scenarios `[W]` — **MVP contains exactly one published row (D4)**

| Field | Type | Constraints |
|---|---|---|
| `id` | uuid | PK |
| `title` | varchar(120) | NOT NULL, UNIQUE |
| `tagline` | varchar(200) | NOT NULL |
| `setting` | varchar(200) | NOT NULL |
| `theme` | varchar(80) | NOT NULL |
| `stage_count` | int | NOT NULL, CHECK (between 3 and 8); **MVP row = 5 (D10)** — must equal the number of seeded stage rows |
| `estimated_minutes` | int | NOT NULL |
| `supported_difficulties` | jsonb | NOT NULL, default `["easy","medium","hard"]` — which session profiles this content supports |
| `source` | enum(`static`,`ai`) | NOT NULL; MVP row = `static`. The `ai` value is reserved for deferred runtime generation (D5) |
| `status` | enum(`draft`,`published`,`archived`) | NOT NULL, default `draft`; MVP row seeded as `published` |
| `created_by` | uuid | nullable FK → users (null for seed/admin) |
| `ai_generation_meta` | jsonb | nullable — reserved for D5; unused (null) in the MVP |
| `created_at` | timestamptz | NOT NULL |

**Deliberately not stored here:** difficulty, time limits, points, bonuses — those are **difficulty profiles in code** (Section 2B table) applied per session, so the single MVP mystery plays identically across Easy/Medium/Hard and future mysteries reuse the same profiles.

**`stages`** — one room/challenge per row `[W]`

| Field | Type | Constraints |
|---|---|---|
| `id` | uuid | PK |
| `mystery_id` | uuid | FK → mysteries, ON DELETE CASCADE |
| `stage_number` | int | NOT NULL, CHECK ≥ 1 |
| `title` | varchar(120) | NOT NULL |
| `narrative` | text | NOT NULL |
| `puzzle_type` | enum(`multiple_choice`,`text_input`,`numeric_code`,`cipher`) | NOT NULL |
| `puzzle_prompt` | text | NOT NULL |
| `puzzle_options` | jsonb | nullable; required as 4-item array when `multiple_choice` |
| `explanation` | text | NOT NULL — shown only after a solve |
| `created_at` | timestamptz | NOT NULL |

Unique: `(mystery_id, stage_number)`.

**`clues`** `[W]`

| Field | Type | Constraints |
|---|---|---|
| `id` | uuid | PK |
| `stage_id` | uuid | FK → stages, CASCADE |
| `clue_number` | int | NOT NULL, CHECK ≥ 1 |
| `content` | text | NOT NULL |
Unique: `(stage_id, clue_number)`; at least 1 row enforced by application + test.

**`stage_answers`** — server-only answer keys `[W]` (validation) / `[R]` (separate table so keys are structurally isolated from client-readable content)

| Field | Type | Constraints |
|---|---|---|
| `id` | uuid | PK |
| `stage_id` | uuid | UNIQUE FK → stages, CASCADE |
| `canonical_answer` | varchar(200) | NOT NULL, lowercased on write |
| `accepted_answers` | jsonb | NOT NULL, array of normalized strings, always includes `canonical_answer` |

*(No judge flag: AI judging is deferred — D6 — and would be added as a per-stage opt-in column when re-enabled.)*

**`hints`** — **static fallback hint bank**, 3 pre-authored levels per stage `[W]` hints, `[R]` storage as a table, `[MVP]` required for provider-outage playability

| Field | Type | Constraints |
|---|---|---|
| `id` | uuid | PK |
| `stage_id` | uuid | FK → stages, CASCADE |
| `level` | smallint | CHECK IN (1,2,3) |
| `content` | text | NOT NULL — must pass the same leakage rules as AI hints |

Unique: `(stage_id, level)`. Seeded for every stage; always available offline.

**`ai_hint_cache`** `[MVP]` — AI-generated hints, one row per (stage, level); **never exposed to the client without going through the hint-grant flow**

| Field | Type | Constraints |
|---|---|---|
| `id` | uuid | PK |
| `stage_id` | uuid | FK → stages, CASCADE |
| `level` | smallint | CHECK IN (1,2,3) |
| `content` | text | NOT NULL — post-leakage-guard output |
| `model` | varchar(80) | NOT NULL (e.g., `gemini-3.6-flash`) |
| `input_tokens` / `output_tokens` | int | nullable — cost monitoring |
| `created_at` | timestamptz | NOT NULL, default now() |

Unique: `(stage_id, level)` — first successful generation wins and is reused thereafter. Un-granted levels are filtered out of every response (Section 9.6).

**`game_sessions`** `[W]`

| Field | Type | Constraints |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | FK → users, CASCADE |
| `mystery_id` | uuid | FK → mysteries, RESTRICT |
| `difficulty` | enum(`easy`,`medium`,`hard`) | NOT NULL — the player-selected difficulty profile (Section 2B); independent of content |
| `status` | enum(`in_progress`,`completed`,`timed_out`,`abandoned`) | NOT NULL, default `in_progress` |
| `current_stage_number` | int | NOT NULL, default 1 |
| `started_at` | timestamptz | NOT NULL, default now() |
| `expires_at` | timestamptz | NOT NULL |
| `completed_at` | timestamptz | nullable |
| `total_score` | int | NOT NULL, default 0, CHECK ≥ 0 |
| `hints_used_total` | smallint | NOT NULL, default 0 |
| `correct_attempts` / `total_attempts` | int | NOT NULL, default 0 |
| `time_used_seconds` | int | nullable (set at completion) |
| `ai_degraded` | boolean | NOT NULL, default false `[R]` |
| `created_at` | timestamptz | NOT NULL |

Indexes: `(user_id, created_at desc)`, `(status)` partial where `in_progress`. One active session per (user, mystery) enforced by a partial unique index.

**`stage_progress`** `[W]` (stage gating)

| Field | Type | Constraints |
|---|---|---|
| `id` | uuid | PK |
| `session_id` | uuid | FK → game_sessions, CASCADE |
| `stage_id` | uuid | FK → stages, CASCADE |
| `status` | enum(`locked`,`unlocked`,`solved`) | NOT NULL, default `locked` |
| `hints_used` | smallint | NOT NULL, default 0, CHECK ≤ 3 |
| `attempts` | smallint | NOT NULL, default 0 |
| `points_awarded` | int | NOT NULL, default 0, CHECK ≥ 0 |
| `solved_at` | timestamptz | nullable |

Unique: `(session_id, stage_id)`. Invariant (application-enforced, covered by tests): a session has exactly one `unlocked` stage while `in_progress`, all prior stages `solved`, all later stages `locked`.

**`player_answers`** `[W]` (answer history / audit)

| Field | Type | Constraints |
|---|---|---|
| `id` | uuid | PK |
| `session_id` | uuid | FK → game_sessions, CASCADE |
| `stage_id` | uuid | FK → stages, CASCADE |
| `answer_text` | varchar(500) | NOT NULL (raw, sanitized) |
| `is_correct` | boolean | NOT NULL |
| `evaluated_by` | enum(`deterministic`) | NOT NULL — MVP writes only `deterministic`; the deferred judge (D6) would add its value later |
| `points_delta` | int | NOT NULL, default 0 |
| `created_at` | timestamptz | NOT NULL |

Index: `(session_id, created_at)`.

**`score_breakdowns`** (1:1 with session) `[R]` (workshop requires a Scores concept; storing the breakdown makes the results page deterministic)

| Field | Type | Constraints |
|---|---|---|
| `session_id` | uuid | PK, FK → game_sessions, CASCADE |
| `stage_points_sum` | int | NOT NULL |
| `hint_penalty` | int | NOT NULL, default 0 |
| `time_bonus` | int | NOT NULL, default 0 |
| `completion_bonus` | int | NOT NULL, default 0 |
| `total` | int | NOT NULL, CHECK ≥ 0 |
| `rank_label` | varchar(40) | NOT NULL |

**`game_history` — VIEW** `[W]` (history is a query, not a duplicate table)

```sql
CREATE VIEW game_history AS
SELECT s.id AS session_id, s.user_id, m.title AS mystery_title, s.difficulty,
       s.status, s.total_score, s.hints_used_total, s.total_attempts,
       s.correct_attempts, s.time_used_seconds, s.started_at, s.completed_at
FROM game_sessions s JOIN mysteries m ON m.id = s.mystery_id;
```

### 6.3 Relationships & constraints (recap)
- `users 1—n game_sessions 1—1 score_breakdowns`; `game_sessions 1—n stage_progress / player_answers`.
- `mysteries 1—n stages 1—n clues / hints / ai_hint_cache`; `stages 1—1 stage_answers`.
- All deletes cascade except `mysteries` referenced by sessions (RESTRICT) so history survives content archival.
- Application-level checks (DB CHECKs where possible): score ≥ 0, hint levels 1–3, contiguous stage numbers, exactly one active session per user per mystery, `mysteries.stage_count` equals the number of seeded stage rows.

---

## 7. API Design

REST, JSON, same-origin. All routes under `/api`. Auth = session cookie unless marked *public*. Validation = Zod; errors follow the envelope from Section 5.4.

### 7.1 Authentication `[W]`

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| POST | `/api/auth/register` | public | `{email, password, displayName}` | `201 {user:{id,displayName,email}}` + cookie |
| POST | `/api/auth/login` | public | `{email, password}` | `200 {user}` + cookie |
| POST | `/api/auth/logout` | session | — | `204`, clears cookie |
| GET | `/api/auth/me` | session | — | `200 {user:{id,displayName,email,isGuest}}` or `401` |
| POST | `/api/auth/guest` | public | `{displayName?}` | `201 {user}` + cookie (guest) `[R]` |
| POST | `/api/auth/upgrade-guest` | session (guest) | `{email, password}` | `200 {user}` — attaches credentials to guest account `[R]` |

Errors: `409 EMAIL_TAKEN`, `401 INVALID_CREDENTIALS` (generic), `429 TOO_MANY_REQUESTS` (login: 10/15 min/IP).

### 7.2 Player dashboard & history `[W]`

| Method | Path | Auth | Response |
|---|---|---|---|
| GET | `/api/me/summary` | session | `{gamesPlayed, gamesCompleted, avgScore, totalHintsUsed, bestScore, inProgress:{sessionId,mysteryTitle,stageNumber,expiresAt}|null}` |
| GET | `/api/me/history?limit&cursor` | session | `{items:[{sessionId,mysteryTitle,difficulty,status,totalScore,hintsUsed,timeUsedSeconds,completedAt}], nextCursor}` |
| GET | `/api/sessions/:id/result` | session (owner) | Full result payload (Section 7.7) |

### 7.3 Mystery library `[W]`

| Method | Path | Auth | Request / Response |
|---|---|---|---|
| GET | `/api/mysteries?limit=&cursor=` | session | `{items:[{id,title,tagline,setting,supportedDifficulties,stageCount,estimatedMinutes,bestScoreByMe}]}` — MVP returns the one published mystery (D4); the shape is catalog-ready |
| GET | `/api/mysteries/:id` | session | Detail incl. `{stageCount,estimatedMinutes,supportedDifficulties,difficultyProfiles:{easy:{timeLimitSeconds,basePoints,completionBonus},medium:{…},hard:{…}}}` — **no stage content, no answers** |

### 7.4 Game sessions `[W]`

| Method | Path | Auth | Request / Response |
|---|---|---|---|
| POST | `/api/sessions` | session | `{mysteryId, difficulty}` → `201 {sessionId,status,currentStage:{...stagePayload},serverNow,expiresAt}` — `409` if an active session for that mystery exists (client resumes instead) |
| GET | `/api/sessions/:id` | session (owner) | `{sessionId,status,mystery:{title,difficulty},serverNow,expiresAt,timeRemainingSeconds,currentStage:{stageNumber,title,narrative,clues,puzzle:{type,prompt,options},hintsGranted:[level]},score:{total,attempts,correctAttempts}}` — never canonical answers, explanations, or future stages |
| POST | `/api/sessions/:id/complete` | session (owner) | `{reason:"abandoned"}` → `200 result` (explicit exit) |

**Stage payload contract (`currentStage`)** — the only content shape the client ever renders.

### 7.5 Answer submission `[W]`

`POST /api/sessions/:id/answers` — session (owner), rate limit 6/min/session.

Request: `{ stageId, answer }` (`answer` ≤ 200 chars, trimmed; `stageId` must equal the session's current unlocked stage or `409 STAGE_NOT_ACTIVE`).

Responses:

```jsonc
// 200 correct
{ "result":"correct", "stageNumber":1,
  "explanation":"…", "pointsAwarded":90, "totalScore":90,
  "unlockedStage": { "stageNumber":2, "title":"…", "narrative":"…",
                     "clues":[…], "puzzle":{…} },   // present only if a next stage exists
  "completed": false }

// 200 incorrect
{ "result":"incorrect", "attempts":3, "hintsRemaining":3, "suggestHint":false }

// 200 + completed:true on final stage
{ "result":"correct", "completed":true, "redirect":"/results/:sessionId" }
```

Errors: `400 VALIDATION`, `409 SESSION_NOT_ACTIVE` (expired/abandoned), `409 STAGE_NOT_ACTIVE`, `429 RATE_LIMITED`. **No AI-related error can occur on this path** — evaluation is deterministic (D6), so answers never depend on the provider.

### 7.6 Hints `[W]`

| Method | Path | Request | Response |
|---|---|---|---|
| POST | `/api/sessions/:id/hints` | `{stageId}` | `201 {level, content, source:"ai"\|"static", penaltyPoints, hintsGranted:[levels], hintsRemaining}` — `source:"ai"` proves live AI generation; `"static"` marks provider-fallback. `409 HINTS_EXHAUSTED` at level 4, `409 STAGE_NOT_ACTIVE`. **Always succeeds with content when the stage is active** (AI outage ⇒ static hint, never a 5xx). |
| GET | `/api/sessions/:id/hints/:stageId` | — | `200 {granted:[{level,content,source,grantedAt}]}` (already granted hints only — never future levels) |

### 7.7 Results `[W]`

`GET /api/sessions/:id/result` →
```jsonc
{ "sessionId":"…", "mystery":{"title","difficulty"}, "status":"completed",
  "score":{"stagePointsSum":450,"hintPenalty":30,"timeBonus":75,
           "completionBonus":200,"total":695,"rankLabel":"Detective"},
  "timeUsedSeconds":1420, "timeLimitSeconds":1800,
  "hintsUsed":3, "attempts":7, "correctAttempts":5, "accuracyPct":71,
  "stages":[{"stageNumber":1,"title":"…","pointsAwarded":90,"hintsUsed":1,"attempts":2,"solved":true}],
  "closure":"…one-paragraph AI case summary (cosmetic)…" }
```

`closure` is AI-generated (`purpose:"closure"`, Section 4.6) and cached per session; a static template is substituted on provider failure. Results never depend on AI availability.

### 7.8 Operational `[R]`

| Method | Path | Response |
|---|---|---|
| GET | `/api/health` | `{ok, db, aiProvider:"ok\|degraded\|disabled", version}` — used by deployment verification (Section 11) |

### 7.9 Deferred endpoints — **not built in the MVP** `[DEFERRED]`

| Method | Path | Deferred by | Notes |
|---|---|---|---|
| POST | `/api/mysteries/generate` | **D5** | `{theme?, difficulty}` → `202 {mysteryId,status:"generating"}`; rate limit planned at 5/hour/user, 20/day/IP. Spec kept so D5 can be implemented without redesigning Section 7. |
| — | AI judge evaluation | **D6** | No endpoint — the judge is an internal Tier-2 step inside `POST …/answers` (Section 4.3); re-enabling it changes response payloads by at most an `evaluatedBy` audit field. |

---

## 8. UI/UX Requirements

### 8.1 Design direction `[W]` (immersive/mysterious, modern dark) + `[R]` (tokens)

- **Mood:** cinematic noir — deep near-black backgrounds, subtle vignette/grain, one warm accent (amber/gold) for actions and a cold accent (teal/cyan) for AI/hint affordances; danger red for wrong answers, success green for correct.
- **Suggested tokens:** `bg #0B0E14`, `surface #141A24`, `border #232C3B`, `text #E6E9F0`, `muted #95A0B3`, `accent #F0B429`, `ai #39C0BA`, `danger #E5484D`, `success #46A758`.
- **Typography:** one display serif or geometric sans for headings (e.g., *Playfair Display* or *Space Grotesk*) + a highly readable sans for body (*Inter*), body ≥ 16 px, line-height 1.6, measure ≤ 70ch for narrative text.
- **Atmosphere without complexity:** subtle CSS-only effects (gradient glows, slow fade-ins, page transitions ≤ 300 ms). No heavy video/background animation, no parallax; honor `prefers-reduced-motion`.
- **Layout:** mobile-first, breakpoints 360 / 768 / 1024 / 1280. Room layout: narrative panel (top/left), clue board, puzzle panel (focus), sticky timer + progress rail.
- **Accessibility:** WCAG AA contrast for text, visible focus rings, full keyboard operation of puzzles (including multiple-choice selection), ARIA live regions for correct/incorrect feedback, labeled form errors.

### 8.2 Screens `[W]`

| # | Route | Purpose & key elements | Key states |
|---|---|---|---|
| 1 | `/` **Landing page** | Hero ("Every room hides a different truth"), how-it-works (3 steps), difficulty explainer, sample mystery teaser, CTAs: Play Now / Sign In / Play as Guest. | loading (static), mobile menu |
| 2 | `/register`, `/login` **Auth pages** | Centered card, inline field validation, error toasts, link between the two. | idle, validating, submitting, field errors, server error, rate-limited |
| 3 | `/dashboard` **Player dashboard** | Welcome + stats tiles, "Resume case" card, mystery carousel, recent history (5), logout. | loading skeleton, empty state (new player), error + retry |
| 4 | `/mysteries` **Mystery selection** | Mystery card(s): cover art (CSS/gradient, no external assets required), title, tagline, stages, supported difficulties, est. time, best score. MVP renders one published mystery; empty state covers "no published mystery." | loading, empty, error |
| 5 | `/mysteries/:id` **Difficulty selection** | Detail + Easy/Medium/Hard selector showing the selected profile's time limit and points (content identical across difficulties); scoring summary; Start button; resume prompt if a session is active. | idle, has-active-session, starting |
| 6 | `/play/:sessionId` **Mystery room** | Timer (top), stage progress rail, narrative panel, collapsible clue board, puzzle panel, Hint button with remaining count (badge: "AI hint" when `source:"ai"`), Exit (with confirm). | playing, correct transition, incorrect shake, hint overlay, time-expired overlay, degraded-mode banner ("classic case file mode"), session error |
| 7 | `/play/:sessionId` **Puzzle interface** | Type-specific input: option cards (multiple choice), text field + submit, digit lock (numeric), letter/word lock (cipher). Attempts + "suggest hint" nudge after 5 misses. | empty, focused, submitting, correct, incorrect, rate-limited |
| 8 | `/results/:sessionId` **Results page** | Score counter animation, rank label, breakdown table, per-stage list, time/hints/accuracy, closure paragraph, CTAs: Play another / Dashboard / Review history. | loading, completed, timed-out variant, error |
| 9 | `/history` **Game history** | Filterable table (mystery, difficulty, status, score, date) with links to results; empty state. | loading, empty, error |
| — | **Global** | Header (logo, timer context, user menu), toasts, error boundary, 404 page, offline notice. | — |

### 8.3 Interaction rules `[R]`
- Every async action has a visible pending state; no dead clicks.
- Irreversible actions (Exit mid-game) require confirmation.
- Never flash hidden content: stage payloads load only after server unlock; no answers in client bundles, URLs, or localStorage (see Section 9.6).
- Progressive enhancement: the game is playable with JS enabled (Next.js requirement), text remains selectable, and links/buttons are semantic.

---

## 9. Security and Reliability

| # | Requirement | Implementation | Tag |
|---|---|---|---|
| 9.1 | Secure authentication | Auth.js credentials + HTTP-only, `Secure`, `SameSite=Lax` session cookies; JWT signed with `AUTH_SECRET`; sessions validated server-side on every protected route; CSRF via SameSite + origin check on mutations. | `[W]` |
| 9.2 | Password hashing | bcrypt (cost ≥ 12); passwords never logged; min length 8 with basic strength check; generic login error messages. | `[W]` |
| 9.3 | API key protection | `AI_API_KEY` read only in server-side code; never prefixed `NEXT_PUBLIC_`; never returned by any endpoint; redacted from logs and error payloads. | `[W]` |
| 9.4 | Server-side answer validation | Progression state machine and deterministic matching execute only in route handlers; client sends an answer string, never a "correct" flag; response payloads exclude answer keys and unsolved explanations. The answer path performs **zero AI calls** (D6), so validation cannot be influenced or delayed by the provider. | `[W]` |
| 9.5 | Rate limiting for AI-backed endpoints | Sliding window per user + IP: answers 6/min/session, hints 6/min/session (AI cost is bounded by the per-(stage,level) cache — max **15** generations per mystery), login 10/15 min/IP; `429` with `Retry-After`. Deterministic endpoints: 60/min/user. Generation quota (5/hour/user) reserved for D5. | `[W]` |
| 9.6 | Input sanitization & answer-leakage protection | Zod length/enum validation on every input; HTML escaped on render (React default, no `dangerouslySetInnerHTML`); player text treated as untrusted data in prompts; **answer-leak guard**: no payload ever includes `stage_answers` content, `explanation` before solve, hint bank rows for un-granted levels, or future-stage rows; hints scanned for canonical-answer leakage before returning; production source maps disabled; no answers in client-side caches/localStorage; `Cache-Control: no-store` on all `/api/sessions/*` responses. | `[W]` + `[R]` detail |
| 9.7 | Error handling | Global error boundary + typed API error envelope; no stack traces or SQL in production responses; AI failures map to fallbacks (Section 4.9) instead of 500s wherever possible; structured server logs with request ids. | `[W]` |
| 9.8 | Database validation | Prisma schema constraints + DB CHECKs + transactional state transitions (stage solve + unlock + score update in one transaction); FK cascades; least-privilege DB user; parameterized queries via ORM. | `[W]` |
| 9.9 | Additional hardening `[R]` | HTTPS-only in production, security headers (`X-Content-Type-Options`, `Referrer-Policy`, basic CSP), guest account pruning, session expiry (7 days absolute), owner checks on every `:id` route (`404` for non-owners to avoid id probing), dependency audit in CI. | `[R]` |
| 9.10 | Reliability `[R]` | Idempotent mutations (answer submitted twice returns the recorded result, no double scoring), transactional consistency, health endpoint, timeouts/retries/circuit breaker on AI calls (Section 4.8), graceful DB errors with retry-safe UI. | `[R]` |

---

## 10. Testing Strategy

| Layer `[W]` scope | Tooling & coverage `[R]` specifics |
|---|---|
| **Unit testing** `[W]` | Vitest. Priority modules: scoring formula (all difficulty/hint/time combinations), answer normalization & fuzzy matching, state-machine transitions (locked/unlocked/solved + invalid transitions rejected), timer/expiry logic with mocked clocks, hint-leak guard, hint resolution order (cache → AI → static), rate-limit windows. Target ≥ 80% coverage on `lib/game/*` and `lib/ai/*`. |
| **API testing** `[W]` | Vitest + Supertest against an isolated test database. Cover every endpoint in Section 7 (deferred endpoints in 7.9 excluded): happy path, validation errors, auth errors (401/403/404-for-non-owner), conflicts (409), rate limits (429), and response shape contracts (Zod-parsed). |
| **AI response validation** `[W]` | Contract tests with a **mocked Gemini provider** returning fixtures: valid hint output (persisted to `ai_hint_cache`, `source:"ai"`), schema-violating JSON (repair → then static fallback), **hint containing the canonical answer (must be rejected → static fallback)**, provider timeout/500/429 (must fall back, session still playable), closure failure (static template). Judge/generation fixtures are excluded as deferred (D5/D6). One small live smoke test, skipped unless `AI_LIVE_TESTS=1`. |
| **Authentication testing** `[W]` | Register/login/logout/me flows, bcrypt verification, cookie flags, guest creation + upgrade, password-strength rejection, login rate limiting, session expiry, cross-user access denied. |
| **Game progression testing** `[W]` | End-to-end at service level: full playthrough of the seeded mystery **at each of the three difficulties** (5 stages each, using the Section 2B profiles), correct answers unlock exactly the next stage, wrong answers never advance, hints cap at 3 with penalty applied, expiry flips status to `timed_out` with partial score, completion bonus only when all stages solved in time, score matches the documented formula exactly (incl. max-score constants 700/1100/1500), single active session per mystery. |
| **UI responsiveness testing** `[W]` | Playwright projects at 360×740, 768×1024, 1440×900: no horizontal scroll, touch targets ≥ 44 px, puzzle input usable on mobile, timers/panels don't overlap. Plus `prefers-reduced-motion` and keyboard-only navigation pass. |
| **End-to-end testing** `[W]` | Playwright against the production build (AI mocked for determinism): guest → select mystery → choose difficulty → solve all stages (mix of correct/incorrect/hints) → results → history shows the session; registered-user resume flow; **degraded-AI flow** (provider forced down ⇒ hints served `source:"static"` and the game still completes). |

**CI recommendation `[R]`:** on every push run lint → typecheck → unit → API tests → E2E (Chromium only) with a Neon branch or local Postgres service; block merge on failures.

---

## 11. Deployment Strategy

| Item | Recommendation | Tag |
|---|---|---|
| Frontend deployment | **Vercel** (Next.js git integration; free Hobby tier). Production branch = `main`; preview deployments per PR. | `[W]` (deploy), `[R]` (Vercel) |
| Backend deployment | Same Next.js app on Vercel (route handlers). No separate server to deploy — this is the primary cost/complexity saving. | `[R]` |
| Database hosting | **Neon** Postgres free tier; separate `preview` and `production` branches; connection pooling via the provided pooled connection string. | `[R]` |
| Alternative (if Vercel is unsuitable) | Render free-tier web service running `next start` behind a Neon DB (expect cold starts) — acceptable for demos only. | `[R]` |
| Environment variables | Set Section 5.5 vars per environment (Vercel Project Settings / Neon). Secrets stored only in the host's secret manager; `.env.example` (names only) committed, `.env` git-ignored. | `[W]` |
| Production configuration | `NODE_ENV=production`, HTTPS enforced, security headers, source maps off, Prisma migrate deploy on release (not auto-migrate on boot), seed the MVP mystery (stages, clues, answer keys, static hint bank) after migrate, rate limits at production values, AI circuit breaker enabled. | `[W]` |
| Migrations & seeding | `prisma migrate deploy` + `prisma db seed` (the single published mystery + static hints + answer keys). Run as a release step in CI. | `[R]` |
| Deployment verification | Checklist after every deploy: 1) `/api/health` returns `ok` (db; `aiProvider` ok/degraded), 2) landing page loads, 3) register/login/logout works, 4) seed mystery loads and one answer submits correctly (correct **and** incorrect), 5) hint request returns a hint (AI available ⇒ `source:"ai"`; otherwise `source:"static"`), 6) session completes and results render (incl. closure fallback), 7) history records it, 8) mobile viewport smoke check, 9) error logs clean for 10 minutes. | `[W]` (verify), `[R]` (specific checklist) |
| Cost guardrails `[R]` | All free tiers (Vercel, Neon, **Gemini Free tier**, subject to the project's actual quota per D8); AI spend bounded structurally (max **15** hint generations per mystery via `ai_hint_cache` + rate limits); token usage recorded per cache row; paid fallback ≈ **$0.01/session** on `gemini-3.5-flash-lite` (Section 4.10); re-verify Gemini availability/quotas/pricing before enabling production traffic. | `[R]` |

---

## 12. MVP and Future Enhancements

### 12.1 MVP — build this `[MVP]` (locked by the Decision Register)

1. **Guest access** `[W]` (D3 approved) **plus** email/password registration & login `[W]` kept as an additional capability.
2. **Mystery selection** `[W]` — catalog UI containing **exactly one complete, polished mystery** (D4).
3. **Difficulty selection** `[W]` — Easy / Medium / Hard session profiles (time limit + scoring).
4. **Multiple puzzle stages with gating** `[W]` — **exactly five stages** (D10), each with narrative, clues, one puzzle.
5. **AI-generated contextual progressive hints** `[W]` + Additional Requirement 1 — live Gemini calls through the provider-independent adapter, cached per (stage, level), 3 levels, leakage-guarded, with `source` attribution.
6. **Playability without the AI provider** — Additional Requirement 2: seeded static hint bank + deterministic evaluation + static closure template.
7. **Server-side answer validation** `[W]` — deterministic normalization/matching only (D6), backend-authoritative (Additional Requirement 4).
8. **Timer and scoring with hint penalties** `[W]` — server-authoritative (Additional Requirement 4).
9. **Results page** `[W]` (score breakdown, AI closure with fallback) **+ game history** `[W]`.
10. **Hardening** `[R]` — rate limiting, answer-leak protection (Additional Requirement 3), error/loading states, responsive UI.

### 12.2 Deferred from the MVP — by decision (design retained, do not build now) `[DEFERRED]`

| Deferred item | Decision | Where the design lives |
|---|---|---|
| On-demand AI mystery/scenario generation | **D5** | Sections 4.1, 4.6, 7.9; `mysteries.source='ai'` + `ai_generation_meta` reserved in Section 6.2 |
| AI puzzle & riddle generation at runtime | **D5** | Sections 4.2, 4.6 |
| AI-assisted answer judging (Tier 2) | **D6** | Section 4.3; `evaluated_by` enum reserved in Section 6.2 |
| Mystery library with 3+ mysteries | **D4** | Library/API/UI are catalog-ready; only content is missing |
| Deferred beyond the earlier baseline | — | Rank-label tuning, guest-account upgrade flow polish |

*These items may be scheduled as post-MVP phases without reworking the architecture — that is the point of retaining their design.*

### 12.3 Future enhancements (post-MVP) `[W]` items marked, all `[R]` detail

| Enhancement | Notes |
|---|---|
| Multiplayer mysteries `[W]` | Cooperative rooms; requires websockets/real-time service and server-authoritative turn handling. |
| Leaderboards `[W]` | Per mystery/difficulty; anti-cheat = server-scored only, tamper-evident score rows. |
| User-created mysteries `[W]` | Editor + AI assist + moderation queue; new `creator` role. |
| Additional AI personalities `[W]` | Persona-driven narrators/hint givers (e.g., sarcastic consultant, Victorian inspector) as system-prompt profiles. |
| Community challenges `[W]` | Weekly shared seed/mystery with identical timer for fair comparison. |
| Advanced analytics `[W]` | Funnel/step-drop-off analysis, per-puzzle difficulty calibration from attempt data. |
| *(extra `[R]`)* | In-character NPC dialogue, sound design, achievements/badges, mystery packs by theme, localization. |

**Also explicitly out of MVP (no ambiguity):** multiplayer, leaderboards, mystery editor, AI personalities, chat-with-characters, analytics dashboards, admin UI, notifications, i18n, generated mysteries (D5), AI judging (D6).

---

## 13. Acceptance Criteria

The MVP is **complete** when all of the following are demonstrably true (measurable, test-covered):

**Workshop-derived `[W]`**

| # | Criterion |
|---|---|
| AC1 | A new player can register and log in **or** start as a guest, and can log out; protected routes return 401 without a session. |
| AC2 | The dashboard displays the player's game history and progress, and it persists across sessions/logins. |
| AC3 | A player can browse the published mystery library (MVP: exactly one mystery, D4) and choose Easy, Medium, or Hard before starting. |
| AC4 | A session starts with a server-set countdown (20/30/45 min by difficulty) and displays a live timer that matches server time within 2 s. |
| AC5 | Each mystery stage presents narrative + clues + exactly one puzzle; the next stage is unreachable until the current answer is validated as correct (verified by an automated progression test). |
| AC6 | Submitting an incorrect answer never advances the stage and is recorded in history; submitting the correct answer unlocks the next stage in the same response. |
| AC7 | AI runs live in the game: requesting a hint with the provider healthy returns AI-generated content (`source:"ai"`, produced by Gemini, schema-valid, leak-free); with the provider forced down, the same request returns the static fallback (`source:"static"`) and **the player can still complete the whole mystery**. |
| AC8 | A player can request hints; hint 1 (and every hint) never contains the complete answer (guarded by automated leakage test); hint usage is recorded. |
| AC9 | Score = documented formula, computed server-side, shown on the results page with breakdown; hint penalties reduce the score (asserted numerically in tests). |
| AC10 | On completing the final stage the player sees a final results/summary page; on expiry the session ends as `timed_out` with partial score. |
| AC11 | All screens are responsive and usable at 360 px, 768 px, and 1440 px widths with no horizontal scrolling. |
| AC12 | Loading and error states exist for every async action, and correct/incorrect answers give clear visual feedback. |

**Recommended additions `[R]`**

| # | Criterion |
|---|---|
| AC13 | Exactly **one** complete mystery is published (D4) with **exactly five stages** (D10), exercising at least three puzzle types, playable end-to-end at Easy, Medium, and Hard with identical puzzle content and answers across profiles (D11), using the documented time limits and max scores (700/1100/1500). |
| AC14 | No canonical answer, unsolved explanation, un-granted hint (static or cached AI), or future-stage content appears in any API response or client bundle (automated payload-scanning test). |
| AC15 | Unit + API + E2E suites pass in CI; scoring, progression, auth, and **hint-fallback** suites are mandatory. |
| AC16 | Deployed on a public URL with `/api/health` = ok and the full deployment-verification checklist (Section 11) executed. |
| AC17 | AI endpoints are rate-limited, API key is absent from client code and logs, passwords are bcrypt-hashed. |
| AC18 | The answer-submission path performs **zero AI calls** (test asserts no provider invocation on `POST …/answers`) — D6 compliance; deterministic evaluation only. |
| AC19 | The MVP stays within the minimal dependency list (Section 5.6) and introduces no new infrastructure beyond Vercel + Neon. |

---

## 14. Development Roadmap

**Numbering scheme:** phases are labeled **P0–P8**, where **P = Phase**, numbered in dependency order. **P0 is the pre-implementation decision gate** (specification approval — it produces no code); **P1–P8 are sequential build phases**; workshop phases 3–6 (Set Up → Build → Test & Deploy → Final Submission) map onto P1–P8 as shown. A phase is "done" only when its completion criteria are objectively met (tests green, checklist passed).

| Phase | Workshop phase | Contents | Depends on | Completion criteria |
|---|---|---|---|---|
| **P0 — Specification & decisions** | 2 (this document) | Approve spec revisions; close Decision Register D1–D11; freeze MVP scope. | — | ✅ D1–D11 resolved (Section 15.3), no open decisions (15.4); **completed by approval of this v0.3 revision** — the final implementation authorization is the gate to P1. |
| **P1 — Project setup** | 3 | Init Next.js + TS + Tailwind + Prisma **with npm** (D7); env config (`.env.example`); Neon DB; lint, typecheck, CI skeleton; base layout, design tokens, `/api/health`. | P0 | `npm run dev` runs; CI green; `/api/health` returns ok against dev DB. |
| **P2 — Data model, content & auth** | 3–4 | Schema + migrations; **author the single five-stage (D10) MVP mystery via the approved hybrid method (D9): AI-assisted draft → human review & refinement → seed script** (5 stages, clues, answer keys, static hint bank) + seed-time consistency checks; register/login/logout/guest; session middleware + route protection; dashboard shell. **No runtime generation (D5).** | P1 | Auth API tests pass; seeded DB serves the mystery library (`GET /api/mysteries` returns 1 published item with `stageCount:5`); seed validation checks green (5 stages × 3 static hints × 1 answer key). |
| **P3 — Game core (no AI)** | 4 | Sessions, stage payload endpoint, state machine, deterministic answer validation, timer/expiry, difficulty profiles (time + scoring only, D11), scoring, static hint grants, results, history. | P2 | Full playthrough of the seeded mystery (**5 stages × 3 difficulties**) passes progression + scoring tests (max scores 700/1100/1500). **First vertical slice — game is completable end-to-end with zero AI.** |
| **P4 — AI integration (hints & closure)** | 4 | Gemini provider adapter (plain `fetch`, timeout/retry/breaker); **D2/D8 verification: create key → check this project's actual availability, quotas, free-tier eligibility and pricing (documented free tier ≠ guaranteed project quota) → confirm/record model (`gemini-3.6-flash` default, `AI_MODEL` override)**; hint prompt + leakage guard + `ai_hint_cache` + static fallback; closure paragraph; degraded mode. *(Generation and judge are NOT in this phase — D5/D6 deferred.)* | P3 | AI contract tests pass with mocked provider; live smoke test produces a real `source:"ai"` hint; forced provider failure still lets a session complete; verification results recorded (D8 closed with evidence). |
| **P5 — UI/UX build-out** | 4 | All nine screens, puzzle input components, feedback animations, loading/error/empty states, responsive + a11y pass. | P3 (parallel with P4) | Responsive checklist + keyboard pass; no dead clicks; E2E happy path green in UI. |
| **P6 — Hardening & testing** | 5 | Rate limiting, sanitization, security headers, payload-leak scan, full test matrix, bug bash, performance pass (LCP < 2.5 s on landing). | P4, P5 | All acceptance criteria AC1–AC19 verified; CI blocks regressions. |
| **P7 — Deployment** | 5 | Vercel + Neon production, env vars, migrations, seed, verification checklist, monitoring/logging hookup. | P6 | Public URL live; Section 11 deployment-verification checklist signed off. |
| **P8 — Final submission** | 6 | README (setup/run/deploy), architecture notes, spec↔demo traceability, demo recording/walkthrough, repo polish. | P7 | Submission package complete; demo can be run from a clean clone. |

**Risk notes:** P4 is the highest-risk phase (model output quality, quota discovery) — P3 deliberately makes the game fully playable without AI so P4 can never block the MVP, and static hints guarantee a demo even if quotas fail. Scope can still shrink within the approved register by descoping, in order: closure paragraph → guest-account upgrade flow → rank labels. D5/D6 remain deferred and must not re-enter scope without a new decision.

---

## 15. Assumptions, Risks, Decision Register & Consistency Verification

### 15.1 Assumptions (explicit) `[R]`
1. **A1** Only the workshop phases and product description quoted in Document Conventions were available; no rubric/grading sheet exists, so no other requirement is attributed to the workshop.
2. **A2** Single-player, English-language MVP; one session at a time per player per mystery.
3. **A3** An empty repository was found, so the stack is chosen from scratch (cost- and beginner-optimized).
4. **A4** Free-tier limits are acceptable: Vercel (Hobby), Neon (free), **Gemini API Free tier** for AI calls (availability/pricing checked against official docs 2026-11-01, Section 4.10). **Documented free-tier access is not assumed to guarantee this project's quota** — the project's real quota is verified with its own key in P4 (D8); paid fallback is ≈ $0.01/session.
5. **A5** Mystery content is text-only (no images/audio assets required); cover art is CSS/gradient-generated.
6. **A6** "Rooms" and "stages" are the same concept; a mystery = a sequence of stages/rooms.
7. **A7** Answer evaluation is deterministic (canonical answers + aliases); **AI judging is deferred (D6)** — free-text puzzles are curated at content time so normalization matches reliably.
8. **A8** Timers do not need real-time multiplayer sync; timestamp-derived countdown is sufficient.
9. **A9** Admins/authoring are out of band (seed script), not a UI.
10. **A10** Difficulty changes **only** time limits and scoring; puzzle content, stage count, and **answers are identical across difficulty profiles** — per-difficulty content or answers must not be introduced (**D11, approved**). The single mystery is tuned to be beatable at all three levels.
11. **A11** The MVP mystery exists as a reviewable artifact produced by the **approved hybrid method (D9)**: AI-assisted initial drafting → human review and refinement → stored in the database via seed script; **no runtime mystery generation (D5)**.
12. **A12** "AI-powered application" for evaluation/demo purposes is satisfied by **live AI hint generation** (+ AI closure) with visible `source:"ai"` attribution; runtime mystery generation is not required for the MVP (D5).
13. **A13** The MVP mystery has **exactly five stages (D10)** — consistent across §2B scoring, §6.2 schema/seed, §3 flows, §10 tests, and AC13.

### 15.2 Risks `[R]`
| Risk | Impact | Mitigation |
|---|---|---|
| Single-mystery content quality (one shot, D4) | High | Seed-time consistency checks (4.1), playtest at all three difficulties (P3), content polish pass before P6, mystery is isolated rows — improving it never touches code. |
| Gemini quota/availability differs from docs (exact per-model RPM/RPD not public) | Medium | **D2 requires verification before integration** (P4 checklist, Section 4.10); model configurable via env; static hints guarantee playability regardless. |
| AI leaks answers via hints | High | Server-side leakage guard + re-generation + static fallback, payload scanning, AC14 test, prompt rules, per-(stage,level) caching of already-guarded content. |
| Provider cost/latency spikes | Medium | Hint cache bounds generation to ≤ **15** calls/mystery, rate limits, `gemini-3.6-flash` default (D8), circuit breaker, cost recorded in `ai_hint_cache`. |
| Free-tier cold starts / limits (hosting) | Low | Static content + static hints, health checks, Render alternative documented. |
| Score/timer cheating | Medium | Server-authoritative scoring and expiry; no client-trusted state; answer path has no AI to influence it. |

### 15.3 Decision Register *(D1–D7 approved 2026-11-01; D8–D11 approved in the v0.3 review — no open decisions remain)*

| # | Decision topic | Resolution | Status | Impact on this spec |
|---|---|---|---|---|
| **D1** | Technology stack | **Next.js App Router + TypeScript + Tailwind CSS + Neon PostgreSQL + Prisma** | ✅ APPROVED | §5.1 primary stack; alternatives removed from scope |
| **D2** | AI provider | **Gemini API through a provider-independent adapter**; credentials in env vars; **verify actual API availability, quotas and costs before integration** | ✅ APPROVED (verification executed in P4) | §4.10 (docs checked 2026-11-01), §5.1, §5.5; model per D8 |
| **D3** | Guest mode | **Guest gameplay supported**; registration kept as an additional capability if practical | ✅ APPROVED | §2A, §7.1 (guest + upgrade endpoints) |
| **D4** | Mystery count | **ONE complete, polished, playable mystery with multiple stages** | ✅ APPROVED | §2B, §6.2 (single seeded row), §7.3, AC3/AC13; five stages via D10 |
| **D5** | On-demand AI mystery generation | **DEFERRED** — predefined mystery stored in the database for MVP; architecture kept extensible for future generation | ⏸ DEFERRED | §4.1/§4.2/§4.6/§7.9 marked `[DEFERRED]`; no generation endpoint in MVP |
| **D6** | AI answer judge | **DEFERRED** — deterministic normalization and matching first; AI-assisted evaluation possible later | ⏸ DEFERRED | §4.3 single-tier, §7.5 (no AI errors on answer path), AC18 |
| **D7** | Package manager | **npm** | ✅ APPROVED | §5.1, §5.6, P1 (`npm run dev`) |
| **D8** | Gemini model | Initial default **`gemini-3.6-flash`**; **configurable via `AI_MODEL`**; during **P4** verify actual API availability, account quotas, free-tier eligibility and pricing; **documented free-tier access does not guarantee any particular project's quota** | ✅ APPROVED | §4.10, §5.5, P4, A4 |
| **D9** | Mystery authoring | **Hybrid:** AI-assisted initial draft → human review & refinement → stored in the database through a seed script; **no runtime mystery generation in the MVP** | ✅ APPROVED | P2, A11; reinforces D5 |
| **D10** | Stage count | **Five stages** for the single MVP mystery | ✅ APPROVED | §2B, §6.2 (`stage_count`=5), scoring max 700/1100/1500, P2/P3, AC13, A13 |
| **D11** | Difficulty | Difficulty changes **time limits and scoring only**; puzzle content identical across profiles; **no different puzzle answers/content per difficulty** | ✅ APPROVED | §2B, §3.4, §6.2, §7.3 profiles, A10, AC13 |

**Additional requirements carried into scope (from the review):** ① AI contextual progressive hints remain MVP (§2D, §4.4); ② playability when the provider is down (§4.9, AC7); ③ no answer/solution exposure to the frontend (§9.6, AC14); ④ backend-authoritative progression and scoring (§4 golden rule, §9.4); ⑤ no extra infrastructure/unnecessary dependencies (§5.6, AC19); ⑥ future enhancements kept separate from MVP (§12.2 vs §12.3).

### 15.4 Open decision status: **none** `[R]`

All decisions **D1–D11** are resolved in Section 15.3 (nine approved, two deferred: D5, D6). **No unresolved decision blocks implementation.** Any future scope change (including re-opening D5/D6) requires a new numbered decision added to the register, not an inline change.

### 15.5 Consistency verification (v0.2 baseline; final validation in v0.3) `[R]`

Cross-checked and reconciled across revisions:

| Check | Result |
|---|---|
| Acceptance criteria ↔ API design | AC7 now matches §7.6 (`source:"ai"|"static"`); AC13 matches §7.3 (one mystery); `POST /api/mysteries/generate` removed from active API (moved to §7.9); no `503 AI_UNAVAILABLE` left in §7.5. |
| Acceptance criteria ↔ database design | AC13's stage counts match `mysteries.stage_count` (3–8) and the 5-stage tuning table; AC14 matches `stage_answers`/`ai_hint_cache` isolation rules in §6.2; judge columns removed (D6). |
| Acceptance criteria ↔ roadmap | AC ranges updated to AC1–AC19 in P6; AC16 now points to the Section 11 checklist (the old "11.6" label did not exist). |
| Database ↔ API | `mysteries` difficulty-scoped columns removed ⇒ §7.3 returns `supportedDifficulties` + `difficultyProfiles`; `game_sessions.difficulty` remains the authoritative chosen profile. |
| Roadmap numbering | P0–P8 scheme explicitly defined (P0 = decision gate, no code); P1 uses npm (D7); P2 owns content seeding (D4); P4 owns Gemini verification (D2/D8) and excludes D5/D6 work. |
| AI requirements vs MVP | Live AI = hints + closure (§2C, §4.4, §4.6) with `source` attribution (AC7) — sufficient to demonstrate an AI-powered app; generation and judging retained but clearly `[DEFERRED]`. |
| Deferred isolation | Every deferred item appears in §12.2 and nowhere in §12.1 MVP list. |

**Final validation performed for v0.3:**

| Check | Result |
|---|---|
| Decision register completeness | D1–D11 all present with resolution, status, and spec impact (§15.3); §15.4 confirms **zero** open decisions; TOC and conventions references updated. |
| Five-stage consistency (D10) | **Five stages everywhere:** §2B (profiles table, `5 / 5 / 5`), §6.2 (`stage_count` = 5, CHECK equals seeded rows), scoring (max 700/1100/1500 = 5 × base + completion + 20% time bonus), §10 progression tests ("5 stages × 3 difficulties"), AC13, roadmap P2/P3, assumption A13. **Corrected three stale bounds derived from a former 6-stage assumption: max hint generations 18 → 15** in §4.10, §9.5, §11, §15.2 (5 stages × 3 levels). |
| §4.10 factual correction | `gemini-4-argon` reference **removed** (no claim made about models outside the Flash-class models this spec uses); every remaining model/pricing claim mirrors the official pricing/rate-limits pages cited with the fetch date; **derived cost math corrected** ($0.0006 → ≈ **$0.01 per session** at paid `gemini-3.5-flash-lite` rates; $0 on free tier); **caching distinction added** — application-level `ai_hint_cache` in our database vs Gemini API context caching (provider-side, model-dependent, **unused by this project**, no availability assumed); D8 rules stated (default `gemini-3.6-flash`, `AI_MODEL` override, P4 verification, documented free tier ≠ guaranteed project quota). |
| Acceptance criteria AC1–AC19 | All **19 criteria present and mutually consistent**: AC3/AC13 updated for D4/D10/D11 (one mystery, five stages, identical content per difficulty); AC7 ↔ hint `source` API; AC14 ↔ answer-isolation schema; AC16 ↔ Section 11 checklist; AC18 ↔ D6; AC19 ↔ §5.6 dependency list. P6 requires AC1–AC19 verification. |
| Roadmap P0–P8 | Numbering scheme defined (P0 = decision gate, no code); dependency chain P0 → P1 → P2 → P3 → (P4 ∥ P5) → P6 → P7 → P8 is acyclic; workshop mapping (phases 3–6 ↔ P1–P8) intact; P0 completed by this v0.3 approval; D8/D9/D10/D11 reflected in P2 (hybrid authoring, 5 stages), P3 (difficulty = time/scoring only), P4 (quota/eligibility/pricing verification); no deferred D5/D6 work in any phase. |
| Deferred features absent from MVP | §12.1 contains no deferred item; active API (§7.1–7.8) has no generation/judge endpoint (they live in §7.9, marked deferred); schema holds only **inert reserved values** (`mysteries.source='ai'`, nullable `ai_generation_meta`) with no code path, endpoint, or acceptance criterion requiring them; AC18 enforces zero AI calls on the answer path. |
| Traceability matrix preserved | Appendix A retained in full and updated for D4/D5/D6/D10 scope statements. |

---

## Appendix A — Workshop Traceability Matrix

| Workshop requirement (verified) | Spec section(s) |
|---|---|
| Project Overview phase | 1, 15 |
| Detailed Specification phase (this document) | whole document |
| Set Up the Project phase | 5, 11, 14 (P1) |
| Build the Application phase | 2, 3, 4, 7, 8, 14 (P3–P5) |
| Test and Deploy phase | 10, 11, 14 (P6–P7) |
| Final Submission phase | 14 (P8), 13 |
| AI-powered interactive mystery/escape-room web app | 1.2, 1.3 |
| Solve mysteries, investigate clues, answer puzzles, progress through rooms | 2B, 2E, 3.6–3.10 |
| Player registration/login, dashboard, history/progress | 2A, 3.1–3.2, 7.1–7.2, 6.2 (`users`, `game_history`) |
| Multiple mystery scenarios; Easy/Medium/Hard; multiple stages; narrative + clues + puzzle per stage; gated progression | 2B, 6.2, 7.3–7.5 — MVP ships one mystery (D4), difficulty as session profile, library-ready shape |
| AI: scenarios, puzzles/riddles, clues, answer evaluation, explanations, consistency | 2C, 4.1–4.3, 4.6 — explanations + seed-time consistency are `[MVP]`; generation `[DEFERRED — D5]`, AI judging `[DEFERRED — D6]` (deterministic evaluation ships instead) |
| AI: progressive hints, no full answer in first hint, hint tracking | 2D, 4.4, 7.6 — **live AI hints are the core MVP AI feature**, with static fallback and leakage guard |
| Timer, score, hint penalties, stage progression, completion, final results | 2E, 3.10–3.11, 7.7 |
| Responsive UI, room interface, navigation, loading/error states, feedback | 2F, 8 |
| Eleven documented user flows | 3 (11 subsections) |
| AI architecture: generation, hints, state mgmt, JSON, validation, errors, fallback | 4 |
| Backend (not AI) is authoritative for progression | 4 (golden rule), 7.5, 9.4 |
| Tech stack recommendation after repo inspection | 5 |
| Database entities & relationships | 6 |
| API endpoints (auth, mysteries, sessions, answers, hints, progress) | 7 |
| UI/UX screens & immersive dark design | 8 |
| Security & reliability list | 9 |
| Testing strategy (unit, API, AI, auth, progression, responsive, E2E) | 10 |
| Deployment (frontend, backend, DB, env vars, prod config, verification) | 11 |
| MVP scope / future enhancements | 12 |
| Acceptance criteria | 13 |
| Roadmap with phases, dependencies, completion criteria | 14 |

---

**End of specification (v0.3 — final).** Only this file exists. **No implementation, dependency installation, database initialization, or application code has been started.** The Decision Register (Section 15.3) is complete for D1–D11 with no open decisions (Section 15.4).

**Awaiting final implementation authorization.** Upon authorization, work begins at **Phase P1 — project setup** (npm, Next.js, Tailwind, Prisma, Neon) per Section 14.

