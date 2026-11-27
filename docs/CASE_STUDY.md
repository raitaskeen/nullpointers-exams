# Case Study Analysis - Invigil, a Secure Examination Management System

Technoverse 5.0 Web-e-Thon, 27 November 2026. Source: "Web-e-Thon Problem Statement" (7 pages) + final competition guide.

## 1. What is being asked (summary of the brief)

A full-stack web app for institutions and competition organisers to **create, conduct, monitor and evaluate online examinations**, reliably and accessibly, addressing at least one open innovation challenge.

- **Roles**: Administrator (users, roles, permissions, platform), Examiner (exams, questions, candidates, monitoring, grading, publishing), Candidate (take assigned exams, submit, see published results).
- **Core (30 marks)**: 3.1 auth/authorization enforced on the backend · 3.2 exam lifecycle draft → published → ongoing → completed · 3.3 reusable question bank (topics, difficulty; single-answer MCQ, multi-select, written; randomisation that preserves the marking scheme for an active attempt) · 3.4 enrolment + candidate view of available/upcoming/completed exams + availability window · 3.5 exam workspace (timer, navigation, answered/unanswered/marked-for-review, autosave, resume after refresh, submit, auto-finalise at expiry) · 3.6 monitoring (active attempts, progress, incidents - not proof of misconduct, announcements) · 3.7 grading (auto for objective incl. multi-select rules, manual for written with mark validation, consistent totals, review before publish) · 3.8 controlled publication, own-results-only, exam- and candidate-level analytics from real data, retained attempts.
- **Secondary (15 marks, all 8 expected)**: network-aware UI · PDF reports · examiner sandbox · bulk import (CSV/JSON) · question analytics · verifiable reports · customisable workspace · scratchpad.
- **Technical (20)**: server-side authorisation; protect answer keys and personal data; server-side timing independent of the device clock; no duplicate submissions or inconsistent grading; frontend + backend validation; graceful handling of refreshes, repeated actions and interrupted requests.
- **Innovation (15)**: at least one of 5.1-5.5, judged on quality not quantity.
- **UI/UX (20)**: intuitive, discoverable, accessible, responsive, **not generic or template-like**.

## 2. Ambiguities, gaps and contradictions - and how we resolved them

| # | Requirement | Issue | Our resolution |
|---|---|---|---|
| 1 | "draft, published, ongoing and completed" | Is "ongoing" a stored state or a time window? A stored flag would need a scheduler to flip it. | Stored: `draft`, `published`, `completed` (examiner can close early). **Ongoing is derived**: published and `now` inside the window. No cron, never stale. |
| 2 | "schedule, duration" | A window (start-end) and a duration both exist - what if a candidate starts late? | Window = when an attempt may start; duration = per-attempt length. **Deadline = min(start + duration, window end)**. Late starters get less time; shown before starting. |
| 3 | "Candidates must not access an examination before it is available" | Should candidates see upcoming exams at all? | They see title, schedule and instructions of exams they're enrolled in; **questions are only served once an attempt starts inside the window**, and never from a list endpoint. |
| 4 | "multiple-select ... marking rules" | Rules not specified. | Per question: **all-or-nothing** (default) or **partial** = marks × (correct picked − wrong picked) / correct options, floored at 0. Shown to the candidate on the question. |
| 5 | "randomized where applicable ... preserve the marking scheme for an active attempt" | Editing a question mid-exam would change a running attempt. | When an attempt starts we **snapshot** its paper (questions, options, correct answers, marks, scheme, order) into the attempt. Grading always uses the snapshot. |
| 6 | "total marks" configured by examiner | Could disagree with the sum of question marks. | Publishing is **blocked** unless the paper's marks equal the configured total (validated client and server). |
| 7 | "Automatically save answers ... finalize at expiry using answers accepted within the permitted period" | Server can't trust the device clock; saves can arrive late because of the network. | The **server owns the clock**. Answers are accepted only while the attempt is open and `server now ≤ deadline`. At/after the deadline the attempt is finalised (lazily on the next request, or by the examiner view) with what was accepted. |
| 8 | "Prevent duplicate submissions" | Double-clicks, retries, two tabs. | Submit is **idempotent** (conditional update `status = in_progress`); one attempt per candidate per exam (unique index); the UI disables while pending. |
| 9 | "Monitoring indicators must not be treated as conclusive evidence" | How to present incidents without accusing. | Incidents are labelled **"signals"** with neutral wording and counts; no automatic penalties; examiner can add a note. |
| 10 | "Candidates view only their own published results unless authorized otherwise" | Who else is authorised? | Admins and the exam's examiner. Enforced in queries, not just the UI. |
| 11 | Secondary "Examination sandbox" | Must not affect stats - but must it store anything? | Sandbox attempts are real attempts flagged `is_sandbox`, **excluded** from results, analytics, PDFs and publication; deletable. |
| 12 | "Verifiable reports ... without exposing unnecessary information" | What does a verifier see? | Public `/verify?code=` shows exam title, **masked** candidate name, score/percentage, issue date and valid/revoked - nothing else. |
| 13 | "No required feature may depend on paid APIs" | Our AI assistant uses Groq. | The assistant is **optional** and off without a key; no core or secondary feature depends on it. |
| 14 | Rulebook said Vercel earlier; final guide says any host | Contradiction between guide versions. | Final guide wins: deploy everything on **Cloudflare** (one Worker, one origin). |

