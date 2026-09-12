# Army of Interns — Hackathon Implementation Plan

Status: master implementation plan for Agents Everywhere hackathon build

## 1. Objective

Build a live, audience-participation demo of a **generic adaptive AI workforce for SMEs**.

The product starts with one persistent AI manager. When work arrives, the manager should:

1. understand the requested outcome, context, constraints, and success criteria;
2. determine which capabilities are required;
3. inspect the current workforce;
4. reuse a suitable worker when one exists;
5. create a temporary intern when capability is missing;
6. delegate work through bounded tools and permissions;
7. escalate actions that require human authority;
8. verify the outcome rather than merely reporting activity;
9. record which capabilities the business repeatedly needs;
10. recommend retaining/promoting useful temporary workers into permanent AI employees.

The hackathon demo must prove **execution, not merely advice**. The system must change external state, coordinate real humans, and make it unreasonable to say, “I could just ask ChatGPT for the answer.”

Core thesis:

> You do not manually design your AI organisation. You give your AI manager work, and the organisation forms around the work your business actually needs.

Working tagline:

> Your first AI employee hires the rest.

---

## 2. Judging-criteria alignment

Implementation choices should directly support the four published judging criteria.

### Core Requirements & Functionality

Show one complete workflow inside the intended environment, from a real human request through staffing, external actions, approval, and a verified result.

### Innovation & Theme Alignment

The innovation is not “AI coordinates a plumber.” It is:

> A manager agent dynamically assembles and evolves a workforce around incoming work.

WhatsApp matters because it supplies real SME operating context: owners, customers/tenants, vendors, asynchronous replies, and approval requests all live in the surface where work already happens.

### Technical Execution & Integration

The repository must visibly contain reusable architecture rather than a hardcoded demo chain. Reviewers should be able to identify:

- generic work intake;
- capability-based staffing;
- persistent worker identity;
- explicit worker permissions;
- model/runtime separation;
- generic tool execution;
- human approval boundaries;
- idempotent messaging/webhooks;
- structured events/observability;
- a meaningful rejection/failure path;
- a demo scenario layered on top of, rather than embedded inside, the core engine.

### Usefulness & Agentic Experience

The owner manages the business outcome, not an agent graph.

The intended interaction is simply:

> “Handle this.”

The system determines what work exists, who should do it, whether another worker is required, which tools are allowed, what needs owner approval, and whether the result has actually been achieved.

---

## 3. Core engine versus demo scenario

The **core runtime must not contain plumbing-specific logic, hardcoded worker names, or scenario-specific role assumptions**.

The generic engine is:

```text
NEW WORK ARRIVES
       │
       ▼
Understand objective + constraints + success criteria
       │
       ▼
Determine required capabilities
       │
       ▼
Inspect current workforce
       │
       ├── Suitable worker exists ──→ assign
       │
       └── Capability missing ──────→ create intern from WorkerSpec
                                      │
                                      ▼
Worker executes using permitted tools
       │
       ├── Can complete ────────────→ continue
       │
       ├── Needs capability ────────→ request staffing
       │
       └── Needs authority ─────────→ request human approval
                                      │
                                      ▼
Verify outcome against success criteria
       │
       ▼
Record success/failure + capability demand
       │
       ▼
Recommend workforce change if warranted
```

The property-maintenance experience is a **scenario adapter / demo fixture** built on top of this engine.

Target dependency direction:

```text
scenario adapter -> generic core -> integrations
                         │
                         ▼
                       Convex
                         │
                         ▼
                 command-centre UI
```

A reviewer should be able to replace the property-maintenance scenario without rewriting the workforce kernel.

---

## 4. Hackathon demo scenario

The demo simulates a small property-operations SME and uses live audience participation.

Human roles:

- 1 Business Owner
- 1 Tenant
- 3 Contractors

Initial AI workforce:

- Alex — permanent AI General Manager

Workers created during the demo:

- an Operations Intern, presented as Shu Zhen;
- a Procurement Intern, presented as Daniel.

Names/personality are persistent worker data and presentation identities. Core orchestration relies on worker IDs, capabilities, permissions, and assignments.

