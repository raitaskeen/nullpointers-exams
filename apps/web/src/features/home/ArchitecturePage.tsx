"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

/**
 * Hand-drawn system diagrams for reviewers: each node names the file that implements it, so the design
 * maps straight onto the code. Drawn as SVG with the app's own tokens (works in light and dark).
 */

const EASE = [0.16, 1, 0.3, 1] as const;

function Figure({ title, body, children, files }: { title: string; body: ReactNode; children: ReactNode; files: string[] }) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, ease: EASE }}
      className="rounded-[1.5rem] border border-border bg-card p-6 shadow-xs sm:p-8"
    >
      <h2 className="text-2xl font-semibold tracking-[-0.03em]">{title}</h2>
      <p className="mt-2 max-w-3xl leading-relaxed text-foreground-soft">{body}</p>
      <div className="mt-6 overflow-x-auto">{children}</div>
      <p className="mt-5 flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
        {files.map((f) => (
          <code key={f} className="rounded-md bg-surface-sunken px-1.5 py-0.5 font-mono">{f}</code>
        ))}
      </p>
    </motion.section>
  );
}

// Shared SVG bits ------------------------------------------------------------------------------------------------
const T = { fill: "var(--foreground)", fontFamily: "var(--font-sans)" } as const;
const M = { fill: "var(--muted-foreground)", fontFamily: "var(--font-sans)" } as const;

function Box({ x, y, w, h, title, lines = [], tone = "plain" }: { x: number; y: number; w: number; h: number; title: string; lines?: string[]; tone?: "plain" | "brand" | "soft" | "dashed" }) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={14}
        fill={tone === "brand" ? "var(--brand-soft)" : tone === "soft" ? "var(--surface-sunken)" : "var(--surface)"}
        stroke={tone === "brand" ? "color-mix(in oklch, var(--primary) 45%, transparent)" : "var(--border-strong)"}
        strokeDasharray={tone === "dashed" ? "6 5" : undefined}
      />
      <text x={x + 16} y={y + 28} fontSize={14} fontWeight={600} {...T}>{title}</text>
      {lines.map((l, i) => (
        <text key={i} x={x + 16} y={y + 50 + i * 19} fontSize={12} {...M}>{l}</text>
      ))}
    </g>
  );
}

function Arrow({ d, label, lx, ly, dashed }: { d: string; label?: string; lx?: number; ly?: number; dashed?: boolean }) {
  return (
    <g>
      <path d={d} fill="none" stroke="var(--foreground-soft)" strokeWidth={1.6} strokeDasharray={dashed ? "5 5" : undefined} markerEnd="url(#arrow)" />
      {label && (
        <text x={lx} y={ly} fontSize={11.5} textAnchor="middle" {...M}>
          {label}
        </text>
      )}
    </g>
  );
}

function Defs() {
  return (
    <defs>
      <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0 0 L10 5 L0 10 z" fill="var(--foreground-soft)" />
      </marker>
    </defs>
  );
}

// 1. System ------------------------------------------------------------------------------------------------------
function SystemDiagram() {
  return (
    <svg viewBox="0 -24 980 454" className="min-w-[760px]" role="img" aria-label="System architecture: browsers talk to one Cloudflare Worker that serves the static site, the Hono API and WebSockets; the API uses D1 and a Durable Object.">
      <Defs />
      <Box x={10} y={30} w={190} h={110} title="Candidate" lines={["Exam workspace", "offline save queue", "server-synced timer"]} />
      <Box x={10} y={160} w={190} h={110} title="Examiner" lines={["Bank, builder, monitor", "grading, analytics"]} />
      <Box x={10} y={290} w={190} h={110} title="Administrator" lines={["People and roles", "every exam"]} />

      <rect x={270} y={14} width={470} height={402} rx={20} fill="var(--surface-sunken)" stroke="color-mix(in oklch, var(--primary) 40%, transparent)" />
      <text x={290} y={42} fontSize={13} fontWeight={600} fill="var(--brand-ink)" fontFamily="var(--font-sans)">One Cloudflare Worker · one origin</text>
      <Box x={290} y={60} w={200} h={92} title="Static site" lines={["Next.js export (Workers", "Assets) + security headers"]} />
      <Box x={510} y={60} w={210} h={92} title="WebSocket rooms" lines={["Durable Object per topic", "exam-N, exam-N-live, attempt-N"]} tone="brand" />
      <Box x={290} y={172} w={430} h={110} title="Hono API  /api/*" lines={["requestId → secureHeaders → CORS/CSRF → body limit → session cookie", "→ requirePermission(role) → Zod (shared) → Service → audit log", "Services: Question · Exam · Attempt · Report (pdf-lib + QR)"]} tone="brand" />
      <Box x={290} y={302} w={200} h={96} title="Server clock" lines={["deadline = min(start +", "duration, window end)"]} />
      <Box x={510} y={302} w={210} h={96} title="Rate limits" lines={["sign-in, verification", "per IP + email"]} />

      <Box x={800} y={150} w={170} h={130} title="D1 (SQLite)" lines={["Drizzle schema", "FKs, unique keys", "snapshot papers", "audit_log"]} />

      <Arrow d="M200 85 C 240 85, 245 106, 286 106" label="HTML, JS" lx={243} ly={78} />
      <Arrow d="M200 215 C 240 215, 250 227, 286 227" label="/api" lx={236} ly={208} />
      <Arrow d="M200 345 C 240 345, 250 260, 286 262" />
      <Arrow d="M200 62 C 330 -30, 560 -20, 615 56" label="WebSocket + 60 s ticket" lx={430} ly={-8} dashed />
      <Arrow d="M720 227 L 796 215" label="SQL" lx={758} ly={208} />
      <Arrow d="M615 172 L 615 156" />
    </svg>
  );
}

