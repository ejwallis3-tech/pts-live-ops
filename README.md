# Passionate to Serve — Live Simulation Dashboard (source)

Express + Vite + React + Tailwind + shadcn/ui + Drizzle/better-sqlite3 webapp used to run the live "Service Under Pressure" branch simulation during the Passionate to Serve Exco afternoon.

Latest live preview: https://www.perplexity.ai/computer/a/passionate-to-serve-live-simul-6cQCc8eYRlqfgMWf5YvTCg

## Setup (in a fresh sandbox/session)

```
npm install
npx drizzle-kit push --force   # creates data.db with the current schema
npm run build
NODE_ENV=production node dist/index.cjs   # serves on port 5000
```

`data.db` (and its `-wal`/`-shm` files) are intentionally not stored here — they hold only in-run scores and reset between dry runs and the live session via the Control page's "Reset all data" button.

## Feature summary

- Three branch stations (A/B/C), each with a Customer NPS entry, Frontline interaction timer + outcome log, and cross-branch slip requests routed A→B→C→A.
- Facilitator Control page: round timer, leaderboard reveal toggle, reset, a card delivery checklist (the 7 dilemma/disruption cards stay physical/paper — the app only tracks timing + delivered status, never card text), and a "send announcement" tool (to one branch or all).
- Morale (0-100, baseline 50) is folded into the Service Score as a fifth weighted component (20 of 120 points), driven by cross-branch slip treatment (both sending and resolving side) plus each branch's own interaction outcomes (escalations/promise-broken dips).
- Announcements are auto-generated from scorable events (slip declined/approved, escalations, promise-broken) and can also be pushed manually by the facilitator to one branch or all; each branch station shows a live announcement feed and toasts on new ones only (not on page load/refresh).
- **External events**: 6 pre-scripted "shocks" defined in `shared/external-events.ts` — 2 per branch, mixed NPS/morale impact, mixed positive/negative, each with its own trigger minute after round start. No branch decision is ever involved — an event either auto-fires when the round clock crosses its trigger minute, or the facilitator fires it early from the Control page's "Automatic events" panel with a "Trigger now" button (`POST /api/external-events/:eventId/trigger`, `storage.triggerExternalEvent`). Either way it posts a system announcement to that specific branch and adjusts its NPS or morale score directly, and each event can only ever fire once (idempotent — the clock and the manual button race safely). The panel shows every event's branch, message, trigger minute, impact, and status (Pending / Firing now / Fired) for the facilitator's own visibility and debrief prep.
- Dashboard: live leaderboard with per-branch stat cards (NPS, avg time, served, slips resolved, morale) and a transparent score-breakdown legend; reveal is facilitator-controlled from the Control page, not automatic.

## Automatic external events — current draft catalog

Defined in `shared/external-events.ts`. Timings and wording are a first draft — adjust freely.

| Event | Branch | Trigger | Impact | Tone |
| --- | --- | --- | --- | --- |
| Unplanned staff shortage | A | ~minute 5 | −4 NPS pts | Negative |
| Smooth systems morning | A | ~minute 19 | +3 NPS pts | Positive |
| Overdue request flagged | B | ~minute 10 | −8 morale | Negative |
| Regional manager praise | B | ~minute 24 | +6 morale | Positive |
| Queue backup outside the branch | C | ~minute 6 | −3 NPS pts | Negative |
| Backlog cleared overnight | C | ~minute 17 | +5 morale | Positive |

NPS-type impacts only show up once a branch has at least one real (non-null) average NPS score to adjust — they can't push a branch below 0 before real customer data exists. Morale-type impacts apply immediately against the 50-point baseline.
