# Judge playbook - Invigil

15-minute live evaluation. Rehearse on the **deployed URL** (https://nullpointers-exams.np-api.workers.dev), never localhost.

## Before the judges arrive (T-15 min)

- [ ] `cd apps/api && bun run demo:remote` - re-centres the live quiz on "now" and resets demo attempts.
- [ ] Window 1: signed in as **Examiner** (Dr. Ayesha Khan). Window 2 (private): **Candidate** - use Zainab, Ali, Usman or Mariam (not started yet).
- [ ] Tabs open: `/architecture`, `docs/CASE_STUDY.md`, the GitHub repo.
- [ ] Light mode, zoom 110% for the projector. Phones charged for the mobile check.
- [ ] Freeze is set; nobody pushes.

## Demo script

| Min | Show | Brief section |
|---|---|---|
| 0:00 | Landing: one sentence on the problem. Click **Drop the connection** in the Resilience section. | Overview, 5.3 |
| 1:00 | Sign in as Examiner (one click). Overview: live exam, answers to grade, open dispute, recent results. | 3.1, 3.6 |
| 2:00 | **Question bank**: filter by difficulty; open the editor, submit empty → same messages the API would give. **Import** the template CSV: per-row preview and errors. | 3.3, 4.4, validation |
| 3:30 | **Exams → Web Security** is Bilal's (not visible: server-side authorisation). Create a new exam → Setup checklist blocks publishing until the paper adds up. **Open sandbox** to preview as a candidate. | 3.2, 4.3, 5.2 |
| 5:00 | Candidate window: Overview (available / upcoming / completed) → Start the Databases quiz. Answer two questions, flag one, open the scratchpad, change text size. | 3.4, 3.5, 4.7, 4.8 |
| 6:30 | **Resilience live**: DevTools → Network → Offline. Answer another question: "Offline · 1 saved on this device". Back online → syncs. Refresh the page: same question, same time left. | 5.3, 4.1 |
| 7:30 | Examiner window, **Monitor** tab: the candidate's progress moved live, signals listed with "not proof" wording. Send an announcement → appears in the candidate's workspace. **Add time** with a reason. | 3.6, realtime |
| 9:00 | Candidate: Review → Submit (double-click does nothing extra). | 3.5, idempotency |
| 9:30 | **Midterm → Grading** (written answers, mark limit enforced) → **Results & analytics**: distribution, topics, question analytics (most-common wrong answer, observed difficulty). Download the exam PDF. | 3.7, 3.8, 4.2, 4.5 |
| 11:00 | **Disputes**: accept Sana's dispute with a new mark → total recalculated. Candidate's result PDF → scan QR / open `/verify` → masked name, updated score. | 5.4, 4.6 |
| 12:30 | `/architecture`: system, lifecycle, sync and ERD diagrams, each naming its files. Case study ambiguities. | Technical, case study |
| 13:30 | Questions. | |

## How judges usually test

- **Candidate opens an examiner URL** (`/app/exams`) → "You don't have access"; `GET /api/exams` → 403. Another candidate's result → 404.
- **Start before the window / after it** → refused by the API with a clear message.
- **Refresh mid-exam, close the tab, open on a phone** → same paper, answers and deadline.
- **Change the device clock** → nothing changes: the deadline is server time.
- **Double-click Submit / two tabs** → one submission (conditional update + unique index).
- **Edit a question during a live exam** → running papers unaffected (snapshot).
- **Phone** → bottom bar navigator, 44px targets, no sideways scroll.

## Technology reasons (one sentence each)

- **One Cloudflare Worker** for site + API + WebSockets: one origin, so a first-party httpOnly cookie and no CORS surface; one deploy.
- **Hono**: small, fast, and its middleware chain makes "auth → permission → validation → service" explicit.
- **D1 + Drizzle**: relational data with constraints that enforce exam rules (one attempt per candidate, one answer per question).
- **Durable Objects**: real WebSockets for the monitor and announcements, idle at zero cost.
- **Zod in a shared package**: the form and the API run the same rules, so they can never disagree.
- **pdf-lib on the server**: reports are rendered after the access check, with a QR that points at `/verify`.
- **No paid APIs** for anything required.

## Hard questions

- *"What if the candidate's internet dies for 10 minutes?"* Answers keep saving to the device; the timer keeps running because time is server-side and fair to everyone; on reconnect the queue replays. If the deadline passed meanwhile, the server finalises with what it had accepted; the examiner can add time per attempt for a verified outage, with the reason recorded.
- *"Can a candidate see the answer key?"* No: `correct` never leaves the server for candidates (paper is stripped), and results show only their own response.
- *"Why not a webcam proctor?"* Privacy and hardware; we record neutral browser signals for review and never auto-penalise.
- *"Did you build this in 10 hours?"* The auth/deploy foundation was prepared beforehand, as the rules allow; everything exam-specific was built today - the commit history shows it.
- *"What next?"* Question versioning UI, LMS import (QTI), multi-institution tenancy.