### Required live flow

1. Audience participants join the WhatsApp demo and are assigned Tenant or Contractor roles.
2. The Business Owner is already registered.
3. The Tenant reports a leaking toilet through WhatsApp.
4. The request becomes a generic `workItem`.
5. Alex identifies required maintenance/property-operations capability.
6. Alex finds no suitable worker and creates an Operations Intern from a generic `WorkerSpec`.
7. Shu Zhen receives the assignment and contacts the Tenant.
8. Shu Zhen diagnoses the issue and identifies a second capability need: contractor/vendor sourcing.
9. Shu Zhen requests staffing instead of silently expanding her own role.
10. Alex creates a Procurement Intern from another generic `WorkerSpec`.
11. Daniel uses generic option-solicitation tooling to contact 3 live Contractor participants.
12. Contractors reply naturally with price and availability.
13. The system extracts structured response data and applies explicit scenario evaluation rules.
14. Alex presents the recommended option to the Business Owner and requests approval.
15. Approval is required before any spend-committing confirmation.
16. The selected Contractor is confirmed; non-selected Contractors are notified; the Tenant receives the appointment update.
17. The selected Contractor reports completion.
18. Shu Zhen asks the Tenant to verify success.
19. The work item closes only after outcome verification.
20. Shu Zhen’s seeded history plus the live success crosses the promotion threshold.
21. Alex recommends retaining/promoting Shu Zhen.
22. The Business Owner approves the promotion.
23. The command centre visibly updates Shu Zhen from temporary intern to permanent Property Operations Executive.

---

## 5. Product principles and invariants

### Persistent employee identity

Worker identity is application state, not the underlying model. A worker persists across provider/model changes.

Worker state includes, at minimum:

- name;
- title / role;
- employment type;
- rank;
- reporting line;
- capabilities;
- tool permissions;
- personality / communication style;
- work history;
- performance counters;
- standing instructions;
- model configuration.

### Capability-based staffing

Forbidden core pattern:

```ts
if (problem === "toilet") spawnShuZhen();
```

Required conceptual pattern:

```text
WorkItem requires: maintenance_triage
Current workforce match: none
→ generate WorkerSpec
→ create worker with maintenance_triage capability
```

A later request requiring the same capability should reuse the existing suitable worker when availability/policy permits.

### Worker breadth is bounded

A worker may request staffing when required work falls outside its capability/permission envelope. This prevents every employee from becoming a god agent.

### Intern-to-employee lifecycle

Interns are temporary by default. Repeated successful use can trigger a deterministic retention/promotion recommendation.

### Personality is presentation, not authority

Workers can have memorable personalities and light Singlish communication styles. Personality must never alter permissions, approval thresholds, deterministic option ranking, or closure criteria.

### Structured visibility, not raw chain-of-thought

Do not expose raw/hidden chain-of-thought.

Meaningful runtime actions emit structured events such as:

- `work_received`
- `capabilities_identified`
- `worker_matched`
- `staffing_requested`
- `worker_created`
- `assignment_started`
- `tool_called`
- `human_contacted`
- `human_response_received`
- `approval_requested`
- `approval_resolved`
- `work_verified`
- `work_completed`
- `promotion_recommended`
- `worker_promoted`

The command centre renders these as the AI Operations Feed.

---

## 6. Locked technical architecture

### Frontend / command centre

- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- React Flow (`@xyflow/react`)
- Motion
- Lucide
- lightweight confetti effect
- Vercel if venue deployment is useful

Visual direction: premium SME command centre with subtle strategy-game energy. Dark charcoal, warm off-white typography, restrained olive accents, brass/gold rank insignia. Avoid cartoonish military styling.

### Backend / application state

- Convex

Convex is authoritative for company policy, people, workers, capabilities, work items, assignments, approvals, events, message correlation/idempotency, workforce history, and scenario state.

### Messaging

- Twilio WhatsApp testing/Sandbox
- inbound webhook -> Convex HTTP action
- outbound messages -> Twilio REST API

### Agent orchestration

Primary path:

