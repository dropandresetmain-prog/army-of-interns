# Army of Interns — Hackathon Implementation Plan

Status: master implementation plan for Agents Everywhere hackathon build

## 1. Objective

Build a live, audience-participation demo of a **generic adaptive AI workforce for SMEs**.

The product starts with one persistent AI manager. When work arrives, the manager should:

1. understand the requested outcome and constraints;
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

Core product thesis:

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

The owner should manage the business outcome, not an agent graph.

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

Target code separation:

```text
src/
  core/
    orchestration/
    workforce/
    capabilities/
    approvals/
    events/
    tools/

  integrations/
    twilio/
    openrouter/

  scenarios/
    property-maintenance/

app/
  command-centre/

convex/
  schema.ts
  ...
```

Exact directories may change as the implementation takes shape, but the dependency direction must remain:

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

### Human roles

- 1 Business Owner
- 1 Tenant
- 3 Contractors

### AI workforce at demo start

- Alex — permanent AI General Manager

### AI workers created during the demo

- an Operations Intern, presented as Shu Zhen;
- a Procurement Intern, presented as Kai.

Names and personalities are persistent worker data / presentation identities. Core orchestration must rely on worker IDs, capabilities, permissions, and assignments rather than hardcoded names.

### Required live flow

1. Audience participants join the WhatsApp demo and are assigned Tenant or Contractor roles.
2. The Business Owner is already registered.
3. The Tenant sends a natural WhatsApp message reporting a leaking toilet.
4. The request becomes a generic `workItem` with objective, context, constraints, and success criteria.
5. Alex identifies required maintenance/property-operations capability.
6. Alex inspects the workforce and finds no suitable worker.
7. Alex creates an Operations Intern from a generic `WorkerSpec`; the UI presents the new persistent identity as Shu Zhen.
8. Shu Zhen receives an assignment and contacts the Tenant through WhatsApp.
9. Shu Zhen asks concise diagnostic questions and classifies the issue as plumbing maintenance.
10. Shu Zhen identifies a second capability need: contractor/vendor sourcing.
11. Shu Zhen requests staffing instead of silently expanding her own role.
12. Alex creates a Procurement Intern from another `WorkerSpec`; the UI presents that worker as Kai.
13. Kai uses generic option-solicitation tooling to contact 3 live Contractor participants.
14. Contractors reply naturally with price and availability.
15. The system extracts structured response data and ranks viable options using explicit scenario rules.
16. Alex presents the recommended option to the Business Owner and requests approval before any spend-committing confirmation.
17. The Business Owner approves through WhatsApp.
18. The selected Contractor receives confirmation; non-selected Contractors receive a polite rejection; the Tenant receives the appointment update.
19. The selected Contractor reports completion.
20. Shu Zhen asks the Tenant to verify the issue is fixed.
21. The Tenant confirms resolution.
22. The work item closes only after outcome verification.
23. Shu Zhen’s seeded history plus the live successful assignment crosses the promotion threshold.
24. Alex recommends retaining/promoting Shu Zhen.
25. The Business Owner approves the promotion.
26. The live dashboard visibly updates Shu Zhen from temporary intern to permanent Property Operations Executive.

End-state visual:

```text
Before

★ Alex
General Manager

After

★ Alex
General Manager
├── ⌃⌃ Shu Zhen
│   Property Operations Executive
│   PERMANENT
└── ⌃ Kai
    Procurement Intern
    TEMPORARY
```

---

## 5. Product principles and invariants

### Persistent employee identity

An AI employee is not the underlying model. Worker identity is application state that survives provider/model changes.

A worker contains, at minimum:

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

The manager matches **required capabilities** on work against **worker capabilities**.

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

A later request requiring the same capability should reuse the existing suitable worker if availability and policy permit.

### Worker breadth is bounded

A worker may request staffing when required work falls outside its capability/permission envelope. This is how the organisation can later evolve into narrower specialist roles instead of turning every worker into a god agent.

Automatic role splitting is not required for the hackathon.

### Intern-to-employee lifecycle

Interns are temporary by default. Repeated successful use can trigger a retention/promotion recommendation.

For the hackathon this is deterministic rather than ML-based. Seed two prior successful Operations assignments; the live successful assignment becomes the third and triggers the recommendation.

### Personality is presentation, not authority

Workers can have memorable personalities and light Singlish communication styles.

Demo examples:

