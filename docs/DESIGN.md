# Design system

> **Update 27 Nov (Invigil):** type is **Geist** (UI and display) + **Geist Mono**; the app is **English only**; translucent "glass" is allowed on buttons, the floating nav and sticky bars only, never on cards; no italics anywhere (enforced in globals.css). Everything below still applies otherwise.

The product should read as a calm, expensive, trustworthy tool - the Linear/Stripe/Vercel family - and never as an AI-generated template. This file is the rulebook; `apps/web/src/theme/tokens.css` and `app/globals.css` are the implementation.

## Principles

1. **One brand color, used sparingly.** Primary actions, active navigation, focus, one accent per screen. Everything else is neutral ink on paper.
2. **Light first.** Judges see the app on a projector, where dark UIs wash out. Dark mode is fully composed (its own surfaces and contrast), not inverted.
3. **Show the real product.** The landing hero is a code-drawn replica of the actual app, never a mood image or stock photo.
4. **Every state is designed.** Loading (skeletons), empty (with the next action), error (with retry), no-permission, offline, 404, 500.
5. **Touch first.** 44px targets on touch screens (36-40px with a mouse), 16px input text on phones (no iOS zoom), no sideways scrolling down to 320px.
6. **Works in two directions.** English (LTR) and Urdu (RTL, Nastaliq). Use logical properties (`ps-`, `pe-`, `ms-`, `me-`, `start-`, `end-`, `text-start`) - never `pl-`/`pr-`/`left-`/`right-` for layout. Arrows get `rtl:rotate-180`.

## Never (the "AI template" tells)

- Violet/lavender/purple-pink gradients, neon glows, glow orbs, gradient text.
- Glass/blur as decoration (blur only on a sticky bar over content).
- An eyebrow/kicker label above a heading. Section numbers (01/02/03).
- A grid of identical icon + title + text cards as page structure.
- Fade-in on every section, scroll parallax, scroll-jacking, tilt effects.
- Invented metrics, logos, testimonials or user counts.
- Emoji or unicode as icons. Mixed icon sets.
- A zero-offset colored "halo" shadow pretending to be depth.

## Color

OKLCH tokens. Neutrals carry a faint cool tint (hue 262). The brand hue comes from a **palette preset** on `<html data-palette>`:

| Preset | Hue | Use for themes about |
|---|---|---|
| `cobalt` (default) | blue 256 | trust: fintech, government, education, civic |
| `emerald` | green 158 | growth: climate, agriculture, sustainability |
| `teal` | 198 | care: health, wellbeing, water |
| `copper` | 46 | warmth: commerce, food, events, hospitality |
| `crimson` | 18 | urgency: safety, emergency, media, sport |
| `graphite` | none | restraint: premium tools, developer products |

Set the default in `apps/web/src/lib/site-config.ts` (`brand.palette`). Users can switch live (Preferences menu or ⌘K) - handy to show judges.

Semantic roles: `primary`, `brand-soft` (tinted surfaces), `brand-ink` (text on tint), `success`/`warning`/`danger` (+ `-soft`), `muted`, `border`, `border-strong`, `surface`, `surface-sunken`, `chart-1..5`. Status colors never depend on the brand hue, so red always means a problem.

Contrast is checked automatically: every e2e run executes axe (WCAG 2 A/AA) on the main screens.

## Type

| Role | Face | Where |
|---|---|---|
| UI + body | **Hanken Grotesk** (variable) | everything in the product |
| Display | **Newsreader** (variable, optical sizes) | landing headlines, 404/500 codes, assistant greeting - marketing moments only |
| Data/code | **JetBrains Mono** | code, keyboard hints |
| Urdu | **Noto Nastaliq Urdu** | loaded only when Arabic-script text appears |

All self-hosted (no font CDN). Headings: `text-wrap: balance`, tracking -0.018em to -0.03em. Body: `text-wrap: pretty`. Numbers in tables and stats: tabular figures.

## Icons

**Phosphor**, one family everywhere. `regular` weight by default, `duotone` for the active nav item and feature tiles, `fill` for status checks. Resources choose an icon by name from the curated list in `apps/web/src/components/ResourceIcon.tsx` (≈110 domain icons; unknown names fall back to `Cube`).

## Shape, depth, motion

- Radii: controls 10px, cards 14px, pills full.
- Shadows have real offsets (`shadow-xs`…`shadow-lg`); primary buttons get `shadow-brand` + a 1px inner highlight.
- Motion: exponential ease-out (`--ease-out`), 120-420ms. Content enters with a short rise (opacity + 8px) using `fill-mode: backwards` - never `both`, which leaves a transform/filter behind and breaks `position: fixed` children. Buttons scale to 0.98 on press. One authored moment on the landing page (live sync demo, with a pause button). Everything rests under `prefers-reduced-motion`.

## Components and patterns

- **App shell** (`features/app/AppShell.tsx`): sidebar built from the resource registry, filtered by permission; drawer on phones; account menu with log-out-everywhere.
- **⌘K command palette** (`CommandMenu.tsx`): navigate, live record search across every resource, create, theme/language/brand, ask the assistant. Also `/`.
- **Assistant** (`Assistant.tsx`, ⌘J): streaming answers from live data with tool chips and in-app record links.
- **Resource list** (`features/resources/ResourceListPage.tsx`): URL-synced search/filters/sort/page/record, sortable headers, numbered pagination, detail sheet, phone cards.
- **Forms**: `Field` + `FieldLabel` + `FieldError`, react-hook-form + the shared Zod schema; server errors land under the right field.
- **Dashboard**: real counts with "+N this week", stacked daily bars, status breakdown bars linking to filtered lists, live activity feed.
- Feedback: `components/feedback/*` (EmptyState, ErrorState, NoPermissionState, StatusBadge, ConfirmDialog, NetworkStatus).

## Browser surfaces

Selection color, caret, scrollbars, focus rings and `accent-color` all come from the tokens. The favicon and web manifest use the brand mark.

## Theme-day checklist

1. Pick the palette preset that matches the theme.
2. Rewrite `site-config.ts` (name, tagline, hero, sections) from the brief - plain words, no claims you can't show.
3. Update `ProductFrame.tsx` rows to the theme's entities so the hero shows the real product.
4. Resource `icon`, `label`, `help` in `packages/shared/src/resources/*`.
5. Check light + dark, desktop + 390px phone, English + Urdu. Run `bun run test:e2e`.