- OpenAI Agents SDK for orchestration
- OpenRouter for inference
- free/tool-capable OpenRouter models where reliable

Run a bounded provider compatibility spike before depending on this path. If it fails quickly, replace only the runtime adapter with OpenRouter Agent SDK. Convex contracts, tools, scenario flow, and UI remain unchanged.

Do not introduce Hermes into the hackathon core runtime.

---

## 7. Generic domain contracts

Keep the schema intentionally small but generic.

### `companyProfiles`

- `name`
- `businessDescription`
- `ownerPersonId`
- `operatingPolicies`
- `approvalPolicies`
- `terminology`
- `availableToolIds`

### `people`

- `displayName`
- `roleType`
- `whatsappNumber`
- `demoCallsign`
- `active`
- optional scenario metadata

`tenant` and `contractor` are scenario roles, not universal core types.

### `workers`

- `name`
- `title`
- `employmentType`: `permanent | intern`
- `rank`
- `managerWorkerId`
- `status`
- `capabilityIds`
- `toolPermissionIds`
- `personality`
- `communicationStyle`
- `modelConfig`
- `tasksCompleted`
- `successfulTasks`
- `promotionEligible`

### `capabilities`

- `key`
- `name`
- `description`
- optional default tool requirements

Examples: `maintenance_triage`, `stakeholder_messaging`, `vendor_sourcing`, `option_evaluation`, `content_marketing`, `research`, `bookkeeping`.

### `workItems`

- `objective`
- `context`
- `constraints`
- `status`
- `requestedByPersonId`
- `parentWorkItemId`
- `requiredCapabilityIds`
- `successCriteria`
- `deadline`
- optional budget/policy metadata

The same object must support maintenance, marketing, collections, sourcing, scheduling, and other SME work.

### `assignments`

- `workItemId`
- `workerId`
- `responsibility`
- `status`
- `resultSummary`

### `approvals`

- `workItemId`
- `requestedFromPersonId`
- `proposedByWorkerId`
- `actionType`
- `reason`
- `riskClass`
- `amount` where relevant
- `payload`
- `status`: `pending | approved | rejected`
- `requestedAt`
- `resolvedAt`

### `events`

- `timestamp`
- `workerId`
- `workItemId`
- `eventType`
- `summary`
- `metadata`

### `toolDefinitions`

- `key`
- `description`
- `riskClass`
- `requiredPermissions`

Initial generic tool concepts:

- `send_message`
- `read_business_record`
- `update_work_item`
- `request_staffing`
- `solicit_options`
- `collect_response`
- `request_approval`
- `verify_outcome`
- `log_event`

Scenario-specific data such as contractor response fields should live behind the property-maintenance adapter rather than define the core orchestration contract.

---

# 8. Milestone map

Milestones are evidence-based checkpoints. Do not advance merely because code exists; advance when the exit criteria pass.

**Hackathon time is severely constrained.** After S1–S3, remaining work follows this compressed critical path — not the earlier multi-milestone ceremony:

```text
S4 Foundation Review & Freeze
        ↓
        SPLIT
   ┌─────────────┐
   │             │
   ▼             ▼
LANE A         LANE B
Runtime        Experience
Mission        Mission
   │             │
   └──────┬──────┘
          ▼
FULL DEMO INTEGRATION
          ↓
REJECTION PATH
          ↓
HAPPY PATH
          ↓
FEATURE FREEZE
          ↓
POLISH / REHEARSE / SUBMISSION
```

Completed shared foundation (do not reopen unless an Act Now contract blocker appears):

- S1 Project Skeleton & Contracts
- S2 Messaging & Realtime Spine
- S3 Generic Workforce Kernel

Detailed A1–A4 / B1–B4 / I1–I3 checklists below remain as **technical reference only**. For the hackathon they are **compressed into one execution mission per lane**, then one continuous full-demo integration pass.

---

# 9. Shared milestones — complete before lane split

## S1 — Project Skeleton & Shared Contracts

### Objective

Create the smallest stable project structure and shared contracts that both later lanes can safely build against.

### Deliverables