- Alex: calm, concise, pragmatic, lightly cheeky SME-manager tone;
- Shu Zhen: efficient, proactive, slightly kancheong, light Singlish;
- Kai: numbers-driven, transactional, concise.

Personality must never alter deterministic controls such as permissions, approval thresholds, option ranking, or closure criteria.

### Structured visibility, not raw chain-of-thought

Do not expose raw/hidden chain-of-thought.

Meaningful decisions/actions emit structured events such as:

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

The command centre renders these as an AI Operations Feed.

---

## 6. Locked technical architecture

### Frontend / command centre

- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- React Flow (`@xyflow/react`) for live org chart
- Motion for status/spawn/promotion animations
- Lucide icons
- lightweight confetti effect for promotion payoff
- Vercel if venue deployment is useful

Visual direction: premium SME command centre with subtle strategy-game energy. Dark charcoal base, warm off-white typography, restrained olive accents, brass/gold rank insignia. Avoid cartoonish military styling.

### Backend / application state

- Convex

Convex is authoritative for:

- company profile and policies;
- human identities;
- persistent AI worker identities;
- capabilities;
- work items;
- assignments;
- approvals;
- worker history/performance counters;
- structured events;
- messaging correlation / idempotency state;
- demo-participant state;
- scenario-specific records where necessary.

Use reactive queries to drive the command centre.

### Messaging

- Twilio WhatsApp testing/Sandbox environment
- inbound webhook -> Convex HTTP action
- outbound messages -> Twilio REST API

Do not add production Meta WhatsApp Business onboarding during the hackathon.

### Agent orchestration

Primary path:

- OpenAI Agents SDK for orchestration
- OpenRouter for inference
- free/tool-capable OpenRouter models where reliable

Run a bounded compatibility spike before depending on this path:

- one tool call;
- one structured extraction;
- one manager-to-worker delegation;
- selected OpenRouter model through the provider path.

If this path is unreliable after the bounded spike, replace only the runtime/orchestration adapter with OpenRouter Agent SDK. Convex state, tools, contracts, UI, and scenario flow remain unchanged.

Do not introduce Hermes into the hackathon core runtime.

### Architecture

```text
       REAL HUMANS ON WHATSAPP
  Owner / Tenant / Contractors
                │
                ▼
              Twilio
                │
                ▼
         Convex HTTP Action
                │
                ▼
         Generic Work Intake
                │
                ▼
       Generic Workforce Kernel
 objective → capabilities → staffing
                │
                ▼
        Agent Runtime Adapter
        OpenAI Agents SDK
                │
                ▼
          Generic Tool Layer
                │
                ▼
            OpenRouter
             inference


              Convex
                │
        reactive subscriptions
                │
                ▼
        Next.js Command Centre
```

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

Humans participating in workflows.

- `displayName`
- `roleType`
- `whatsappNumber`
- `demoCallsign`
- `active`
- optional scenario metadata

`tenant` and `contractor` are scenario roles, not universal core types.

Never render phone numbers publicly.

### `workers`

Persistent AI identities.

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

Fields:

- `key`
- `name`
- `description`
- optional default tool requirements

Example values:

- `maintenance_triage`
- `stakeholder_messaging`
- `vendor_sourcing`
- `option_evaluation`
- `scheduling`
- `research`
- `content_marketing`
- `bookkeeping`

### `workItems`

Anything the business wants accomplished.

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

The same object must support requests such as:

- fix a leaking toilet;
- prepare next week’s social posts;
- chase an overdue invoice;
- source three caterers under a budget;
- schedule interviews.

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

The mechanism must be generic enough for contractor spend today and other sensitive actions later.

### `events`

Primary runtime-to-UI interface.

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

### Scenario-specific records

Scenario data such as price/availability responses should live behind the property-maintenance adapter rather than define the core orchestration contract.

An `optionResponses` collection may contain:

- work item ID;
- responder person ID;
- raw message;
- extracted fields;
- viability flags;
- ranking.

---

## 8. Generic workforce manager contract

Alex must not contain property-management instructions.

The manager loop is conceptually:

```text
What outcome is requested?
What does success look like?
What capabilities are required?
Who already has those capabilities?
Who should own the work?
Is capability missing?
What can proceed now?
What requires human authority?
Has the outcome actually been achieved?
What does this teach us about recurring workforce demand?
```

New workers are created from a generic `WorkerSpec`:

```text
WorkerSpec
- role/title
- required capabilities
- allowed tools
- manager relationship
- communication style
- model preference
- reason for creation
```

