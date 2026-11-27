---
name: frontend-theme
description: Re-skin and polish the Next.js app for the announced hackathon theme - brand palette preset, product name and landing copy, the hero product picture, resource icons/labels, and polish of generated screens - without breaking the design system. Owned by Rimza. Use right after the theme is announced and in the visual pass.
---

Read `docs/DESIGN.md` first - it is the rulebook (palette presets, type, icons, motion, the "never" list).

## Theme-day steps (about 30 minutes)

1. **Palette**: set `brand.palette` in `apps/web/src/lib/site-config.ts` to the preset that fits (cobalt, emerald, teal, copper, crimson, graphite). Need a hue that isn't there? Add a preset block in `apps/web/src/theme/tokens.css` (`[data-palette="x"] { --brand-h; --brand-c }`) and an entry in `PALETTES` in `lib/palette.tsx`. Never violet (hue 280-330).
2. **Words**: rewrite everything in `site-config.ts` from the brief - product name, tagline, hero, product points, live, security, closing. Plain language, the product's own nouns, no invented numbers or customers. Also update `public/manifest.webmanifest` name.
3. **Hero picture**: edit `ROWS` and the sidebar labels in `apps/web/src/features/home/ProductFrame.tsx` so the hero shows this theme's real entities. Same for `LiveSyncDemo.tsx` items.
4. **Entities**: in `packages/shared/src/resources/<name>.ts` set `icon` (names in `components/ResourceIcon.tsx`), field `label`s, `help` text, which fields are `list`ed and `searchable`.
5. **Status colors**: if a status shows grey, add its word to `TONES` in `features/resources/format.tsx`.
6. **Polish** with the design skills: `impeccable` (critique/polish), `emil-design-eng`, `break-ui` (worst-case data), `animate` only for one purposeful moment.
7. Verify: light + dark, 1440px + 390px, English + Urdu, then `bun run test:e2e` (fails on console errors, axe contrast issues, sideways scroll).

## Where things live (apps/web/src)

- Tokens: `theme/tokens.css` (neutrals, presets, light/dark, shadows, motion). Tailwind mapping + base styles: `app/globals.css`.
- Brand mark: `components/brand/Logo.tsx` (+ `public/favicon.svg`, `public/offline.html` use the same mark).
- Public: `components/layout/{Navbar,PublicLayout,AuthShell,Preferences}.tsx`, `features/home/*`.
- App: `features/app/{AppShell,CommandMenu,Assistant,DashboardPage,UsersPage}.tsx`.
- Generated screens: `features/resources/{ResourceListPage,ResourceFormPage,format}.tsx` - improving these improves every entity.
- Primitives: `components/ui/*` (shadcn on Base UI), `components/feedback/*`, `components/data/Pagination.tsx`, `components/ui/sheet.tsx`.
- Copy for the app chrome (EN + Urdu): `lib/i18n.tsx` - add a key to both dictionaries.

## Rules

- Links styled as buttons: `<Button render={<Link href="..." />}>` - our Button keeps link semantics (no `role="button"` on navigation).
- Logical spacing only (`ps/pe/ms/me/start/end`) so Urdu RTL works; directional arrows get `rtl:rotate-180`.
- Touch sizes come from the Button/Input components - don't shrink them with `h-8` on things people tap.
- Entrance animations use `fill-mode: backwards`; never leave `transform`/`filter`/`backdrop-filter` on an ancestor of a `position: fixed` element.
- No new font, icon set, gradient text, glow, or glass. If the brief really demands one, write down why in `docs/DESIGN.md`.

## Pitfalls

- `DropdownMenuLabel` must sit inside `DropdownMenuGroup`, or opening the menu crashes the page.
- A value exported from a `"use client"` file arrives in a server component as a proxy, not the value (inline scripts live in `lib/boot-script.ts` for that reason).
- Don't run `next build` while `next dev` is running - they share `.next` and corrupt each other.
