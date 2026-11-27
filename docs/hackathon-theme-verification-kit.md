# Hackathon Theme and Verification Kit

**Theme:** Clear Signal with Liquid Glass accents — Premium Product UI  
**Status:** Final baseline for the starter kit and practice run  
**Frontend baseline:** Next.js 16 (React 19), TypeScript, Tailwind CSS v4, shadcn/ui on Base UI - deployed on Vercel  
**Backend and cloud baseline:** Hono on Cloudflare Workers, D1 (SQLite) + Drizzle, Durable Objects for realtime

## 1. What this theme is for

The team plan describes a 10-hour Web-e-Thon where the assignment arrives shortly before the build. The starter kit therefore needs a finished, credible default look that can adapt to different products without redesigning every screen. The competition's product prompt is not the same thing as this visual theme.

Use **Clear Signal** as the visual baseline: calm, clear, modern, and confident, with a premium finish. Keep the shared design system stable and change the brand accent, imagery, and copy only when the assignment gives a good reason. Do not invent a domain-specific identity before the prompt is known.

## 2. Final visual direction

- **Style:** modern product interface with restrained decoration, strong hierarchy, and generous whitespace.
- **Default mode:** light. Add dark mode only if required or if all core flows are already complete.
- **Typography:** `Inter` when bundled locally; otherwise use the system UI stack. Do not make the app depend on a remote font service.
- **Shape:** 10–12 px card corners, 8 px control corners, subtle borders, and restrained shadows.
- **Spacing:** use a consistent 4 px base scale: 4, 8, 12, 16, 24, 32, 48, 64.
- **Motion:** short transitions for hover, focus, and dialogs; respect reduced-motion preferences.
- **Imagery:** use product-relevant illustrations or a real interface preview. Avoid stock photos, decorative gradients, and fabricated customer logos or statistics.
- **Premium finish:** use one memorable hero visual, crisp type hierarchy, careful alignment, and a restrained indigo-to-teal accent treatment. Keep the rest of the interface quiet so the product and its content carry the attention.

## 2.1 Liquid Glass comparison and decision

| Direction | Strength | Tradeoff for this hackathon |
|---|---|---|
| Clear Signal only | Readable, adaptable, quick to implement, and reliable for forms and admin data | Can look familiar unless the landing page has a memorable product visual |
| Full Liquid Glass | More dimensional and immediately eye-catching, especially over rich imagery | Can make text and controls harder to read, competes with content, and takes extra visual checking across screens |
| **Chosen: Clear Signal + selective Liquid Glass** | Keeps the clear product system while adding a distinctive premium moment | Requires checking the glass surface over every background where it appears |

Use a restrained, web-native Liquid Glass treatment for the public navigation or one floating control over a rich hero visual. Keep it off content cards, tables, forms, and the main admin workspace. The admin can use a solid dark sidebar and a clean light content canvas; its sticky top bar may use a frosted surface only if it floats over scrolling content and remains readable. Provide a solid-surface fallback and check text contrast, busy backgrounds, keyboard focus, and reduced-motion behavior. This borrows the material idea without trying to reproduce Apple's native iOS interface.

## 3. Color tokens

Use these semantic tokens as the default palette. Components should consume token names rather than hard-coded colors, so a prompt-specific reskin can be done in one place.

| Token | Default | Use |
|---|---|---|
| `background` | `#F8FAFC` | Main page canvas |
| `surface` | `#FFFFFF` | Cards, dialogs, form surfaces |
| `foreground` | `#0F172A` | Main text and headings |
| `muted-foreground` | `#475569` | Supporting text, labels, metadata |
| `border` | `#CBD5E1` | Subtle dividers and card outlines |
| `control-border` | `#7C8AA0` | Input/select outlines that need to remain clearly visible |
| `primary` | `#4F46E5` | Main action, selected state, links |
| `primary-hover` | `#4338CA` | Main action hover/pressed state |
| `primary-foreground` | `#FFFFFF` | Text/icons on primary surfaces |
| `accent` | `#0E7490` | Secondary highlights; do not use for long text on white without contrast checking |
| `success` | `#166534` | Success text/icons, paired with a pale green background |
| `warning` | `#92400E` | Warning text/icons, paired with a pale amber background |
| `danger` | `#B91C1C` | Destructive actions and error text, paired with a pale red background |
| `focus` | `#4F46E5` | Visible keyboard focus indicator |
| `sidebar` | `#111827` | Optional admin navigation surface |
| `sidebar-foreground` | `#F8FAFC` | Text/icons on the admin sidebar |

Suggested CSS variable mapping:

```css
:root {
  --background: #f8fafc;
  --surface: #ffffff;
  --foreground: #0f172a;
  --muted-foreground: #475569;
  --border: #cbd5e1;
  --control-border: #7c8aa0;
  --primary: #4f46e5;
  --primary-hover: #4338ca;
  --primary-foreground: #ffffff;
  --accent: #0e7490;
  --success: #166534;
  --warning: #92400e;
  --danger: #b91c1c;
  --focus: #4f46e5;
  --sidebar: #111827;
  --sidebar-foreground: #f8fafc;
  --radius-card: 12px;
  --radius-control: 8px;
}
```

Use icons and text as well as color for status. Check foreground/background contrast for every real combination before calling the UI verified.

