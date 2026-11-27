import type { PaletteId } from "./palette";

/**
 * Everything brand- and copy-related for the public site, in one file. On theme day: change the name,
 * the palette and every sentence below from the brief. Never invent metrics, customers or quotes.
 */
export const siteConfig = {
  productName: "NullPointers",
  /** Short line used in <title>, footer and auth pages. */
  tagline: "The operations workspace your whole team can trust.",
  brand: {
    /** cobalt | emerald | teal | copper | crimson | graphite - see lib/palette.tsx. */
    palette: "cobalt" as PaletteId,
  },

  nav: [
    { label: "Product", href: "#product" },
    { label: "Live sync", href: "#live" },
    { label: "Security", href: "#security" },
  ],

  hero: {
    headline: "Run the work.",
    headlineSoft: "Not the spreadsheets.",
    description:
      "One calm place where your team plans, tracks and closes work together, with every change showing up for everyone the moment it happens.",
    primary: { label: "Start free", href: "/register" },
    secondary: { label: "Log in", href: "/login" },
    facts: ["Works on any phone", "English and اردو", "Free while in beta"],
  },

  product: {
    headline: "Built for the way teams actually work",
    description:
      "Search, filter and update records without hunting through menus. Press ⌘K anywhere to jump straight to what you need.",
    points: [
      { title: "Find anything in a keystroke", body: "A command palette for every page, record and action." },
      { title: "Forms that explain themselves", body: "Mistakes are caught as you type, with a plain fix, before anything is saved." },
      { title: "Answers, not exports", body: "Ask the assistant a question and it reads your live data, within your permissions." },
    ],
  },

  live: {
    headline: "Everyone sees the same thing, instantly",
    description:
      "When a teammate adds or changes something, it lands on your screen in under a second. No refresh button, no version conflicts, no ‘which file is latest?’.",
  },

  security: {
    headline: "Serious about access",
    description: "Built the way banks build: least privilege by default, and every change on the record.",
    items: [
      "Sessions in secure, http-only cookies that scripts can't read",
      "Role-based permissions checked on every request, on the server",
      "Deactivate someone and they're signed out everywhere, immediately",
      "Brute-force protection on sign-in",
      "A full audit trail of who changed what, and when",
      "Runs on a global edge network, close to every user",
    ],
  },

  closing: {
    headline: "Bring your team in today",
    description: "Set up in under a minute. Invite the rest of the team when you're ready.",
    primary: { label: "Create your workspace", href: "/register" },
  },

  footer: [
    {
      heading: "Product",
      links: [
        { label: "Overview", href: "#product" },
        { label: "Live sync", href: "#live" },
        { label: "Security", href: "#security" },
      ],
    },
    {
      heading: "Account",
      links: [
        { label: "Log in", href: "/login" },
        { label: "Create account", href: "/register" },
      ],
    },
  ],
};