Persist the worker profile before any assignment executes.

---

## 9. Generic tool design

Avoid demo-named tools such as `requestPlumberQuotes()`.

### `solicitOptions`

Inputs:

- target audience;
- requirements;
- structured fields to collect;
- work item reference.

Demo usage:

- requirement: repair leaking toilet by target time;
- fields: price + availability.

The same primitive should later work for caterers, suppliers, freelancers, etc.

### `requestApproval`

Inputs:

- proposed action;
- reason;
- payload;
- risk / authority context.

### `requestStaffing`

Inputs:

- missing capability;
- reason;
- desired responsibility.

### `verifyOutcome`

Inputs:

- configured success criteria;
- relevant human/system evidence source.

---

# 10. Shared foundation — MUST complete before lane split

The foundation is shared work. It must end with a **generic workforce kernel**, not merely Twilio plumbing.

## 10.1 Foundation deliverables

1. Initialise one Next.js + TypeScript application with Convex.
2. Install shared UI/runtime dependencies.
3. Define and commit the generic domain schema/types from Section 7.
4. Define and commit the event vocabulary.
5. Configure environment handling; never commit `.env` files or credentials.
6. Configure Twilio WhatsApp testing/Sandbox.
7. Prove inbound WhatsApp: phone -> Twilio -> Convex.
8. Prove outbound WhatsApp: Convex/backend -> Twilio -> phone.
9. Prove reactive UI: Convex change -> UI update without refresh.
10. Implement generic work intake: natural request -> `workItem`.
11. Implement capability-analysis contract: `workItem` -> required capabilities.
12. Implement workforce matching by capability.
13. Implement generic worker creation: missing capability -> `WorkerSpec` -> persisted worker.
14. Implement generic assignment creation.
15. Emit structured events for each stage.
16. Render workers, work items, and events in a basic realtime UI.
17. Validate worker reuse: a second request requiring an existing capability should match the existing worker rather than create a duplicate when policy permits.
18. Commit the working foundation before parallel lane work begins.

## 10.2 Foundation genericity acceptance test

The **same orchestration code** must handle two materially different requests.

Example A:

> “The toilet in Room 3 is leaking.”

Expected:

```text
WorkItem created
→ maintenance capability inferred
→ no suitable worker
→ Operations-type WorkerSpec generated
→ worker persisted
→ assignment created
```

Example B:

> “Prepare our Instagram posts for next week.”

Expected:

```text
WorkItem created
→ content_marketing capability inferred
→ no suitable worker
→ Marketing-type WorkerSpec generated
→ worker persisted
→ assignment created
```

Passing condition:

> **No orchestration-code change between A and B.** Only request content, inferred capabilities, and generated WorkerSpec differ.

## 10.3 Foundation gate

Do **not** split into lanes until all of the following are demonstrated:

```text
WhatsApp -> Twilio -> Convex
Convex -> Twilio -> WhatsApp
Convex -> reactive UI
Natural request -> generic WorkItem
WorkItem -> required capabilities
Capabilities -> workforce match OR WorkerSpec
WorkerSpec -> persisted worker
Worker -> assignment
Runtime changes -> structured events -> UI
Existing capability -> worker reuse
Two different request domains -> same orchestration path
```

The commit that passes this gate becomes the **foundation checkpoint** and starting point for both post-foundation lanes.

---

# 11. Post-foundation lane split — LOCKED OWNERSHIP

Once the foundation gate passes, split into exactly two implementation lanes.

This split is by **system boundary**, not by arbitrary frontend/backend allocation.

```text
                    SHARED FOUNDATION
         domain contracts + Convex + kernel
                         │
                foundation checkpoint
                         │
              ┌──────────┴──────────┐
              │                     │
              ▼                     ▼
        LANE A: RUNTIME       LANE B: EXPERIENCE
        AI + tools +          command centre +
        messaging +           realtime theatre
        scenario adapter
              │                     │
              └──────────┬──────────┘
                         ▼
                INTEGRATION CHECKPOINTS
```

## 11.1 Shared contract frozen at the split

The following become shared contracts once the foundation checkpoint is committed:

- Convex schema for core domain objects;
- shared TypeScript domain types;
- event names and minimum event payloads;
- worker status vocabulary;
- work-item status vocabulary;
- approval status vocabulary;
- public Convex queries/mutations/actions consumed by the other lane;
- generic `WorkerSpec` shape;
- tool-definition metadata shape.