- Next.js + TypeScript app initialised;
- Convex initialised;
- environment handling configured; no secrets committed;
- core schema/types created for `companyProfiles`, `people`, `workers`, `capabilities`, `workItems`, `assignments`, `approvals`, `events`, and `toolDefinitions`;
- worker/work/approval status vocabularies defined;
- structured event vocabulary defined;
- generic `WorkerSpec` defined;
- public backend query/mutation/action boundaries documented enough for both lanes.

### Exit criteria

- project runs locally;
- Convex schema deploys successfully;
- types compile;
- a seed company + Alex can be persisted and queried;
- an event can be inserted/read;
- no demo-specific plumbing logic exists in the core contracts.

### Dependency

None.

---

## S2 — Messaging & Realtime Spine

### Objective

Prove the three transport paths the entire product depends on.

### Deliverables

- Twilio WhatsApp testing/Sandbox configured;
- inbound webhook -> Convex HTTP action;
- outbound Convex/backend -> Twilio message;
- inbound message identity/correlation persisted;
- Twilio message ID retained for idempotency;
- basic realtime frontend subscription to workers/work/events.

### Exit criteria

All three paths work on real devices/browser:

```text
WhatsApp -> Twilio -> Convex
Convex -> Twilio -> WhatsApp
Convex -> reactive UI
```

Manual proof:

1. send `hello` from a joined WhatsApp phone;
2. message appears in Convex/state;
3. backend sends a test reply to that phone;
4. inserting a worker/event updates the browser without refresh.

### Dependency

S1.

---

## S3 — Generic Workforce Kernel

### Objective

Implement the reusable product core before adding the property-maintenance execution path.

### Deliverables

- natural request -> generic `workItem`;
- work item -> required capability analysis;
- capability-based workforce matching;
- reuse existing suitable worker when policy permits;
- missing capability -> generic `WorkerSpec`;
- `WorkerSpec` -> persisted worker;
- assignment creation;
- worker permission/tool mapping contract;
- structured events emitted throughout;
- basic UI renders workers, work items, and events from Convex state.

### Exit criteria

A natural request can travel through:

```text
request
→ WorkItem
→ capability analysis
→ workforce lookup
→ worker reuse OR WorkerSpec
→ persisted worker
→ assignment
→ structured events
→ realtime UI
```

A second request requiring an existing capability reuses the appropriate worker rather than creating a duplicate.

### Dependency

S2.

---

## S4 — Foundation Review, Plan Compression & Freeze

### Objective

Perform one bounded architecture/domain review of the S1–S3 foundation, compress the remaining execution plan for the time left, fix only issues that genuinely block lane splitting, then **freeze shared contracts**.

This is the single formal review before the project splits into parallel lanes. It is **not** a broad refactor or documentation exercise.

### Required work

1. Update this plan to the compressed critical path (section 8 and post-split missions).
2. Bounded review of genericity, worker persistence/reuse, capabilities/permissions, shared contracts, event vocabulary, lane independence, and Twilio readiness.
3. Fix only Act Now blockers (broken shared contracts, genericity violations, likely corruption/duplicate execution, demo-architecture impossibilities, obvious live-demo security/privacy issues).
4. Freeze schema/domain/event/public Convex interfaces for both lanes.

### Required genericity evidence (already covered by S3 verification; re-confirm in S4)

Request A:

> “The toilet in Room 3 is leaking.”

Expected:

```text
WorkItem
→ maintenance capability
→ Operations-type worker selection/creation
→ assignment
```

Request B:

> “Prepare our Instagram posts for next week.”

Expected:

```text
WorkItem
→ content_marketing capability
→ Marketing-type worker selection/creation
→ assignment
```

### Twilio readiness during S4

S2 transport code exists. If live Twilio/Convex cloud credentials are unavailable, do **not** redesign the foundation. Classify live WhatsApp round-trip proof as **Act Now — first Lane A integration task** (external operational dependency).

### Exit criteria