## 4. Public and admin experiences

They should serve different jobs while sharing the same tokens, type, spacing, icon style, and interaction states.

### Public landing page

- Simple top navigation with a clear product name and one primary action.
- The top navigation may use a subtle frosted glass surface over the hero; keep the hero text itself on a solid or clearly separated surface.
- Hero with a specific, truthful headline, a short explanation, and a useful product preview.
- Follow with only the sections the brief supports: benefits, workflow, audience, or call to action.
- Keep copy short and concrete. Never fabricate metrics, testimonials, integrations, or claims.
- On mobile, stack the hero, keep the main action visible, and collapse navigation cleanly.

### Admin panel

- Use a separate app layout with a compact sidebar, clear page title, and a visible primary action.
- Put the most important workflow first. Add tables, filters, charts, and summary cards only when they help a real task.
- Use clear status labels, readable forms, and confirmation for destructive actions.
- Keep the working area light and calm; the dark sidebar is optional and must preserve readable text and focus states.
- On mobile, collapse navigation and make tables usable through responsive columns, horizontal scrolling, or a deliberate card layout.

## 5. Shared component rules

Build or reuse a small set of token-driven components: buttons, text fields, selects, text areas, cards, badges, alerts, dialogs, breadcrumbs, navigation, tables/lists, pagination, toasts, and skeletons.

Every interactive component needs default, hover, focus, disabled, loading, and error states where relevant. Every form needs a label, validation message, and clear success or failure feedback. Avoid one-off styles when a shared component can express the same pattern.

## 6. Prompt-to-theme adaptation on competition day

1. Read the assignment and turn each requirement into a screen, user action, and acceptance check.
2. Identify the intended users, roles, key entities, and the main workflow before choosing visuals.
3. Keep the Clear Signal layout and component rules. Change the accent, product name, copy, and relevant imagery to fit the assignment.
4. Choose colors for meaning and readability, not stereotypes. Recheck text contrast and status colors after every palette change.
5. Build the core workflow before decorative sections or optional charts.
6. Do not assume an unspecified feature, user role, or data rule. Mark the assumption and ask the team to resolve it.

## 7. Practice and cross-verification checklist

For the practice project, record each item as **Pass**, **Fail**, or **Not applicable**, with the screen/route and evidence. Do not mark an item Pass because the code looks plausible.

### Requirements and behavior

- [ ] Every project requirement maps to a screen, action, and acceptance check.
- [ ] Each user role sees the correct pages and available actions.
- [ ] Main flows work end to end, including create, view, edit, and delete where required.
- [ ] Forms validate required fields, invalid values, and server-side failures; errors explain how to recover.
- [ ] Empty, loading, success, error, and no-permission states are handled.
- [ ] Refresh, direct route entry, back/forward navigation, and sign-out behave as expected.
- [ ] Destructive actions ask for confirmation; repeated submission does not create duplicate records.

### Visual, responsive, and accessibility checks

- [ ] Public and admin pages use the approved tokens and feel like one product.
- [ ] No clipped text, overlapping controls, broken images, or inconsistent spacing.
- [ ] Check narrow mobile, tablet, and desktop widths; verify navigation and data-heavy views at each.
- [ ] All actions work with keyboard; focus is visible and moves in a sensible order.
- [ ] Inputs have labels; icon-only buttons have accessible names; status is not communicated by color alone.
- [ ] Text remains readable and color contrast is checked after any theme change.
- [ ] Reduced-motion preference is respected; controls have comfortable touch targets.

### Frontend, backend, and deployment checks

- [ ] Frontend production build completes; resolve build errors and investigate warnings that affect behavior.
- [ ] `bun run check` passes (typecheck, API tests in the Workers runtime, production build).
- [ ] Frontend requests match the Hono API contracts (shared types in packages/shared) and handle non-success responses.
- [ ] Authorization is enforced by the backend, not only by hiding frontend buttons.
- [ ] No secrets are committed; configuration comes from .dev.vars locally and wrangler secrets / Vercel env vars in production.
- [ ] Vercel and Worker deployments succeed; verify the deployed site, API, authentication, and any real-time flow against production-like configuration.
- [ ] After deployment, repeat the critical user flows on the live URL and check browser/server logs for errors.
- [ ] Record the exact commands run, results, unresolved issues, and tested commit/deployment. Never claim a check that was not run.

## 8. Stack notes to reconcile in the tentative plan

The stack is final (2026-11-27): **Next.js on Vercel** (required by the organizers) + **Hono on Cloudflare Workers** with **D1** and **Durable Objects**, Bun monorepo. The team Game Plan PDF still says FastAPI/AWS and is out of date - `CLAUDE.md` and `docs/runbook.md` are authoritative. The visual theme does not depend on the backend choice.

## 9. Current verification status

The text and status color combinations in the default palette were checked: foreground on canvas 17.06:1, muted text on white 7.58:1, white on primary 6.29:1, accent on white 5.36:1, and status colors on their pale backgrounds 5.30:1 or higher. The stronger control outline is 3.50:1 against white. These checks cover the listed pairs; verify every component state and final rendered combination in the app.

The practice application has not been cross-verified in this workspace because its source project is not present here. Treat all implementation checks above as pending until they are run against the practice project. Use the checklist to produce a pass/fail report before the event.
