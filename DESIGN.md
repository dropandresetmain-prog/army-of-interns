# Army of Interns — Design Reference

> **Direction locked: Roster.** Calm workforce software that happens to be staffed by
> AI. Light ground, one deep teal accent, no insignia, no military register.
>
> This document records the decision. **No code has been changed to match it yet** —
> the implementation pass happens after the backend is done. Every section below marked
> _Current_ describes what ships today; _Target_ describes what we are moving to.

---

## Product thesis

Army of Interns makes an evolving AI workforce visible and trustworthy. A business owner
starts with Alex, an AI manager. As work arrives, Alex identifies capability gaps, staffs
specialised workers, coordinates human participants, and shows the organisation changing
around the work.

The experience has two related surfaces:

- **Workspace**: live, presentation-ready operational view for owners and an audience.
- **Landlord Home Command**: a calm, mobile-first property view reached after QR entry.

The UI renders persisted application state. It must not calculate approval, quote
viability, permissions, or workflow transitions.

---

## Why the direction changed

The previous direction — dark charcoal, olive drab, brass insignia, "command centre" —
read as military rather than premium. Three ingredients compounded:

1. **Language.** "Command centre", "operations feed" — military register applied to what
   is really a staffing queue.
2. **Insignia.** `⌃` / `⌃⌃` / `★` are literal military rank markings. This was the
   loudest of the three.
3. **Palette.** Olive and brass on charcoal. Fine alone; under chevrons in a room called
   a command centre, it reads as fatigues.

Roster changes all three. The product is an HR and operations tool, so it should look
like one.

---

## Visual system

Calm, light, generous. One deep accent doing all the work. Elevation carries hierarchy
instead of colour, and nothing is decorated that isn't also informative.

- near-white ground with a slight green-grey bias — chosen, not defaulted to grey;
- white surfaces with a real elevation ramp, `aoi-bg` → `aoi-surf` → `aoi-surf-r`;
- a single deep teal accent for system activity, capability and active state;
- **no gold, no brass, no rank marks** — promotion is expressed by fill, not by medal;
- semantic state colour (thinking / active / waiting / blocked / complete) is separate
  from the accent and never used decoratively;
- Instrument Sans for interface text, IBM Plex Mono for data, timestamps and identifiers.

### Tokens

Token *names* are unchanged so `tailwind.config.ts` and existing components keep
compiling. Only the *values* change, plus two additions and two deprecations.

| Token | Meaning |
| --- | --- |
| `aoi-bg` | Base page canvas |
| `aoi-surf` | First-level cards and navigation |
| `aoi-surf-r` | Raised cards and React Flow nodes |
| `aoi-bdr` | Quiet structural borders |
| `aoi-text` / `aoi-t2` / `aoi-tm` | Primary / supporting / metadata text |
| `aoi-accent` / `aoi-accent-s` | **New.** System action, capability, active state, and its soft tint |
| `aoi-thn` / `aoi-act` / `aoi-wt` / `aoi-blk` / `aoi-cmp` / `aoi-idl` | Thinking / active / waiting / blocked / complete / idle |
| `aoi-olive` | **Deprecated.** Alias of `aoi-accent` during migration |
| `aoi-gold` / `aoi-gold-b` | **Deprecated.** Alias of `aoi-accent`; remove once promotion uses fill |

Keeping the deprecated aliases means the migration can land token-by-token instead of as
one breaking change. Delete them once no component references them.

#### Target values

Roster is **light-first**. Dark is a supported second theme, not the primary.

```css
:root, [data-theme="light"] {
  --aoi-bg:#F2F4F2; --aoi-surf:#FAFBFA; --aoi-surf-r:#FFFFFF; --aoi-bdr:#E2E7E4;
  --aoi-text:#15191A; --aoi-t2:#5C6663; --aoi-tm:#8A9491;
  --aoi-accent:#0F6F63; --aoi-accent-s:#E6F1EF;
  --aoi-thn:#B45309; --aoi-act:#15803D; --aoi-wt:#1D4ED8;
  --aoi-blk:#B91C1C; --aoi-cmp:#0F766E; --aoi-idl:#8A9491;
  --aoi-olive:var(--aoi-accent);
  --aoi-gold:var(--aoi-accent); --aoi-gold-b:var(--aoi-accent);
}

[data-theme="dark"] {
  --aoi-bg:#101414; --aoi-surf:#171C1C; --aoi-surf-r:#1E2423; --aoi-bdr:#2A3231;
  --aoi-text:#E8EBE9; --aoi-t2:#9BA5A2; --aoi-tm:#6B7573;
  --aoi-accent:#2FA795; --aoi-accent-s:rgba(47,167,149,.14);
  --aoi-thn:#F59E0B; --aoi-act:#4ADE80; --aoi-wt:#60A5FA;
  --aoi-blk:#F87171; --aoi-cmp:#2DD4BF; --aoi-idl:#6B7573;
  --aoi-olive:var(--aoi-accent);
  --aoi-gold:var(--aoi-accent); --aoi-gold-b:var(--aoi-accent);
}
```

