"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import {
  ArrowRight, ArrowsClockwise, Books, ChartBar, CheckCircle, CloudCheck, CloudSlash, Flag, Gavel, Lightning, LockKey, Megaphone,
  PencilLine, QrCode, SealCheck, ShieldCheck, Shuffle, Timer, UserCircleGear, Users, WifiHigh, WifiSlash,
} from "@phosphor-icons/react";
import { Segmented } from "@/components/form/FormField";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/site-config";
import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

function SectionHead({ title, body, className }: { title: ReactNode; body: ReactNode; className?: string }) {
  return (
    <Reveal className={cn("max-w-2xl", className)}>
      <h2 className="text-[clamp(2rem,4.4vw,3.25rem)] leading-[1.02] font-semibold tracking-[-0.045em] text-balance">{title}</h2>
      <p className="mt-5 text-lg leading-relaxed text-pretty text-foreground-soft">{body}</p>
    </Reveal>
  );
}

// ---- Hero visual: the real exam workspace, drawn in code ------------------------------------------------------

function useTicker(start: number) {
  const [s, setS] = useState(start);
  useEffect(() => {
    const id = setInterval(() => setS((v) => (v > 0 ? v - 1 : start)), 1000);
    return () => clearInterval(id);
  }, [start]);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function WorkspacePreview() {
  const time = useTicker(27 * 60 + 14);
  const [picked, setPicked] = useState(1);
  const states = ["done", "done", "done", "current", "flag", "", "done", "", "", "", "", ""];
  return (
    <div className="overflow-hidden rounded-[1.25rem] border border-[var(--glass-border)] bg-surface shadow-[var(--glass-edge),0_30px_80px_-30px_oklch(0.25_0.05_262/0.45),0_12px_24px_-12px_oklch(0.2_0.02_262/0.18)]">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3 sm:px-5">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="size-2.5 rounded-full bg-[oklch(0.75_0.15_25)]" />
          <span className="size-2.5 rounded-full bg-[oklch(0.83_0.14_85)]" />
          <span className="size-2.5 rounded-full bg-[oklch(0.75_0.15_150)]" />
        </span>
        <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium">CS-301 Databases · Quiz 3</span>
        <span className="hidden items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-xs font-medium text-success sm:flex">
          <CloudCheck weight="fill" className="size-3.5" /> Saved
        </span>
        <span className="flex items-center gap-1.5 rounded-lg bg-foreground px-2.5 py-1 font-mono text-[0.8125rem] font-medium text-background tabular-nums">
          <Timer weight="bold" className="size-3.5" /> {time}
        </span>
      </div>
      <div className="grid sm:grid-cols-[1fr_13rem]">
        <div className="p-5 sm:p-7">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Question 4 of 6</span> · 3 marks · Indexing
          </div>
          <p className="mt-3 text-[1.0625rem] leading-snug font-medium tracking-[-0.01em] sm:text-lg">Which index type best supports range queries such as BETWEEN?</p>
          <div className="mt-5 space-y-2">
            {["Hash index", "B-tree index", "No index", "Full-text index"].map((o, i) => (
              <button
                key={o}
                type="button"
                onClick={() => setPicked(i)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-start text-sm transition-all duration-300 ease-[var(--ease-out)]",
                  picked === i ? "border-primary/60 bg-brand-softer shadow-[0_0_0_3px_color-mix(in_oklch,var(--primary)_14%,transparent)]" : "border-border hover:border-border-strong",
                )}
              >
                <span className={cn("grid size-5 place-items-center rounded-full border-2 transition-colors", picked === i ? "border-primary bg-primary" : "border-control-border")}>
                  {picked === i && <span className="size-1.5 rounded-full bg-primary-foreground" />}
                </span>
                {o}
              </button>
            ))}
          </div>
        </div>
        <div className="hidden border-s border-border bg-surface-sunken/60 p-5 sm:block">
          <p className="text-xs font-medium text-muted-foreground">Questions</p>
          <div className="mt-3 grid grid-cols-4 gap-1.5">
            {states.slice(0, 6).map((s, i) => (
              <span
                key={i}
                className={cn(
                  "relative grid aspect-square place-items-center rounded-lg text-xs font-semibold",
                  s === "done" && "bg-primary text-primary-foreground",
                  s === "current" && "bg-surface text-foreground ring-2 ring-primary",
                  s === "flag" && "bg-warning-soft text-warning",
                  !s && "bg-surface text-muted-foreground ring-1 ring-border",
                )}
              >
                {i + 1}
                {s === "flag" && <Flag weight="fill" className="absolute -end-1 -top-1 size-3" />}
              </span>
            ))}
          </div>
          <dl className="mt-5 space-y-2 text-xs">
            <div className="flex justify-between"><dt className="text-muted-foreground">Answered</dt><dd className="font-semibold tabular-nums">3</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">For review</dt><dd className="font-semibold tabular-nums">1</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Unanswered</dt><dd className="font-semibold tabular-nums">2</dd></div>
          </dl>
        </div>
      </div>
    </div>
  );
}