- implementation plan reflects the compressed execution strategy;
- no Act Now shared-contract blocker remains;
- maintenance and marketing use the same generic pipeline;
- worker reuse is proven;
- shared schema/domain/event contracts are coherent enough to freeze;
- runtime/UI lane boundary is clear;
- remaining Twilio operational dependency is either proven or explicitly assigned to Lane A;
- required checks pass (`npm test`, typecheck, build, verify:convex / s2 / s3);
- `main` is pushed with verdict **FOUNDATION FROZEN — READY TO SPLIT**.

Only after S4 passes may the implementation split into two lanes. **Do not create lane branches inside S4.**

### Dependency

S3.

---

# 10. Post-foundation lane contract

Both lanes branch from the exact same S4 foundation checkpoint.

Recommended branches:

```text
feature/workforce-runtime
feature/live-command-centre
```

## Shared contracts frozen at the split

- core Convex schema;
- shared TypeScript types;
- event names + minimum payloads;
- worker/work/approval status vocabularies;
- public backend functions consumed across lanes;
- `WorkerSpec`;
- tool-definition metadata.

## Allowed communication between lanes

- Convex persisted state;
- shared domain types;
- approved events;
- documented public backend functions.

## Forbidden coupling

- Lane A must not call React component functions or rely on presentation-only state.
- Lane B must not import prompts, runtime SDK objects, model clients, or execution internals.
- UI cannot become the authority for business decisions.

## Shared-contract change rule

If a contract must change after the split:

1. stop work that depends on the proposed change;
2. make the smallest possible shared-contract commit;
3. verify both lanes can consume it;
4. bring both branches onto that commit;
5. then continue lane-specific work.

Do not evolve separate incompatible versions of shared schema/types/events.

---

# 11. Lane A — Runtime Mission (compressed)

Lane A owns runtime/orchestration, tools, Twilio workflow processing, approvals, verification, workforce evolution, scenario adapter logic, and runtime/integration tests.

Lane A does **not** own visual rendering, React Flow, presentation-mode UI, or animation behavior.

## Hackathon mission (authoritative)

One mission for the remaining time:

> Make the real WhatsApp property-maintenance scenario execute end-to-end through the generic workforce kernel.

Keep only what materially serves the demo:

- runtime/model adapter;
- Alex manager;
- worker execution;
- Tenant interaction;
- procurement worker;
- 3 Contractor messages;
- natural response parsing;
- simple deterministic option selection;
- owner APPROVE / REJECT;
- selected contractor confirmation;
- Tenant update;
- completion;
- Tenant verification;
- promotion state.

**First Act Now task if live Twilio was not proven in S4:** prove `WhatsApp → Twilio → public Convex` and `public Convex → Twilio → WhatsApp` with real credentials. This is an external operational dependency, not a foundation redesign.

Avoid expanding abstractions. Prefer the smallest path that completes the live demo flow.

### Compressed technical reference (A1–A4)

The subsections below are **reference detail** from the earlier multi-milestone plan. They are **not** separate hackathon gates. Deliver outcomes as one continuous Runtime Mission.

## A1 — Runtime Adapter & Generic Manager *(reference)*

### Objective

Turn the S4 generic kernel into a real agent runtime without coupling worker identity to a model/provider.

### Deliverables

- bounded OpenAI Agents SDK + OpenRouter compatibility spike;
- one successful tool call;
- one successful structured extraction;
- one manager-to-worker delegation;
- fallback decision to OpenRouter Agent SDK if the spike is unreliable;
- generic manager runtime;
- worker factory from persisted `WorkerSpec`;
- capability/permission -> allowed tool mapping enforced in code;
- worker reuse preserved.

### Exit criteria

- Alex can receive a generic work item and delegate through the runtime;
- missing capability creates a runtime-backed persisted worker;
- existing capability reuses a worker;
- runtime execution emits the existing shared events;
- no worker identity depends on provider/model objects.

### Dependency

S4.

---

## A2 — External Human Execution *(reference)*

### Objective

Give workers generic primitives for coordinating real external humans through WhatsApp.

### Deliverables

- generic `send_message` tool;
- generic `solicit_options` flow;
- responder correlation to work items;
- structured response extraction;
- property-maintenance scenario adapter;
- 3 joined Contractors can receive requests and reply naturally;
- scenario-specific evaluation rules kept outside the generic solicitation primitive.