The previous state colours were tuned for a dark ground. `#4ADE80` and `#60A5FA` do not
carry enough contrast on white, so the light set above is retuned rather than reused.

#### Legacy tokens to remove

`src/app/globals.css` currently defines a **second, undocumented token set** —
`--ink`, `--muted`, `--canvas`, `--panel`, `--panel-2`, `--line`, `--olive`, `--gold`,
`--danger` — used by `.command-centre`. The Workspace is therefore the one surface *not*
on the documented tokens. Migrating it onto `aoi-*` and deleting the legacy set is part
of the design pass.

---

## Typography

| Role | Target face | Fallback stack |
| --- | --- | --- |
| Interface, headings, body | **Instrument Sans** | `system-ui, -apple-system, "Segoe UI", sans-serif` |
| Data, timestamps, IDs, event types | **IBM Plex Mono** | `ui-monospace, Consolas, monospace` |

Type scale (rem): `0.68` micro-label · `0.78` meta · `0.88` body · `1.0` lead ·
`1.35` section · `1.95` display. Headings sit at 600, body at 400. Uppercase micro-labels
take `0.07em` letter-spacing; nothing else is uppercase.

**Two implementation notes, both real work:**

1. **Fonts are currently declared but never loaded.** `globals.css` names Inter and
   JetBrains Mono throughout, but there is no `@font-face`, no `@import`, and no
   `next/font` anywhere in the repo. Both silently fall back — Inter to `system-ui`,
   JetBrains Mono to generic `monospace` — on any machine without them installed, which
   includes the venue projector. Instrument Sans and IBM Plex Mono must be wired through
   `next/font` or they will fall back the same way.
2. **Georgia serif headings must go.** Display headings currently ship as
   `font:500 clamp(32px,4.7vw,62px)/.96 Georgia,serif`, which is undocumented and is a
   large part of the old "premium war room" texture. Roster is sans throughout.

---

## Workforce language

### Rank and employment

**Rank marks are removed.** Nothing in the UI uses `⌃`, `⌃⌃`, `⌃⌃⌃`, `◆` or `★`.

Rank splits into two things that render differently:

| Concept | Source | How it renders |
| --- | --- | --- |
| **Employment type** | `workers.employmentType` | A chip with two states — `Intern` (outline, muted) and `Permanent` (solid `aoi-accent-s` fill, accent text) |
| **Seniority / role** | `workers.rank`, `workers.title` | Plain text in the worker's role line — "General Manager", "Property Operations Executive" |

No schema change is required. `rank` renders as its title string rather than as a glyph.

**Promotion** is the chip inverting from outline to solid fill, plus the title changing.
That is the whole visual event — no new hue, no medal. It reads as a status change, which
is what it is.

### Worker states

`idle`, `thinking`, `using_tool`, `waiting_human`, `delegating`, `blocked`, and `complete`
are presentation states supplied by persisted worker state. Active/thinking indicators
pulse; non-active states remain still. Unchanged from the previous direction.

### Alex

Alex is the main orchestrator and persistent General Manager. Alex identifies gaps and
delegates, but application policy remains authoritative. Alex's selectable communication
preference is:

- Normal English (default)
- Singlish
- Mandarin
- Tamil
- Malay

This setting is presentation-ready in the landlord UI. Runtime configuration and
persistence belong to the backend.

---

## Naming

| Current | Target | Why |
| --- | --- | --- |
| Command Centre | **Workspace** | The single highest-value change in this document. The olive and the chevrons only read as martial because this phrase told the viewer how to read them. |
| AI Operations Feed | **Activity** | Same register problem, smaller surface. |
| Workforce, capability, assignment, approval, staffing | *unchanged* | Already neutral HR/ops vocabulary. |

The product name stays **Army of Interns**. In every lockup, set **Interns** as the
emphasised half — that alone shifts the read from platoon to office.

---

## Workspace

The presentation surface communicates the workflow without raw chain-of-thought:

- React Flow workforce topology driven by worker records and reporting lines;
- worker cards with employment chip, title, identity, and current state;
- generic work-item panel for case, budget, deadline, assignments and human dependency;
- structured Activity feed sourced from agent events;
- participant lobby with join instructions and privacy-safe callsigns only;
- quote board showing backend-persisted price, availability, viability and recommendation;
- approval state visible before spend-committing actions;
- promotion payoff when persisted employment/rank/title state changes.