function HeroVisual() {
  const reduce = useReducedMotion();
  return (
    <div className="relative mx-auto mt-16 max-w-5xl sm:mt-20">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE, delay: 0.2 }}
      >
        <WorkspacePreview />
      </motion.div>
    </div>
  );
}


// ---- Photo band ------------------------------------------------------------------------------------------------

const PHOTOS = [
  { id: "photo-1513258496099-48168024aec0", alt: "A student with headphones working on a laptop", title: "For candidates", body: "A quiet workspace that saves every answer and never loses time." },
  { id: "photo-1580582932707-520aed937b7b", alt: "An empty classroom with rows of desks", title: "For exam halls", body: "Runs on campus Wi-Fi or a phone hotspot, with no installs." },
  { id: "photo-1758270705317-3ef6142d306f", alt: "A group of students gathered around a laptop", title: "For examiners", body: "Build, publish, watch and grade from one place." },
];
const img = (id: string, w: number) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=75`;

function PhotoBand() {
  return (
    <section aria-label="Who it is for" className="px-4 pb-8 sm:px-6">
      <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-3">
        {PHOTOS.map((p, i) => (
          <Reveal key={p.id} delay={i * 0.08}>
            <figure className="group relative overflow-hidden rounded-[1.5rem] bg-muted">
              <img
                src={img(p.id, 900)}
                srcSet={`${img(p.id, 600)} 600w, ${img(p.id, 900)} 900w, ${img(p.id, 1200)} 1200w`}
                sizes="(min-width: 768px) 33vw, 100vw"
                alt={p.alt}
                loading="lazy"
                decoding="async"
                className={cn("w-full object-cover", i === 1 ? "aspect-[4/5] md:mt-10" : "aspect-[4/5]")}
              />
              <figcaption className="absolute inset-x-3 bottom-3 rounded-2xl border border-white/20 bg-black/35 p-4 text-white backdrop-blur-xl">
                <b className="block text-[0.9375rem] font-semibold tracking-[-0.01em]">{p.title}</b>
                <span className="mt-0.5 block text-[0.8125rem] text-white/80">{p.body}</span>
              </figcaption>
            </figure>
          </Reveal>
        ))}
      </div>
      <p className="mx-auto mt-3 max-w-6xl text-end text-[0.6875rem] text-muted-foreground">Photos: Unsplash</p>
    </section>
  );
}

// ---- Workflow by role -----------------------------------------------------------------------------------------

type Role = "examiner" | "candidate" | "admin";
const ROLE_FLOW: Record<Role, { icon: typeof Books; title: string; body: string }[]> = {
  examiner: [
    { icon: Books, title: "Build a question bank", body: "Single-answer, multi-select and written questions with topics, difficulty and marking rules. Import hundreds from CSV or JSON with row-by-row checks." },
    { icon: ShieldCheck, title: "Publish only when it's right", body: "A checklist blocks publishing until every paper adds up to the total and the draw plan can be met. Preview it as a candidate in a sandbox first." },
    { icon: Megaphone, title: "Watch it live", body: "Progress, online status and integrity signals per candidate. Send announcements, add time for a verified disruption, with the reason on record." },
    { icon: PencilLine, title: "Grade, then publish", body: "Objective answers mark themselves. Written answers queue for you with mark limits enforced. Results go out when you say so." },
  ],
  candidate: [
    { icon: Timer, title: "A clock you can trust", body: "Time is kept by the server. Refresh, switch device or lose power: you come back to the same question with the same time left." },
    { icon: Flag, title: "Know where you stand", body: "Answered, unanswered and marked-for-review at a glance, a review screen before submitting, and a scratchpad for rough work." },
    { icon: UserCircleGear, title: "Make it yours", body: "Text size, one question at a time or all on one page, and a high-contrast mode. Remembered on your device." },
    { icon: SealCheck, title: "Results you can prove", body: "Download a PDF report with a QR code anyone can verify, and raise a dispute on a specific question if something looks wrong." },
  ],
  admin: [
    { icon: Users, title: "People and roles", body: "Create examiners and candidates, change roles and deactivate accounts. A deactivated user is signed out everywhere, immediately." },
    { icon: LockKey, title: "Permissions on the server", body: "Every request is checked against the user's role on the API. Hiding a button is never the security boundary." },
    { icon: ChartBar, title: "Every exam in view", body: "Admins see all examiners' exams, analytics and disputes, with an audit trail of who changed what and when." },
    { icon: Lightning, title: "Fast everywhere", body: "One edge deployment serves the site, API and live updates from the same origin, close to every candidate." },
  ],
};

function Workflow() {
  const [role, setRole] = useState<Role>("examiner");
  return (
    <section id="workflow" className="scroll-mt-24 px-4 py-24 sm:px-6 sm:py-32">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <SectionHead title="One system, three people in the room." body="Each role gets its own workspace, built around the job it has to do on exam day." />
          <Reveal>
            <Segmented<Role>
              label="Role"
              value={role}
              onChange={setRole}
              options={[{ value: "examiner", label: "Examiner" }, { value: "candidate", label: "Candidate" }, { value: "admin", label: "Administrator" }]}
              className="w-full sm:w-auto"
            />
          </Reveal>
        </div>
        <div className="relative mt-12 min-h-[22rem]">
          <AnimatePresence mode="wait">
            <motion.ol
              key={role}
              className="grid gap-px overflow-hidden rounded-[1.5rem] border border-border bg-border sm:grid-cols-2"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.45, ease: EASE }}
            >
              {ROLE_FLOW[role].map((s, i) => (
                <motion.li
                  key={s.title}
                  className="group bg-card p-7 sm:p-9"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: EASE, delay: 0.06 * i }}
                >
                  <span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand-ink">
                    <s.icon weight="duotone" className="size-[1.375rem]" />
                  </span>
                  <h3 className="mt-6 text-xl font-semibold tracking-[-0.025em]">{s.title}</h3>
                  <p className="mt-2.5 leading-relaxed text-foreground-soft">{s.body}</p>
                </motion.li>
              ))}
            </motion.ol>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

// ---- Resilience simulator ---------------------------------------------------------------------------------------

type Net = "online" | "offline" | "syncing";
function Resilience() {
  const [net, setNet] = useState<Net>("online");
  const [queued, setQueued] = useState(0);
  const [saved, setSaved] = useState(3);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const drop = () => {
    timers.current.forEach(clearTimeout);
    setNet("offline");
    setQueued(0);
    timers.current = [
      setTimeout(() => setQueued(1), 700),
      setTimeout(() => setQueued(2), 1500),
      setTimeout(() => setNet("syncing"), 3000),
      setTimeout(() => {
        setNet("online");
        setSaved((s) => s + 2);
        setQueued(0);
      }, 4200),
    ];
  };

  const chip = {
    online: { icon: CloudCheck, text: "All answers saved", cls: "bg-success-soft text-success" },
    offline: { icon: CloudSlash, text: queued ? `Offline · ${queued} answer${queued > 1 ? "s" : ""} queued on this device` : "Offline · saving on this device", cls: "bg-warning-soft text-warning" },
    syncing: { icon: ArrowsClockwise, text: "Back online · syncing", cls: "bg-brand-soft text-brand-ink" },
  }[net];

  return (
    <section id="resilience" className="scroll-mt-24 bg-surface-sunken/60 px-4 py-24 sm:px-6 sm:py-32">
      <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2">
        <div>
          <SectionHead
            title="The Wi-Fi drops. The exam doesn't."
            body="Every answer is saved the moment it changes. Offline, it waits on the device and replays in order when the connection returns. The deadline lives on the server, so nobody loses time to a flaky router, and nobody gains any either."
          />
          <Reveal delay={0.1} className="mt-8 flex flex-wrap gap-3">
            <Button onClick={drop} disabled={net !== "online"}>
              <WifiSlash /> Drop the connection
            </Button>
            <span className="self-center text-sm text-muted-foreground">Try it: the timer keeps running.</span>
          </Reveal>
        </div>
        <Reveal delay={0.1}>
          <div className="rounded-[1.5rem] border border-border bg-card p-6 shadow-[var(--glass-edge),0_30px_60px_-30px_oklch(0.25_0.04_262/0.35)] sm:p-8">
            <div className="flex items-center justify-between gap-3">
              <motion.span layout className={cn("flex items-center gap-2 rounded-full px-3 py-1.5 text-[0.8125rem] font-medium", chip.cls)} transition={{ duration: 0.35, ease: EASE }}>
                <chip.icon weight="bold" className={cn("size-4", net === "syncing" && "animate-spin")} />
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span key={chip.text} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>
                    {chip.text}
                  </motion.span>
                </AnimatePresence>
              </motion.span>
              {net === "offline" ? <WifiSlash className="size-5 text-warning" /> : <WifiHigh className="size-5 text-success" />}
            </div>
            <ul className="mt-6 space-y-2.5">
              {[1, 2, 3, 4, 5, 6].map((n) => {
                const isSaved = n <= saved;
                const isQueued = !isSaved && n <= saved + queued;
                return (
                  <li key={n} className="flex items-center gap-3 rounded-xl border border-border px-4 py-3 text-sm">
                    <span className="w-6 font-semibold text-muted-foreground tabular-nums">Q{n}</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <motion.span
                        className={cn("block h-full rounded-full", isSaved ? "bg-success" : isQueued ? "bg-warning" : "bg-transparent")}
                        initial={false}
                        animate={{ width: isSaved || isQueued ? "100%" : "0%" }}
                        transition={{ duration: 0.6, ease: EASE }}
                      />
                    </span>
                    <span className={cn("w-24 text-end text-xs font-medium", isSaved ? "text-success" : isQueued ? "text-warning" : "text-muted-foreground")}>
                      {isSaved ? "Saved" : isQueued ? "On device" : "Not answered"}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-5 text-[0.8125rem] text-muted-foreground">If time runs out while offline, the attempt is finalised with the answers the server accepted before the deadline - exactly as the rules say.</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ---- Fairness: stratified draw ----------------------------------------------------------------------------------

const POOL = { easy: [1, 2, 3, 4, 5], medium: [6, 7, 8, 9], hard: [10, 11] };
const DRAW = { easy: 3, medium: 2, hard: 1 };
function drawPaper(seed: number) {
  const pick = (arr: number[], n: number, s: number) => [...arr].sort((a, b) => ((a * 9301 + s * 49297) % 233) - ((b * 9301 + s * 49297) % 233)).slice(0, n);
  return [...pick(POOL.easy, DRAW.easy, seed), ...pick(POOL.medium, DRAW.medium, seed + 7), ...pick(POOL.hard, DRAW.hard, seed + 13)];
}
const level = (q: number) => (q <= 5 ? "easy" : q <= 9 ? "medium" : "hard");
const MARKS = { easy: 2, medium: 3, hard: 5 };

function Fairness() {
  const [round, setRound] = useState(1);
  const papers = useMemo(() => [0, 1, 2].map((c) => drawPaper(round * 3 + c * 11)), [round]);
  return (
    <section id="fairness" className="scroll-mt-24 px-4 py-24 sm:px-6 sm:py-32">
      <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <SectionHead
            title="Different papers. The same exam."
            body="Random papers are only fair if they are equally hard. Invigil draws the same number of easy, medium and hard questions for every candidate from a larger pool, and refuses to publish unless every possible paper carries the same marks."
          />
          <Reveal delay={0.1} className="mt-8">
            <Button variant="outline" onClick={() => setRound((r) => r + 1)}>
              <Shuffle /> Draw new papers
            </Button>
          </Reveal>
        </div>
        <Reveal delay={0.1}>
          <LayoutGroup>
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              {papers.map((paper, c) => (
                <div key={c} className="rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4">
                  <p className="text-xs font-semibold">Candidate {String.fromCharCode(65 + c)}</p>
                  <ul className="mt-3 space-y-1.5">
                    {paper.map((q) => (
                      <motion.li
                        layout
                        key={`${c}-${q}-${round}`}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.45, ease: EASE }}
                        className={cn(
                          "flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium",
                          level(q) === "easy" && "bg-success-soft text-success",
                          level(q) === "medium" && "bg-warning-soft text-warning",
                          level(q) === "hard" && "bg-danger-soft text-danger",
                        )}
                      >
                        <span>Q{q}</span>
                        <span className="opacity-80">{MARKS[level(q)]}m</span>
                      </motion.li>
                    ))}
                  </ul>
                  <p className="mt-3 border-t border-border pt-2.5 text-xs text-muted-foreground">
                    <b className="text-foreground tabular-nums">17</b> marks
                  </p>
                </div>
              ))}
            </div>
          </LayoutGroup>
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-success" /> 3 easy from 5</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-warning" /> 2 medium from 4</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-danger" /> 1 hard from 2</span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ---- Trust: verification + disputes ----------------------------------------------------------------------------

function QrArt({ code }: { code: string }) {
  // Decorative pattern derived from the code (the real PDF carries a scannable QR).
  const cells = useMemo(() => {
    let h = 0;
    for (const ch of code) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return Array.from({ length: 121 }, (_, i) => ((h ^ (i * 2654435761)) >>> (i % 13)) & 1);
  }, [code]);
  const finder = (x: number, y: number) => x < 3 && y < 3;
  return (
    <svg viewBox="0 0 11 11" className="size-24 rounded-lg bg-white p-1.5" aria-hidden="true">
      {cells.map((v, i) => {
        const x = i % 11;
        const y = Math.floor(i / 11);
        const f = finder(x, y) || finder(10 - x, y) || finder(x, 10 - y);
        return (f ? (x % 10 === 0 || y % 10 === 0 || (x % 10 !== 1 && y % 10 !== 1) || (x === 1 && y === 1) || (x === 9 && y === 1) || (x === 1 && y === 9)) : v) ? <rect key={i} x={x} y={y} width="1" height="1" fill="#16181d" /> : null;
      })}
    </svg>
  );
}

function Trust() {
  const router = useRouter();
  const [code, setCode] = useState("");
  return (
    <section className="px-4 pb-24 sm:px-6 sm:pb-32">
      <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-2">
        <Reveal>
          <div className="flex h-full flex-col rounded-[1.5rem] border border-border bg-card p-7 shadow-sm sm:p-9">
            <span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand-ink"><QrCode weight="duotone" className="size-[1.375rem]" /></span>
            <h3 className="mt-6 text-2xl font-semibold tracking-[-0.03em]">Results anyone can check</h3>
            <p className="mt-2.5 leading-relaxed text-foreground-soft">Every published result report carries a verification code and QR. An employer or another institution can confirm it is genuine, and sees only the exam, a masked name and the score.</p>
            <div className="mt-6 flex items-center gap-5 rounded-2xl bg-surface-sunken p-4">
              <QrArt code="7KQ2MX9PHA" />
              <div className="text-sm">
                <p className="font-semibold">CS-201 Data Structures</p>
                <p className="text-muted-foreground">H**** I**** · 86.8% · Pass</p>
                <p className="mt-2 font-mono text-xs tracking-wider text-muted-foreground">7KQ2MX9PHA</p>
              </div>
            </div>
            <form
              className="mt-5 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                router.push(`/verify${code.trim() ? `?code=${encodeURIComponent(code.trim().toUpperCase())}` : ""}`);
              }}
            >
              <label className="sr-only" htmlFor="home-verify">Verification code</label>
              <input id="home-verify" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Enter a verification code" className="h-11 min-w-0 flex-1 rounded-[var(--radius-control)] border border-control-border/70 bg-surface px-3 font-mono text-sm tracking-wider uppercase shadow-xs outline-none placeholder:font-sans placeholder:tracking-normal placeholder:normal-case focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25" />
              <Button type="submit" variant="outline">Verify</Button>
            </form>
          </div>
        </Reveal>
        <Reveal delay={0.08}>
          <div className="flex h-full flex-col rounded-[1.5rem] border border-border bg-card p-7 shadow-sm sm:p-9">
            <span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand-ink"><Gavel weight="duotone" className="size-[1.375rem]" /></span>
            <h3 className="mt-6 text-2xl font-semibold tracking-[-0.03em]">Disputes with a paper trail</h3>
            <p className="mt-2.5 leading-relaxed text-foreground-soft">A candidate can challenge the mark on a specific question. The examiner answers with a reason the candidate sees; an accepted dispute recalculates the total, is logged, and the verification record updates with it.</p>
            <ol className="mt-6 space-y-3 text-sm">
              {[
                { t: "Raised by Sana M.", d: "Q7 · Hashing · “Two of three correct, but marked 0.”", tone: "bg-warning" },
                { t: "Reviewed by Dr. Ayesha K.", d: "Accepted: the prompt didn't say all-or-nothing.", tone: "bg-primary" },
                { t: "Score updated", d: "21 → 24 of 37 · verification record refreshed", tone: "bg-success" },
              ].map((s, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex flex-col items-center">
                    <span className={cn("mt-1.5 size-2.5 rounded-full", s.tone)} />
                    {i < 2 && <span className="mt-1 w-px flex-1 bg-border" />}
                  </span>
                  <span className="pb-1">
                    <b className="block font-semibold">{s.t}</b>
                    <span className="text-muted-foreground">{s.d}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ---- Page ---------------------------------------------------------------------------------------------------------

export function HomePage() {
  const { hero } = siteConfig;
  const reduce = useReducedMotion();
  const words = hero.headline.split(" ");
  return (
    <>
      <section className="relative overflow-hidden px-4 pt-14 pb-28 sm:px-6 sm:pt-24 sm:pb-36">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-[clamp(2.75rem,7.6vw,5.75rem)] leading-[0.95] font-semibold tracking-[-0.055em] text-balance">
            {words.map((w, i) => (
              <motion.span
                key={i}
                className="inline-block"
                initial={reduce ? false : { opacity: 0, y: "0.25em" }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: EASE, delay: i * 0.03 }}
              >
                {w}
                {i < words.length - 1 && " "}
              </motion.span>
            ))}
          </h1>
          <motion.p
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.45 }}
            className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-pretty text-foreground-soft sm:text-xl"
          >
            {hero.description}
          </motion.p>
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.55 }}
            className="mt-10 flex flex-col justify-center gap-3 sm:flex-row"
          >
            <Button size="lg" render={<Link href={hero.primary.href} />}>
              {hero.primary.label} <ArrowRight className="rtl:rotate-180" />
            </Button>
            <Button size="lg" variant="outline" render={<Link href={hero.secondary.href} />}>
              <SealCheck /> {hero.secondary.label}
            </Button>
          </motion.div>
        </div>
        <HeroVisual />
      </section>

      <PhotoBand />
      <Workflow />
      <Resilience />
      <Fairness />
      <Trust />

      <section className="px-4 pb-24 sm:px-6">
        <Reveal className="mx-auto max-w-6xl">
          <div className="relative overflow-hidden rounded-[2rem] bg-foreground px-7 py-14 text-background sm:px-14 sm:py-20">
            <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-xl">
                <h2 className="text-[clamp(2rem,4.4vw,3.25rem)] leading-[1.02] font-semibold tracking-[-0.045em]">See a live exam in under a minute.</h2>
                <p className="mt-4 text-lg text-background/70">The demo has a quiz running right now, a graded midterm with published results, and an open dispute waiting for an examiner.</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button size="lg" render={<Link href="/login" />} className="bg-background text-foreground [background-image:none] hover:bg-background/90">
                  Open the live demo <ArrowRight className="rtl:rotate-180" />
                </Button>
              </div>
            </div>
            <ul className="relative mt-12 grid gap-4 border-t border-background/15 pt-8 text-sm text-background/75 sm:grid-cols-3">
              <li className="flex items-center gap-2.5"><CheckCircle weight="fill" className="size-4 text-background" /> Answer keys never leave the server</li>
              <li className="flex items-center gap-2.5"><CheckCircle weight="fill" className="size-4 text-background" /> No webcam or screen recording</li>
              <li className="flex items-center gap-2.5"><CheckCircle weight="fill" className="size-4 text-background" /> Works on phones and slow networks</li>
            </ul>
          </div>
        </Reveal>
      </section>
    </>
  );
}