### Exit criteria

- a worker can contact all 3 live Contractors;
- arbitrary natural replies are correlated correctly;
- price + availability are extracted into persisted structured response state;
- deterministic property-demo evaluation produces an explainable recommendation;
- duplicate inbound webhook delivery does not duplicate responses/actions.

### Dependency

A1.

---

## A3 — Human Authority & Verified Outcome *(reference)*

### Objective

Prove that autonomous execution is bounded by explicit human authority and closes only on verified results.

### Deliverables

- generic approval object + execution guard;
- owner approval request over WhatsApp;
- approve/reject handling;
- rejection path -> no external commitment + blocked/re-source state;
- approval path -> winner confirmation + non-winner notifications + Tenant update;
- completion report from selected Contractor;
- Tenant verification flow;
- work item completion only after configured success criteria are verified.

### Exit criteria

Both paths pass:

**Rejection**

- owner rejects;
- no contractor is confirmed;
- state/event feed clearly shows blocked/re-source state.

**Approval**

- owner approves;
- correct Contractor is confirmed;
- Tenant is updated;
- Contractor completion alone does not close work;
- Tenant verification closes work.

### Dependency

A2.

---

## A4 — Workforce Evolution & Runtime Hardening *(reference)*

### Objective

Complete the Army thesis: persistent useful workers evolve from temporary to permanent while runtime behavior remains reliable.

### Deliverables

- performance/success counters update on verified completion;
- seeded prior Operations history;
- deterministic promotion eligibility rule;
- Alex promotion recommendation;
- owner promotion approval;
- worker employment/rank/title persistence update;
- runtime retry/idempotency checks;
- runtime happy-path and rejection-path tests.

### Exit criteria

- live verified job can trigger promotion eligibility;
- owner approval persists the promotion;
- promoted worker remains the same persistent identity;
- the full demo workflow can execute correctly even if the command-centre UI is closed.

### Dependency

A3.

---

# 12. Lane B — Experience Mission (compressed)

Lane B owns the visual system, realtime org chart, work views, event feed, participant lobby, scenario response board, status visuals, promotion sequence, presentation mode, and UI verification.

Lane B does **not** own agent prompts, runtime/provider SDKs, Twilio workflow processing, business-rule evaluation, approval enforcement, or permission enforcement.

## Hackathon mission (authoritative)

One mission for the remaining time:

> Make the workforce evolution and live execution understandable and memorable.

Prioritise **only four strong surfaces**:

1. realtime org chart;
2. AI Operations Feed;
3. active work / quote / approval state;
4. promotion payoff.

Keep the participant join UI minimal. Do not expand into a full product UI.

### Compressed technical reference (B1–B4)

The subsections below are **reference detail** from the earlier multi-milestone plan. They are **not** separate hackathon gates. Deliver outcomes as one continuous Experience Mission.

## B1 — Visual Foundation & Generic Workforce Views *(reference)*

### Objective

Create the aesthetic system and prove that generic workforce state can render beautifully without runtime-specific knowledge.

### Deliverables

- visual design tokens/theme;
- reusable worker card;
- React Flow org chart driven entirely by Convex worker state;
- rank/employment/status treatment;
- generic work-item panel;
- generic AI Operations Feed from shared events;
- dynamic worker creation renders without code changes.

### Exit criteria

- Alex plus any dynamically inserted worker renders correctly;
- reporting lines render from data;
- worker status changes update in realtime;
- maintenance and marketing S4 test data both render with the same generic components;
- UI does not import runtime/provider objects.

### Dependency

S4.

---

## B2 — Live Participation & Scenario Surfaces *(reference)*

### Objective

Turn the command centre into a live audience-participation surface without making the UI authoritative for workflow logic.

### Deliverables

- presentation-mode participant lobby;
- WhatsApp join QR/instructions;
- Business Owner ready state;
- Tenant `0/1 -> 1/1`;
- Contractors `0/3 -> 3/3`;
- `DEMO CREW READY` state;
- scenario option/quote board rendering persisted response state;
- no phone numbers displayed publicly.

### Exit criteria