The local replay harness demonstrates these visual checkpoints: crew joining, intake,
Operations staffing, Procurement staffing and evaluation, verified outcome, and promotion.

---

## Landlord Home Command

`/landlords` is the QR destination for a landlord. It is mobile-first and responsive on
larger displays.

### Primary composition

- Alex is central as the Property Manager.
- Two specialist workers orbit Alex — see _Open question 1_ below, which must be settled
  before the avatar scene is finalised.
- Property cards summarise maintenance, invoices and payment protection.
- A maintenance journey explains `New → Hiring → Matched → Fixed → Paid`.
- The page makes the approval boundary explicit: contractors are neither confirmed nor
  paid before owner approval.

### Avatar scene

The Alex hero is a CSS/DOM-rendered scene (no WebGL dependency): a stylised manager form, command ring and orbiting contractor/tenant beacons, driven by Alex's supplied Strobi avatar definition. It respects reduced-motion preferences and needs no GPU, so it renders identically in WebGL-restricted browsers and projector environments without a separate fallback path.

Under Roster the ring is `aoi-accent`, not brass.

---

## Messaging surface

Participants join and are contacted through **the messaging app the demo is running on —
WhatsApp or Telegram**. No surface, label, QR caption or document should hardcode one
provider; the deployment picks it.

---

## Live workflow narrative

1. Participants join through the messaging-app QR; the owner is already registered.
2. Tenant reports a maintenance issue; backend creates a generic work item.
3. Alex identifies a missing operations capability and creates Shu Zhen from a generic
   worker specification.
4. Shu Zhen diagnoses the case and requests Procurement staffing rather than expanding
   her own permissions.
5. Alex creates Kai, who solicits and receives contractor responses.
6. Backend extracts responses and evaluates options with explicit business rules.
7. Alex requests owner approval for the recommendation.
8. Only after approval does the backend confirm the selected contractor, notify the other
   contractors, and update the tenant.
9. Contractor completion is followed by tenant verification; only verification closes the
   work item.
10. Persisted success history can trigger a promotion recommendation. Approved promotion
    changes Shu Zhen to permanent Property Operations Executive and updates the
    organisation visually.

---

## Non-negotiable boundaries

- No public phone numbers.
- No raw model chain-of-thought.
- No frontend-calculated business rules for option viability, approval or policy.
- No spend-committing action before a persisted owner approval.
- No case closure before tenant outcome verification.
- Worker/runtime/provider internals never leak into generic UI components.

---

## Open questions

Neither is a visual decision, and both should be settled by the people who own them.

1. **Shu Zhen and Kai are described inconsistently.** The Landlord section previously
   stated "Shu Zhen appears as the Contractor agent. Kai appears as the Tenant agent."
   The Live workflow narrative (steps 3–5) and `IMPLEMENTATION_PLAN.md` §4 both have
   Shu Zhen as the **Operations** intern and Kai as the **Procurement** intern. The
   landlord composition above has been left deliberately unspecific pending a decision.
2. **Does the landing page share `globals.css`?** If yes it inherits the token set for
   free; if it is a separate Vercel project it needs its own copy. Affects the route
   table below.

---

## Routes and implementation references

| Route | Purpose |
| --- | --- |
| `/` | Workspace — replay / operational view |
| `/brand` | Living design system; light/dark and product-mode specimens |
| `/landlords` | Landlord Home Command QR destination |
| `/landing` | Public marketing page — built, not yet merged |

Key implementation files:

- `tailwind.config.ts` — `aoi.*` token wiring.
- `src/app/globals.css` — token values, theme variants and surface rules.
- `src/components/command-centre.tsx` — generic workforce renderer.
- `src/components/brand-system.tsx` — living visual reference.
- `src/components/landlord-command-centre.tsx` — landlord shell and voice choice UI.
- `src/components/landlord-avatar-scene.tsx` — Three.js avatar scene with fallback.

---

## Design pass checklist

Deferred until the backend is done. Roughly in dependency order:

- [ ] Load Instrument Sans + IBM Plex Mono via `next/font`.
- [ ] Swap `aoi-*` values to the Roster set; add `aoi-accent`, alias the deprecated tokens.
- [ ] Make light the default theme; keep dark as the alternate.
- [ ] Remove Georgia serif from all display headings.
- [ ] Replace every rank glyph with the employment chip + title.
- [ ] Rework promotion as chip fill inversion.
- [ ] Migrate `.command-centre` off the legacy `--ink`/`--canvas`/`--panel` tokens, then
      delete that token set.
- [ ] Rename Command Centre → Workspace, AI Operations Feed → Activity, in UI and docs.
- [ ] Retheme `/landing` onto the shared tokens.
- [ ] Update `/brand` so the living reference reflects Roster.