// 2. Lifecycle ---------------------------------------------------------------------------------------------------
function LifecycleDiagram() {
  const node = (x: number, label: string, sub: string, tone: "plain" | "brand" | "soft" = "plain") => <Box x={x} y={40} w={170} h={84} title={label} lines={[sub]} tone={tone} />;
  return (
    <svg viewBox="0 0 980 250" className="min-w-[760px]" role="img" aria-label="Exam lifecycle: draft, published, upcoming, ongoing, ended or completed; results are published separately.">
      <Defs />
      {node(10, "Draft", "editable, private")}
      {node(250, "Published", "settings lock", "brand")}
      {node(490, "Ongoing", "derived: now in window", "brand")}
      {node(730, "Completed", "closed or ended")}
      <Arrow d="M180 82 L 246 82" label="checklist green" lx={213} ly={72} />
      <Arrow d="M420 82 L 486 82" label="window opens" lx={453} ly={72} />
      <Arrow d="M660 82 L 726 82" label="close / ends" lx={693} ly={72} />
      <Arrow d="M300 124 C 300 168, 120 168, 95 128" label="back to draft (nobody started)" lx={200} ly={176} dashed />
      <Box x={730} y={160} w={240} h={76} title="Results published" lines={["candidates see own scores"]} tone="soft" />
      <Arrow d="M815 124 L 815 156" />
      <text x={10} y={210} fontSize={12} {...M}>“Ongoing” is never stored: it is computed from the window on every request, so it can't go stale.</text>
      <text x={10} y={230} fontSize={12} {...M}>Publishing is refused unless every possible paper is worth exactly the total marks.</text>
    </svg>
  );
}

// 3. Save / sync -------------------------------------------------------------------------------------------------
function SyncDiagram() {
  return (
    <svg viewBox="0 0 980 300" className="min-w-[760px]" role="img" aria-label="Answer saving: every change goes to a local queue first, then to the API, which accepts it only before the server deadline.">
      <Defs />
      <Box x={10} y={30} w={190} h={90} title="Candidate answers" lines={["click, type (debounced)", "flag for review"]} />
      <Box x={250} y={30} w={210} h={90} title="Device queue" lines={["localStorage, latest per", "question, survives a crash"]} tone="brand" />
      <Box x={510} y={30} w={210} h={90} title="PUT /attempts/:id/answer" lines={["own attempt? in progress?", "server now ≤ deadline + 5 s"]} />
      <Box x={770} y={30} w={200} h={90} title="answers table" lines={["upsert, one row per", "attempt + question"]} />
      <Arrow d="M200 75 L 246 75" />
      <Arrow d="M460 75 L 506 75" label="online" lx={483} ly={66} />
      <Arrow d="M720 75 L 766 75" label="200" lx={743} ly={66} />
      <Box x={250} y={170} w={210} h={92} title="Offline / 5xx" lines={["keep item, retry with", "backoff; 'online' event", "flushes immediately"]} tone="dashed" />
      <Arrow d="M355 120 L 355 166" dashed />
      <Arrow d="M300 170 C 300 140, 300 140, 300 124" dashed />
      <Box x={510} y={170} w={210} h={92} title="409 attempt closed" lines={["time is up: the attempt", "was finalised with what", "the server accepted"]} tone="soft" />
      <Arrow d="M615 120 L 615 166" />
      <Box x={770} y={170} w={200} h={92} title="Heartbeat · 15 s" lines={["re-syncs clock offset", "online dot for examiner", "second-device signal"]} />
    </svg>
  );
}

// 4. Data model --------------------------------------------------------------------------------------------------
function Table({ x, y, name, cols, w = 200 }: { x: number; y: number; name: string; cols: string[]; w?: number }) {
  const h = 34 + cols.length * 19 + 8;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={12} fill="var(--surface)" stroke="var(--border-strong)" />
      <path d={`M${x} ${y + 34} H${x + w}`} stroke="var(--border)" />
      <text x={x + 14} y={y + 22} fontSize={13} fontWeight={600} {...T}>{name}</text>
      {cols.map((c, i) => (
        <text key={c} x={x + 14} y={y + 52 + i * 19} fontSize={11.5} fontFamily="var(--font-mono)" fill={c.startsWith("PK") || c.startsWith("FK") ? "var(--brand-ink)" : "var(--muted-foreground)"}>
          {c}
        </text>
      ))}
    </g>
  );
}

