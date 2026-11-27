"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { siteConfig } from "./site-config";

export const PALETTES = [
  { id: "cobalt", label: "Cobalt", hint: "Trust - fintech, gov, education", swatch: "oklch(0.515 0.165 256)" },
  { id: "emerald", label: "Emerald", hint: "Growth - climate, agri, sustainability", swatch: "oklch(0.515 0.125 158)" },
  { id: "teal", label: "Teal", hint: "Care - health, wellbeing", swatch: "oklch(0.515 0.105 198)" },
  { id: "copper", label: "Copper", hint: "Warmth - commerce, food, events", swatch: "oklch(0.515 0.135 46)" },
  { id: "crimson", label: "Crimson", hint: "Urgency - safety, media, sport", swatch: "oklch(0.515 0.17 18)" },
  { id: "graphite", label: "Graphite", hint: "Restraint - premium, tools", swatch: "oklch(0.22 0.012 262)" },
] as const;
export type PaletteId = (typeof PALETTES)[number]["id"];

const KEY = "np-palette";
const isPalette = (v: unknown): v is PaletteId => PALETTES.some((p) => p.id === v);


const Ctx = createContext<{ palette: PaletteId; setPalette: (p: PaletteId) => void } | null>(null);

export function PaletteProvider({ children }: { children: ReactNode }) {
  const [palette, set] = useState<PaletteId>(siteConfig.brand.palette);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (isPalette(saved)) set(saved);
    } catch {
      // storage blocked - keep the brand default
    }
  }, []);

  const setPalette = useCallback((p: PaletteId) => {
    set(p);
    document.documentElement.dataset.palette = p;
    try {
      localStorage.setItem(KEY, p);
    } catch {
      // ignore
    }
  }, []);

  return <Ctx.Provider value={{ palette, setPalette }}>{children}</Ctx.Provider>;
}

export function usePalette() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePalette must be used within <PaletteProvider>");
  return ctx;
}
