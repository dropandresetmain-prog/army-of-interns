# Army of Interns — Design Reference

## Product thesis

Army of Interns makes an evolving AI workforce visible and trustworthy. A business owner starts with Alex, an AI manager. As work arrives, Alex identifies capability gaps, staffs specialised workers, coordinates human participants, and shows the organisation changing around the work.

The experience has two related surfaces:

- **Command Centre**: live, presentation-ready operational theatre for owners and an audience.
- **Landlord Home Command**: a calm, mobile-first property view reached after QR entry.

The UI renders persisted application state. It must not calculate approval, quote viability, permissions, or workflow transitions.

## Visual system

The direction is premium SME command centre with restrained strategy-game energy:

- dark charcoal/blue-black foundation;
- warm off-white typography;
- olive for system activity, capabilities and active states;
- brass/gold only for rank, achievement, manager tier and promotion;
- clear elevation: `aoi-bg` → `aoi-surf` → `aoi-surf-r`;
- Inter for interface text and JetBrains Mono for telemetry.

### Tokens

| Token | Meaning |
| --- | --- |
| `aoi-bg` | Base page canvas |
| `aoi-surf` | First-level cards and navigation |
| `aoi-surf-r` | Raised cards and React Flow nodes |
| `aoi-bdr` | Quiet structural borders |
| `aoi-text` / `aoi-t2` / `aoi-tm` | Primary / supporting / metadata text |
| `aoi-olive` | System actions, capability and active state |
| `aoi-gold` / `aoi-gold-b` | Rank, promotion and management achievement |
| `aoi-thn` / `aoi-act` / `aoi-wt` / `aoi-blk` / `aoi-cmp` | Thinking / active / waiting / blocked / complete state |

Dark and light variants are both defined in `src/app/globals.css` and exposed in the living brand reference at `/brand`.

## Workforce language

### Rank

| Mark | Rank | Employment |
| --- | --- | --- |
| `⌃` | Intern | Temporary |
| `⌃⌃` | Permanent Employee | Permanent |
| `⌃⌃⌃` | Senior | Permanent |
| `◆` | Lead | Permanent |
| `★` | Manager | Permanent |

### Worker states

`idle`, `thinking`, `using_tool`, `waiting_human`, `delegating`, `blocked`, and `complete` are presentation states supplied by persisted worker state. Active/thinking indicators pulse; non-active states remain still.

### Alex

Alex is the main orchestrator and persistent General Manager. He identifies gaps and delegates, but application policy remains authoritative. Alex’s selectable communication preference is:

- Normal English (default)
- Singlish
- Mandarin
- Tamil
- Malay

This setting is presentation-ready in the landlord UI. Runtime configuration and persistence belong to the backend.

## Command Centre

The presentation surface communicates the workflow without raw chain-of-thought:

- React Flow workforce topology driven by worker records and reporting lines;
- worker cards with rank, employment type, identity, and current state;
- generic work-item panel for case, budget, deadline, assignments and human dependency;
- structured AI Operations Feed sourced from agent events;
- participant lobby with WhatsApp join instructions and privacy-safe callsigns only;
- quote board showing backend-persisted price, availability, viability and recommendation;
- approval state visible before spend-committing actions;
- promotion payoff when persisted employment/rank/title state changes.

The local replay harness demonstrates these visual checkpoints: crew joining, intake, Operations staffing, Procurement staffing and evaluation, verified outcome, and promotion.

## Landlord Home Command

`/landlords` is the QR destination for a landlord. It is mobile-first and responsive on larger displays.

### Primary composition

- Alex is central as the Property Manager.
- Shu Zhen appears as the Contractor agent.
- Kai appears as the Tenant agent.
- Property cards summarise maintenance, invoices and payment protection.
- A maintenance journey explains `New → Hiring → Matched → Fixed → Paid`.
- The page makes the approval boundary explicit: contractors are neither confirmed nor paid before owner approval.

### Avatar scene

The Alex hero is a CSS/DOM-rendered scene (no WebGL dependency): a stylised manager form, brass command ring and orbiting contractor/tenant beacons, driven by Alex's supplied Strobi avatar definition. It respects reduced-motion preferences and needs no GPU, so it renders identically in WebGL-restricted browsers and projector environments without a separate fallback path.

## Live workflow narrative

1. Participants join through the WhatsApp QR; the owner is already registered.
2. Tenant reports a maintenance issue; backend creates a generic work item.
3. Alex identifies a missing operations capability and creates Shu Zhen from a generic worker specification.
4. Shu Zhen diagnoses the case and requests Procurement staffing rather than expanding her own permissions.
5. Alex creates Kai, who solicits and receives contractor responses.
6. Backend extracts responses and evaluates options with explicit business rules.
7. Alex requests owner approval for the recommendation.
8. Only after approval does the backend confirm the selected contractor, notify the other contractors, and update the tenant.
9. Contractor completion is followed by tenant verification; only verification closes the work item.
10. Persisted success history can trigger a promotion recommendation. Approved promotion changes Shu Zhen to permanent Property Operations Executive and updates the organisation visually.

## Non-negotiable boundaries

- No public phone numbers.
- No raw model chain-of-thought.
- No frontend-calculated business rules for option viability, approval or policy.
- No spend-committing action before a persisted owner approval.
- No case closure before tenant outcome verification.
- Worker/runtime/provider internals never leak into generic UI components.

## Routes and implementation references

| Route | Purpose |
| --- | --- |
| `/` | Command Centre replay / operational view |
| `/brand` | Living design system; dark/light and product-mode specimens |
| `/landlords` | Landlord Home Command QR destination |

Key implementation files:

- `tailwind.config.ts` — `aoi.*` token wiring.
- `src/app/globals.css` — token values, light mode and surface rules.
- `src/components/command-centre.tsx` — generic workforce renderer.
- `src/components/brand-system.tsx` — living visual reference.
- `src/components/landlord-command-centre.tsx` — landlord shell and voice choice UI.
- `src/components/landlord-avatar-scene.tsx` — Three.js avatar scene with fallback.