function ErdDiagram() {
  return (
    <svg viewBox="0 0 980 520" className="min-w-[760px]" role="img" aria-label="Database: users with roles; questions; exams with exam_questions and enrollments; attempts with answers, incidents and disputes; announcements; audit log.">
      <Defs />
      <Table x={10} y={20} name="users" cols={["PK id", "email UNIQUE", "password_hash", "token_version", "is_active"]} />
      <Table x={10} y={200} name="user_roles · roles" cols={["FK user_id", "FK role_id", "role_permissions"]} />
      <Table x={260} y={20} name="questions" cols={["PK id", "FK owner_id", "topic, difficulty, type", "options, correct (key)", "marks, scheme"]} />
      <Table x={260} y={220} name="exam_questions" cols={["PK exam_id + question_id", "position", "question ON DELETE RESTRICT"]} w={220} />
      <Table x={510} y={20} name="exams" cols={["PK id", "FK owner_id", "starts_at, ends_at", "duration, total, pass %", "draw_easy/medium/hard", "status, results_published"]} />
      <Table x={510} y={250} name="enrollments" cols={["PK exam_id + candidate_id"]} />
      <Table x={760} y={20} name="attempts" cols={["PK id", "FK exam_id, candidate_id", "UNIQUE(exam, candidate)", "  where is_sandbox = 0", "paper (snapshot JSON)", "deadline_at, status", "score, verify_code UNIQUE"]} w={210} />
      <Table x={760} y={250} name="answers" cols={["PK attempt_id + question_id", "response, flagged", "auto_score, manual_score"]} w={210} />
      <Table x={510} y={350} name="incidents · announcements" cols={["FK attempt_id / exam_id", "type, detail, at"]} w={220} />
      <Table x={760} y={380} name="disputes" cols={["FK attempt_id", "status, response", "score_before → after"]} w={210} />
      <Table x={10} y={330} name="audit_log" cols={["who, action, resource", "id, at, request id"]} />
      <Arrow d="M210 70 L 256 70" />
      <Arrow d="M460 70 L 506 70" />
      <Arrow d="M710 70 L 756 70" />
      <Arrow d="M370 140 L 370 216" />
      <Arrow d="M600 156 L 600 246" />
      <Arrow d="M865 180 L 865 246" />
      <Arrow d="M760 160 C 700 300, 700 330, 700 346" />
      <Arrow d="M940 180 C 975 260, 975 360, 940 376" />
      <Arrow d="M110 124 L 110 196" />
    </svg>
  );
}

export function ArchitecturePage() {
  return (
    <div className="px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <h1 className="max-w-3xl text-[clamp(2.25rem,5vw,3.5rem)] leading-[1.02] font-semibold tracking-[-0.045em]">How Invigil is built</h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground-soft">
          Four diagrams that map the design onto the code. TypeScript end to end, one shared set of validation rules, and one deployment that serves the site, the API and live updates from the same origin.
        </p>
        <div className="mt-12 space-y-6">
          <Figure title="System" body="Browsers only ever talk to one origin, so the session is a first-party httpOnly cookie and there is no cross-site surface. Every API request passes the same middleware chain before a service touches the database." files={["apps/api/src/app.ts", "apps/api/src/routes/exams.ts", "apps/api/src/services/*", "apps/api/src/realtime/*", "apps/api/wrangler.jsonc"]}>
            <SystemDiagram />
          </Figure>
          <Figure title="Exam lifecycle" body="Draft, published and completed are stored; whether an exam is upcoming or ongoing is derived from its window on every request, so a scheduler can never forget to flip it." files={["packages/shared/src/exam.ts · examPhase()", "apps/api/src/services/exam.service.ts · paperProblems()"]}>
            <LifecycleDiagram />
          </Figure>
          <Figure title="Failure-resilient answers (innovation 5.3)" body="An answer is written to the device before the network is tried. The server alone decides whether it arrived in time, so a bad connection costs nobody marks and gains nobody time." files={["apps/web/src/features/workspace/useSaveQueue.ts", "apps/api/src/services/attempt.service.ts · save(), heartbeat(), finalizeIfExpired()"]}>
            <SyncDiagram />
          </Figure>
          <Figure title="Data model" body="Integrity rules live in the database, not just in code: one attempt per candidate per exam, one answer per question, questions in use can't be deleted, and each attempt keeps a snapshot of its paper and answer key." files={["apps/api/src/db/schema/exam.ts", "apps/api/src/db/schema/core.ts", "apps/api/migrations/0000_init.sql"]}>
            <ErdDiagram />
          </Figure>
        </div>
      </div>
    </div>
  );
}
