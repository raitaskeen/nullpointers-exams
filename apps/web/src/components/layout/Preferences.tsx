"use client";

import { Check, Moon, SlidersHorizontal, Sun } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/lib/i18n";
import { PALETTES, usePalette } from "@/lib/palette";
import { useTheme } from "@/lib/theme-provider";
import { cn } from "@/lib/utils";

/** Appearance and brand color in one place (also reachable from ⌘K). */
export function Preferences({ className }: { className?: string }) {
  const { t } = useI18n();
  const { resolvedTheme, setTheme } = useTheme();
  const { palette, setPalette } = usePalette();
  const dark = resolvedTheme === "dark";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-sm" className={className} aria-label={t("cmd.preferences")} />}
      >
        <SlidersHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("account.theme")}</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setTheme(dark ? "light" : "dark")} closeOnClick={false}>
            {dark ? <Sun /> : <Moon />}
            {dark ? t("account.light") : t("account.dark")}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("account.palette")}</DropdownMenuLabel>
          <div className="grid grid-cols-6 gap-1.5 px-2 pt-1 pb-2" role="radiogroup" aria-label={t("account.palette")}>
            {PALETTES.map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={palette === p.id}
                aria-label={`${p.label} - ${p.hint}`}
                title={`${p.label} - ${p.hint}`}
                onClick={() => setPalette(p.id)}
                className={cn(
                  "grid size-8 place-items-center rounded-full border border-border transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2",
                  palette === p.id && "ring-2 ring-foreground ring-offset-2 ring-offset-popover",
                )}
                style={{ background: p.swatch }}
              >
                {palette === p.id && <Check weight="bold" className="size-3.5 text-white" aria-hidden="true" />}
              </button>
            ))}
          </div>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