## 3. Technical analysis

- **One Cloudflare Worker serves the static Next.js front end and the Hono API on the same origin** - first-party httpOnly session cookie, same-origin WebSockets, one deploy. Rejected: separate web host + proxy (extra failure point), VM (ops burden).
- **D1 (SQLite) + Drizzle**: relational data with foreign keys and unique constraints (one attempt per candidate, one answer per question per attempt) that *enforce* integrity rules rather than hoping code does.
- **Snapshot-on-start** for attempts (see #5) instead of re-reading live questions: correctness over storage.
- **Server-authoritative timing**: the client only renders a countdown from the server deadline and a measured clock offset.
- **Durable Objects** push live progress and incidents to examiners and announcements to candidates.
- **PDFs generated on the server** (pdf-lib) so access checks run before any data is rendered; QR code drawn into the PDF for verification.
- **TypeScript end to end, no Rust**: no marks for a specific technology; one shared Zod schema validates browser and API; rewriting the tested auth/RBAC/realtime core would cost hours better spent on requirements.

## 4. Constraints

- 10 hours, build freeze at **19:30 PKT** (deadline 20:00); no commits/builds/deploys after.
- Team of three; one shared production environment.
- No paid dependency for required features; must demo with fictional data.
- Candidates use laptops and phones of varying quality on unreliable networks - drove offline queueing, resume-anywhere and a light, fast UI.
- Privacy: monitoring limited to browser-level signals (focus, visibility, clipboard, fullscreen, connectivity); **no webcam or screen recording**.

## 5. Data model

`users`, `roles`, `user_roles` (admin / examiner / candidate) · `questions` (bank: topic, difficulty, type, prompt, options, answer key, marks, scheme) · `exams` (window, duration, total, settings, status, results_published) · `exam_questions` (paper, order, marks) · `enrollments` · `attempts` (paper snapshot, server deadline, status, score, verification code, sandbox flag) · `answers` (response, flag-for-review, auto score, manual score, feedback) · `incidents` · `announcements` · `disputes` · `audit_log`.

## 6. Innovation challenges addressed

- **5.3 Failure-resilient examinations** (primary): server-owned clock; every answer saved immediately and queued locally while offline, replayed on reconnect; resume on any device with the same deadline; connection loss recorded as a signal; time compensation only by an examiner, per attempt, logged.
- **5.2 Fairness of randomised papers**: stratified draw - each candidate gets the same number of questions per difficulty level from a larger pool, so papers vary but carry equal difficulty and equal marks.
- **5.4 Trust & dispute resolution**: candidates raise a dispute on a published result per question; examiners resolve with a reason; mark changes recalc the total, are audited, and the verification record reflects the latest version.

## 7. Cut-line

In: all core 3.1-3.8, all eight secondary features, 5.3 + 5.2 + 5.4. Out (would do next): proctoring with camera (privacy, hardware), LMS integration, multi-institution tenancy, question-paper versioning UI.