- required roles update live as participants join;
- extra participants do not break the minimum-role flow;
- 3 Contractor responses appear as distinct live cards;
- option viability/selected state reflects backend persisted evaluation rather than frontend-calculated business rules.

### Dependency

B1.

---

## B3 — Workflow Theatre & Explainability *(reference)*

### Objective

Make the agentic process legible and exciting while preserving trustworthy structured telemetry.

### Deliverables

- polished worker states: `idle`, `thinking`, `using_tool`, `waiting_human`, `delegating`, `blocked`, `complete`;
- event-driven status animation;
- visually clear capability gaps and worker spawning;
- human-wait states;
- approval-state visibility;
- selected option/recommendation explanation;
- work progress/timeline treatment;
- no raw chain-of-thought.

### Exit criteria

An observer can answer, without verbal explanation:

- what work entered the system;
- which capability was missing;
- which worker was created/reused;
- what the worker is doing now;
- what external human the system is waiting for;
- whether owner approval is pending/approved/rejected;
- why the selected option won.

### Dependency

B2.

---

## B4 — Promotion Payoff & Presentation Polish *(reference)*

### Objective

Deliver the visual climax and make the end-to-end demo feel intentional rather than hacked together.

### Deliverables

- promotion animation;
- rank/title/employment transition;
- org-chart transition after promotion;
- restrained confetti/celebration;
- workforce summary metrics;
- presentation mode sized for projector/screen;
- reset-ready visual state;
- final responsive/layout polish.

Rank concept:

- `⌃` Intern
- `⌃⌃` Permanent Employee
- `⌃⌃⌃` Senior
- `◆` Lead
- `★` Manager

Only Intern, Permanent Employee, and Manager are required for the hackathon.

### Exit criteria

- backend promotion state automatically triggers the visual transition;
- refresh preserves promoted state;
- the command centre can render valid workforce/work/event state without knowing which model/runtime created it;
- the entire presentation can be run fullscreen without developer-only controls becoming distracting.

### Dependency

B3.

---

# 13. Full demo integration (compressed) — both lanes stop and test

I1/I2/I3 from the earlier plan are **collapsed into one continuous full-demo integration pass**. Neither lane should disappear until that pass succeeds.

## Full demo integration — required final run

```text
Tenant request
→ dynamic worker staffing
→ Tenant interaction
→ procurement worker
→ 3 Contractors contacted
→ replies parsed
→ recommendation
→ owner approval/rejection
→ contractor confirmation
→ Tenant update
→ completion
→ Tenant verification
→ promotion
```

### Required proof sequence

1. **Rejection path** — owner rejects; no contractor confirmed; state/events show blocked/re-source clearly.
2. **Happy path** — owner approves; selected contractor confirmed; Tenant updated; completion + Tenant verification closes work; promotion path works.
3. Genericity smoke — marketing-shaped request still uses the same pipeline/UI surfaces.

### After both paths pass

> **FEATURE FREEZE.**

No new architecture after that. Remaining work is polish, rehearsal, and submission only.

## Post-freeze polish / submission *(formerly I4)*

### Objective

Turn the working system into a reliable hackathon submission.

### Required work

- run the entire demo repeatedly on real phones;
- verify webhook idempotency;
- verify reset flow;
- verify no phone numbers/secrets are exposed publicly;
- verify UI survives refresh;
- remove obvious debug clutter;
- update README with architecture, genericity explanation, setup, demo flow, and inherited-vs-built-during-event distinction;
- prepare public repo/submission requirements;
- rehearse the live audience-participation sequence;
- capture backup demo video.

### Exit criteria

- one clean live run can be repeated reliably;
- one backup recorded run exists;
- repository clearly shows generic kernel vs scenario adapter;
- feature scope is frozen;
- remaining work is only presentation/submission/rehearsal.

### Compressed technical reference (I1–I3 detail)

Earlier I1/I2/I3 checklists remain useful as a **detail checklist inside the single integration pass**, not as separate gates.

---

## 14. Reliability and security invariants

### Participant privacy

