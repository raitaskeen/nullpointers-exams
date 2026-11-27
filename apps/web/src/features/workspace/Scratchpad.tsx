"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser, PencilSimple, Trash, X } from "@phosphor-icons/react";
import { Segmented } from "@/components/form/FormField";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

/**
 * Rough-work space (secondary 4.8). Notes are saved to the attempt on the server (so they survive a device
 * change); the sketch canvas stays on this device. Neither is ever marked.
 */
export function Scratchpad({ attemptId, initial, open, onClose, readOnly }: { attemptId: number; initial: string; open: boolean; onClose: () => void; readOnly: boolean }) {
  const [mode, setMode] = useState<"notes" | "sketch">("notes");
  const [text, setText] = useState(initial);
  const [state, setState] = useState<"saved" | "saving" | "local">("saved");
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (readOnly) return;
    setState("saving");
    try {
      localStorage.setItem(`invigil-notes-${attemptId}`, text);
    } catch {
      // ignore
    }
    const id = setTimeout(() => {
      api(`/attempts/${attemptId}/scratchpad`, { method: "PUT", json: { text } }).then(
        () => setState("saved"),
        () => setState("local"),
      );
    }, 900);
    return () => clearTimeout(id);
  }, [text, attemptId, readOnly]);

  return (
    <aside
      aria-label="Scratchpad"
      className={cn(
        "fixed inset-y-0 end-0 z-40 flex w-full flex-col border-s border-border bg-popover shadow-lg transition-transform duration-300 ease-[var(--ease-out)] sm:w-[26rem]",
        open ? "translate-x-0" : "translate-x-full rtl:-translate-x-full",
      )}
      inert={!open}
    >
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <h2 className="flex-1 text-sm font-semibold">Scratchpad</h2>
        <span className="text-xs text-muted-foreground" aria-live="polite">{mode === "notes" ? (state === "saving" ? "Saving…" : state === "local" ? "Saved on this device" : "Saved") : "Kept on this device"}</span>
        <Button variant="ghost" size="icon-sm" aria-label="Close scratchpad" onClick={onClose}><X /></Button>
      </div>
      <div className="border-b border-border p-3">
        <Segmented label="Scratchpad mode" size="sm" value={mode} onChange={setMode} options={[{ value: "notes", label: "Notes" }, { value: "sketch", label: "Sketch" }]} className="w-full" />
      </div>
      <div className="min-h-0 flex-1 p-3">
        {mode === "notes" ? (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 50_000))}
            readOnly={readOnly}
            aria-label="Rough notes"
            placeholder="Working, outlines, calculations. Not marked."
            className="h-full w-full resize-none rounded-xl border border-border bg-surface-sunken/60 p-3 font-mono text-sm leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25"
          />
        ) : (
          <Sketch attemptId={attemptId} />
        )}
      </div>
    </aside>
  );
}

function Sketch({ attemptId }: { attemptId: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const key = `invigil-sketch-${attemptId}`;

  useEffect(() => {
    const c = canvas.current!;
    const rect = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    c.width = rect.width * dpr;
    c.height = rect.height * dpr;
    const ctx = c.getContext("2d")!;
    ctx.scale(dpr, dpr);
    const saved = localStorage.getItem(key);
    if (saved) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
      img.src = saved;
    }
  }, [key]);

  const point = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const save = () => {
    try {
      localStorage.setItem(key, canvas.current!.toDataURL("image/png"));
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex gap-1.5">
        <Button size="sm" variant={tool === "pen" ? "secondary" : "ghost"} onClick={() => setTool("pen")} aria-pressed={tool === "pen"}><PencilSimple /> Pen</Button>
        <Button size="sm" variant={tool === "eraser" ? "secondary" : "ghost"} onClick={() => setTool("eraser")} aria-pressed={tool === "eraser"}><Eraser /> Eraser</Button>
        <Button
          size="sm"
          variant="ghost"
          className="ms-auto"
          onClick={() => {
            const c = canvas.current!;
            c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
            localStorage.removeItem(key);
          }}
        >
          <Trash /> Clear
        </Button>
      </div>
      <canvas
        ref={canvas}
        aria-label="Sketch area. Draw with a mouse, pen or finger."
        className="min-h-0 w-full flex-1 touch-none rounded-xl border border-border bg-white"
        onPointerDown={(e) => {
          drawing.current = true;
          last.current = point(e);
          (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drawing.current || !last.current) return;
          const ctx = canvas.current!.getContext("2d")!;
          const p = point(e);
          ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
          ctx.strokeStyle = "#1d2433";
          ctx.lineWidth = tool === "eraser" ? 18 : 2.2 * (e.pressure ? 0.6 + e.pressure : 1);
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.beginPath();
          ctx.moveTo(last.current.x, last.current.y);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          last.current = p;
        }}
        onPointerUp={() => {
          drawing.current = false;
          last.current = null;
          save();
        }}
        onPointerCancel={() => {
          drawing.current = false;
          save();
        }}
      />
    </div>
  );
}