These contracts should be treated as **stable interfaces**, not lane-owned implementation details.

## 11.2 Rule for changing shared contracts after the split

If either lane discovers that a shared contract must change:

1. stop building against the proposed change locally;
2. make the smallest possible shared-contract change on its own explicit commit;
3. ensure both lanes can consume the changed contract;
4. merge/rebase both lane branches onto that commit;
5. only then continue lane-specific work.

Do not allow each lane to evolve its own incompatible copy of a schema/type/event.

## 11.3 Lane communication boundary

The two lanes communicate through:

- Convex persisted state;
- shared domain types;
- approved events;
- documented public backend functions.

They must **not** communicate through hidden implementation coupling.

Specifically:

- Lane A must not call React component functions or depend on presentation-specific state.
- Lane B must not import agent prompts, runtime SDK objects, model/provider clients, or execution internals.
- Scenario-specific UI may read scenario state, but it must not become the authority for workflow/business decisions.

## 11.4 Recommended branches after the foundation checkpoint

Use two branches from the same passing foundation commit:

```text
feature/workforce-runtime
feature/live-command-centre
```

Keep shared-contract changes small and separately identifiable. Avoid broad cross-lane commits.

---

## 12. Lane A — Workforce Runtime, Tools & Messaging

### Objective

Make the generic workforce engine perform real work and complete the property-maintenance demo through the generic contracts.

### Owns

- OpenAI Agents SDK runtime integration;
- OpenRouter provider/model wiring;
- manager orchestration logic;
- worker factory;
- capability analysis;
- workforce matching;
- worker reuse;
- assignment/delegation logic;
- generic tool registry and permission enforcement;
- Twilio inbound/outbound workflow processing;
- generic option solicitation;
- response extraction;
- scenario evaluation rules;
- approval execution guards;
- outcome verification;
- promotion/retention rules;
- property-maintenance scenario adapter;
- runtime/integration tests.

### Does not own

- React Flow rendering;
- dashboard composition;
- visual worker cards;
- animations;
- presentation mode;
- UI interpretation of event styling.

### A1. Provider/runtime spike

- configure OpenAI Agents SDK;
- configure OpenRouter provider path;
- validate selected free/tool-capable model;
- prove one tool call;
- prove one structured extraction;
- prove one manager-to-worker delegation;
- switch to OpenRouter Agent SDK if this bounded spike is unreliable.

Do not spend material hackathon time defending a provider abstraction.

### A2. Generic manager runtime

Required actions:

- inspect workforce;
- infer required capabilities;
- match suitable worker;
- create worker from `WorkerSpec` when needed;
- reuse existing worker when appropriate;
- assign work;
- receive worker staffing requests;
- request human approval;
- monitor status;
- trigger outcome verification;
- evaluate promotion eligibility.

### A3. Worker factory and permission mapping

Create runtime workers from persisted worker records / `WorkerSpec`.

Tool availability must be determined by code/configuration from worker permissions, never invented by the LLM.

### A4. Generic option-solicitation workflow

Implement a reusable “ask multiple external humans/providers for structured options” flow.

Property-maintenance adapter usage:

- choose the 3 joined Contractor participants;
- send requirements;
- correlate replies to the active work item;
- extract price + availability;
- persist structured responses.

### A5. Deterministic scenario evaluation

For the property demo:

1. reject options that miss the deadline;
2. prefer options within budget;
3. among equally viable options, prefer lower price;
4. preserve data required to explain the recommendation.

The generic solicitation primitive remains scenario-agnostic.

### A6. Approval boundary

Demo commands may be simple:

- `APPROVE <work-item-id>`
- `REJECT <work-item-id>`

No spend-committing confirmation may execute until approval state is `approved`.

Rejection must:

- persist the rejection;
- prevent contractor confirmation;
- move work into a blocked/re-source state;
- emit visible events.

### A7. Outcome verification and promotion

- selected Contractor reports completion;
- Tenant verifies success;
- work item completes only after configured verification;
- worker success history updates;
- promotion/retention rule runs;
- approved promotion updates persistent worker identity.

### Lane A completion gate

Lane A is complete when the entire demo workflow can execute correctly **without relying on the command-centre UI for business logic or workflow state**.

---

## 13. Lane B — Live Command Centre & Demo Theatre

### Objective

Make the generic workforce system understandable, trustworthy, and visually memorable while remaining a read/control surface over the shared state contracts.

### Owns