- state clearly that the interaction is a hackathon simulation;
- no real service/payment is being requested;
- never display participant phone numbers publicly;
- provide a demo reset/delete operation for temporary participant mappings and scenario response data.

### Twilio idempotency

Persist/process Twilio message identifiers so duplicate delivery cannot create duplicate work items, workers, responses, approvals, or confirmations.

### Approval invariant

No authority-requiring external action may execute before the corresponding approval is `approved`.

### Outcome-verification invariant

A worker/vendor reporting completion is not sufficient evidence. Close work only when configured success criteria are verified.

### Worker-creation invariant

Worker profile creation must persist before any assignment executes.

### Permission invariant

A worker only receives tools explicitly allowed by its configured permissions.

### Model-independence invariant

Provider/model choice must not define worker identity or organisational state.

---

## 15. Required tests

Prioritise high-risk deterministic behavior.

Automated tests should cover at minimum:

- arbitrary request -> generic `workItem`;
- capability output -> workforce matching;
- existing worker reuse;
- missing capability -> generic worker creation;
- maintenance + marketing genericity test;
- permission mapping;
- structured responder extraction;
- property scenario evaluation;
- rejection preventing external confirmation;
- Twilio webhook idempotency;
- outcome verification requirement;
- promotion threshold.

Manual pre-demo test should run the complete participant flow on real phones, including one rejection run and one approval/completion/promotion run.

---

## 16. Scope exclusions

Do not implement before the core demo is stable:

- production Meta WhatsApp Business onboarding;
- Gmail integration;
- Google Calendar integration;
- Stripe/payments;
- Auth0/CIBA;
- Supabase;
- Hermes runtime;
- autonomous org-chart restructuring;
- automatic role splitting;
- deep semantic memory architecture;
- production multi-company tenancy;
- production billing;
- production authentication;
- arbitrary recursive spawning;
- raw chain-of-thought display;
- full HR/admin functionality;
- sophisticated learned worker scoring.

---

## 17. Stretch goals — only after FEATURE FREEZE

Priority order:

1. rename a worker through WhatsApp and persist identity;
2. adjustable communication-style presets;
3. polished worker profile drawer with work history/permissions;
4. reuse a persistent worker in a second non-maintenance execution workflow;
5. Exa-backed sourcing if sponsor access is trivial;
6. additional career/rank levels.

Do not trade core reliability for stretch goals.

---

## 18. Demo presentation flow

1. Explain the SME problem: owners become the operating system for recurring WhatsApp work.
2. Show initial company with only Alex.
3. State the thesis: the owner gives work; the organisation forms around it.
4. Audience participants join live roles.
5. Tenant sends an unscripted issue.
6. Show generic work item + capability analysis.
7. Alex identifies a capability gap and creates an Operations Intern.
8. Worker interacts with the real Tenant.
9. Worker identifies another capability gap.
10. Alex creates a Procurement Intern.
11. Procurement worker contacts 3 real Contractors.
12. Unscripted responses appear live.
13. System evaluates viable options.
14. Owner approval is requested.
15. Real humans receive resulting messages.
16. Contractor reports completion.
17. Tenant verifies outcome.
18. Worker is promoted after repeated successful use.
19. Close on the architecture thesis: the same engine staffs different work because the core operates on work items, capabilities, workers, tools, approvals, and outcomes — not plumbing-specific code.

---

## 19. Definition of done

The hackathon MVP is done when one clean live run proves:

> A real human sends an unpredictable work request through WhatsApp; the generic workforce kernel converts it into work, identifies required capabilities, matches or creates workers, delegates visible execution, coordinates external humans, respects an owner approval boundary, verifies the actual result, persists workforce history, and evolves the organisation — while the command centre shows the process live.

The repository must also pass the genericity check:

> Changing the incoming request from property maintenance to a materially different task such as marketing produces different capabilities / WorkerSpecs without changing orchestration code.

And the architecture must pass the lane-independence check:

> Runtime execution can complete correctly without the command-centre UI, and the command centre can render valid workforce/work/event state without importing runtime/provider internals.

Once these conditions pass reliably, stop adding backend capability and spend remaining time on visual polish, submission materials, demo rehearsal, and failure-proofing.