- visual design system;
- realtime org chart;
- worker cards and profile surfaces;
- generic work-item views;
- AI Operations Feed;
- capability/permission visibility;
- participant lobby;
- property-scenario option/quote board;
- approval-state visibility;
- worker status visuals;
- animations;
- promotion payoff;
- presentation mode;
- UI/visual tests.

### Does not own

- agent prompts;
- OpenAI/OpenRouter runtime code;
- Twilio workflow processing;
- business-rule evaluation;
- approval enforcement;
- worker permission enforcement;
- outcome-verification logic.

### B1. Visual system

Required direction:

- dark charcoal base;
- warm off-white typography;
- restrained olive accents;
- brass/gold rank treatment;
- high-information but uncluttered cards;
- subtle strategy/military cues rather than literal military cosplay.

Rank concept:

- `⌃` Intern
- `⌃⌃` Permanent Employee
- `⌃⌃⌃` Senior
- `◆` Lead
- `★` Manager

Only Intern, Permanent Employee, and Manager are required for the hackathon.

### B2. Generic realtime org chart

Use React Flow.

Render from Convex worker state rather than hardcoded nodes.

Required:

- reporting relationships;
- dynamic worker spawn;
- rank/employment type;
- current status;
- realtime updates;
- arbitrary new worker rendering without code changes.

### B3. AI Operations Feed

Render structured events generically.

Example:

```text
10:42:03  ALEX
New work received.

10:42:05  ALEX
Required capability: maintenance triage.
No suitable worker found.

10:42:06  ALEX
Created Operations Intern: Shu Zhen.

10:42:27  SHU ZHEN
Additional capability required: vendor sourcing.
```

Do not render raw chain-of-thought.

### B4. Generic work-item panel

Show:

- objective;
- status;
- constraints;
- required capabilities;
- assigned workers;
- current dependency;
- success criteria;
- completion state.

Property-specific data can appear in a scenario-specific subpanel.

### B5. Participant lobby

Presentation-mode join screen:

- WhatsApp QR / join instructions;
- Business Owner ready state;
- Tenant `0/1 -> 1/1`;
- Contractors `0/3 -> 3/3`;
- `DEMO CREW READY` when minimum participants exist.

Never display real phone numbers.

### B6. Scenario option/quote board

Render the three live contractor responses with:

- anonymous/callsign identity;
- price;
- availability;
- viability state;
- selected/winner state.

The UI renders persisted evaluation output; it does not make the business decision.

### B7. Promotion payoff

On promotion:

- transition rank insignia;
- update title;
- update employment type;
- animate org-chart state;
- update career/history metrics;
- use restrained celebration/confetti.

### Lane B completion gate

Lane B is complete when any valid worker/work-item/event data conforming to the shared contracts renders correctly **without knowing which model/runtime created it**.

---

# 14. Reintegration checkpoints — BOTH LANES STOP AND TEST

The lanes must not disappear until final integration. Both lanes reintegrate at these checkpoints.

## Checkpoint 1 — Generic workforce creation

Lane A evidence:

- arbitrary WhatsApp request -> `workItem`;
- capabilities inferred;
- workforce checked;
- missing capability -> worker created;
- assignment + events persisted.

Lane B evidence:

- worker appears from Convex state;
- work item is visible;
- operations feed renders generic events.

Required test:

- property-maintenance request;
- marketing request;
- same orchestration path.

Commit a working checkpoint before continuing.

## Checkpoint 2 — External execution + human authority

Lane A evidence:

- scenario adapter contacts 3 Contractors;
- natural replies become structured options;
- deterministic evaluation works;
- owner approval requested and enforced;
- rejection prevents external commitment.

Lane B evidence:

- response/quote board updates live;
- worker statuses update;
- approval state is visible;
- selected option is explainable.

Run both:

- rejection path;
- successful approval path.

Commit a working checkpoint before continuing.

## Checkpoint 3 — Verified outcome + workforce evolution

Lane A evidence:

- Contractor reports completion;
- Tenant verifies outcome;
- work item closes;
- performance counters update;
- promotion recommendation and approval persist.

Lane B evidence:

- case visibly closes;
- promotion animation works;
- org chart reflects permanent worker state.

After this checkpoint, **freeze feature scope**.

Remaining time goes to reliability, visual polish, README/submission materials, and rehearsal.

---

## 15. Reliability and security invariants

### Participant privacy

The join screen must state that the interaction is a hackathon simulation and no real service/payment is being requested.

Never publicly display participant phone numbers.

Provide a demo reset/delete operation for temporary participant mappings and scenario response data.

### Twilio idempotency

Persist/process Twilio message identifiers so duplicate delivery cannot:

- create duplicate work items;
- create duplicate workers;
- create duplicate responses;
- execute duplicate approvals;
- send duplicate confirmations.

### Approval invariant

No authority-requiring external action may execute before the corresponding approval record is `approved`.

### Outcome-verification invariant

A worker/vendor reporting completion is not sufficient evidence. Close work only when configured success criteria are verified.

### Worker-creation invariant

Worker profile creation must persist before any assignment executes.

### Permission invariant

A worker only receives tools explicitly allowed by its configured permissions.

### Model-independence invariant

Provider/model choice must not define worker identity or organisational state.

---

## 16. Required tests

Prioritise deterministic/high-risk behavior.

### Automated tests

At minimum:

- arbitrary request becomes generic `workItem`;
- capability output maps to workforce matching;
- existing suitable worker is reused;
- missing capability creates a worker without scenario-specific branching;
- maintenance and marketing requests pass the genericity acceptance test;
- permission mapping prevents unauthorised tools;
- structured response parser extracts demo fields;
- property evaluation rejects late options and applies budget rules;
- approval rejection prevents external confirmation;
- duplicate Twilio webhook does not duplicate state/actions;
- work cannot close before outcome verification;
- promotion threshold triggers only after required success count.

### Manual end-to-end checks

Before presentation:

1. join required participants;
2. run genericity smoke tests;
3. run maintenance request;
4. verify dynamic worker creation;
5. Tenant receives message;
6. 3 Contractors receive requests;
7. all 3 reply differently;
8. responses populate command centre;
9. owner receives approval request;
10. run rejection and confirm no contractor is booked;
11. reset;
12. run approval happy path;
13. selected Contractor receives confirmation;
14. Tenant receives update;
15. Contractor reports completion;
16. Tenant verifies success;
17. promotion executes;
18. UI survives refresh;
19. verify no secrets/phone numbers appear publicly.

---

## 17. Scope exclusions

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

## 18. Stretch goals — only after Checkpoint 3

Priority order:

1. rename a worker through WhatsApp and persist identity;
2. adjustable communication-style presets;
3. polished worker profile drawer with work history/permissions;
4. reuse a persistent worker in a second non-maintenance execution workflow;
5. Exa-backed sourcing if sponsor access is trivial;
6. additional career/rank levels.

Do not trade core reliability for stretch goals.

---

## 19. Demo presentation flow

1. Explain the SME problem: owners become the operating system for recurring WhatsApp work.
2. Show initial company with only Alex.
3. State the thesis: the owner gives work; the organisation forms around it.
4. Audience participants join live roles.
5. Tenant sends an unscripted issue.
6. Show generic `workItem` + capability analysis.
7. Alex identifies capability gap and creates Operations Intern.
8. Worker interacts with real Tenant.
9. Worker identifies another capability gap.
10. Alex creates Procurement Intern.
11. Procurement worker contacts 3 real Contractor participants.
12. Unscripted responses appear live.
13. System evaluates viable options.
14. Owner approval is requested.
15. Demonstrate explicit human control.
16. Real humans receive resulting messages.
17. Contractor reports completion.
18. Tenant verifies outcome.
19. Worker is promoted after repeated successful use.
20. Close on the architecture thesis: the same engine staffs different work because the core operates on work items, capabilities, workers, tools, approvals, and outcomes — not plumbing-specific code.

---

## 20. Definition of done

The hackathon MVP is done when one clean live run proves:

> A real human sends an unpredictable work request through WhatsApp; the generic workforce kernel converts it into work, identifies required capabilities, matches or creates workers, delegates visible execution, coordinates external humans, respects an owner approval boundary, verifies the actual result, persists workforce history, and evolves the organisation — while the command centre shows the process live.

The repository must also pass the genericity check:

> Changing the incoming request from a property-maintenance problem to a materially different task such as marketing produces different capabilities / WorkerSpecs without changing orchestration code.

And the architecture must pass the lane-independence check:

> Runtime execution can complete correctly without the command-centre UI, and the command centre can render valid workforce/work/event state without importing runtime/provider internals.

Once these conditions pass reliably, stop adding backend capability and spend remaining time on visual polish, README/submission materials, demo rehearsal, and failure-proofing.
