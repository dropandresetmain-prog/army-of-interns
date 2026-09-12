# Army of Interns — Hackathon Implementation Plan

Status: master implementation plan for Agents Everywhere hackathon build

## 1. Objective

Build a live, audience-participation demo of a **generic adaptive AI workforce for SMEs**.

The product starts with one persistent AI manager. When work arrives, the manager:

1. understands the requested outcome and constraints;
2. determines which capabilities are required;
3. inspects the current workforce;
4. reuses a suitable worker when one exists;
5. creates a temporary intern when capability is missing;
6. delegates work through bounded tools and permissions;
7. escalates actions that require human authority;
8. verifies the outcome rather than merely reporting activity;
9. records what capabilities the business repeatedly needs;
10. can recommend retaining/promoting useful temporary workers into permanent AI employees.

The hackathon demo must prove **execution, not merely advice**. The system must change external state, coordinate real humans, and make it unreasonable to say, “I could just ask ChatGPT for the answer.”

Core product thesis:

> You do not manually design your AI organisation. You give your AI manager work, and the organisation forms around the work your business actually needs.

Working tagline:

> Your first AI employee hires the rest.

## 2. Judging-criteria alignment

The implementation must be designed around the four published hackathon criteria.

### Core Requirements & Functionality

Show one complete workflow inside the intended environment, from a real human request through agent staffing, external actions, approval, and a verified result.

### Innovation & Theme Alignment

The innovation is not “AI coordinates a plumber.” It is:

> A manager agent dynamically assembles and evolves a workforce around incoming work.

WhatsApp is not incidental. It provides the real multi-party context of SME work: owners, customers/tenants, vendors, asynchronous replies, and approval requests all occur in the surface where many small businesses already operate.

### Technical Execution & Integration

The repository must visibly contain reusable architecture, not a hardcoded demo chain. Reviewers should be able to see:

- generic work intake;
- capability-based staffing;
- worker identity and permissions;
- persistent organisational state;
- model/runtime separation;
- tool execution;
- human approval boundaries;
- idempotent messaging/webhooks;
- structured events/observability;
- one relevant rejection/failure path.

### Usefulness & Agentic Experience

The owner should manage the business outcome, not an agent graph.

The intended interaction is:

> “Handle this.”

The system should determine what work exists, who should do it, whether another worker is required, which tools are allowed, what needs owner approval, and whether the result has actually been achieved.

## 3. Core engine versus demo scenario

The **core runtime must not contain plumbing-specific logic, names, or role assumptions**.

The generic engine is:

```text
NEW WORK ARRIVES
       │
       ▼
Understand objective + constraints
       │
       ▼
Determine required capabilities
       │
       ▼
Inspect current workforce
       │
       ├── Suitable worker exists ──→ assign
       │
       └── Capability missing ──────→ create intern profile
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
Verify outcome
       │
       ▼
Record success/failure + capability demand
       │
       ▼
Recommend workforce change if warranted
```

The property-maintenance experience is a **scenario adapter / demo fixture** built on top of this engine.

The codebase should make this separation obvious, for example:

```text
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
```

A reviewer should be able to replace the property-maintenance scenario without rewriting the workforce kernel.

## 4. Demo scenario

The demo simulates a small property-operations SME and uses live audience participation.

Human roles:

- 1 Business Owner
- 1 Tenant
- 3 Contractors

AI workforce at the start:

- Alex — permanent AI General Manager

AI workers created during the demo:

- an Operations Intern, displayed as Shu Zhen;
- a Procurement Intern, displayed as Kai.

The names are presentation-layer identities generated/selected for the demo. Core orchestration must rely on worker capabilities and IDs, not hardcoded names.

### Required live flow

1. Audience participants join the WhatsApp demo and are assigned Tenant or Contractor roles.
2. The Business Owner is already registered as the owner identity.
3. The Tenant sends a natural WhatsApp message reporting a leaking toilet.
4. The request becomes a generic `workItem` with objective, context, constraints, and success criteria.
5. Alex infers a required property-operations / maintenance-triage capability.
6. Alex inspects the workforce. No suitable worker exists.
7. Alex creates an Operations Intern from a generic `WorkerSpec`; the UI presents that worker as Shu Zhen.
8. Shu Zhen receives an assignment and contacts the Tenant through WhatsApp.
9. Shu Zhen asks concise diagnostic questions and classifies the issue as plumbing maintenance.
10. Shu Zhen identifies a second capability need: contractor/vendor sourcing.
11. Shu Zhen requests staffing instead of silently becoming a procurement expert.
12. Alex creates a Procurement Intern from another `WorkerSpec`; the UI presents that worker as Kai.
13. Kai uses generic option-solicitation tooling to contact the 3 live Contractor participants.
14. Contractors reply naturally with price and availability.
15. The system extracts structured response data and ranks viable options using explicit application rules.
16. Alex reports the recommended option to the Business Owner and requests approval before any spend-committing confirmation occurs.
17. The Business Owner approves through WhatsApp.
18. The selected Contractor receives confirmation; the non-selected Contractors receive a polite rejection; the Tenant receives the appointment update.
19. The selected Contractor reports completion.
20. Shu Zhen asks the Tenant to verify that the issue is fixed.
21. The Tenant confirms resolution.
22. The work item closes only after outcome verification.
23. Shu Zhen’s seeded history plus the live successful assignment crosses the promotion threshold.
24. Alex recommends retaining/promoting Shu Zhen into a permanent role.
25. The Business Owner approves the promotion.
26. The live dashboard visibly updates Shu Zhen from temporary intern to permanent Property Operations Executive.

The end state should make the organisational evolution obvious:

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

## 5. Product principles

### Persistent employee identity

An AI employee is not the underlying model. Employee identity is an application-level object that persists independently of provider/model changes.

A persistent worker contains, at minimum:

- name;
- title / role;
- employment type;
- rank;
- reporting line;
- capabilities;
- allowed tools / permissions;
- personality / communication style;
- work history;
- performance counters;
- standing instructions;
- model configuration.

The same worker should remain the same worker even if the model powering them changes later.

### Capability-based staffing

The manager matches **required capabilities** on a work item against **worker capabilities**.

Core orchestration must never depend on statements such as:

```ts
if (problem === "toilet") spawnShuZhen();
```

Instead:

```text
WorkItem requires: maintenance_triage
Current workforce match: none
→ create worker with maintenance_triage capability
```

A second request requiring the same capability should reuse the existing suitable worker if availability/policy permits.

### Intern-to-employee lifecycle

Interns are initially temporary. Repeated successful use of the same capability can trigger a promotion/retention recommendation.

For the hackathon, this is deterministic rather than ML-based. Seed two prior successful Operations assignments for the demo worker; the live successful assignment becomes the third and triggers the recommendation.

### Personality is presentation, not authority

Employees may have distinct personalities and light Singlish communication styles.

Example demo personas:

- Alex: calm, concise, pragmatic, lightly cheeky SME-manager tone.
- Shu Zhen: efficient, proactive, slightly kancheong, light Singlish.
- Kai: numbers-driven, transactional, concise.

Personality must never alter deterministic business controls such as approval thresholds, permissions, option ranking, or closure criteria.

### Structured visibility, not raw chain-of-thought

Do not expose hidden/raw chain-of-thought.

Every meaningful decision/action should emit a structured event, for example:

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

The dashboard renders these as an AI Operations Feed so observers can follow what the workforce is doing and why at an appropriate level of abstraction.

## 6. Locked technical architecture

### Frontend / visual command centre

- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- React Flow (`@xyflow/react`) for the live org chart
- Motion for spawn/promotion/status animations
- Lucide for interface icons
- lightweight confetti effect for the promotion payoff
- Vercel if venue deployment is needed

Visual direction: premium SME command centre with subtle strategy-game energy. Dark charcoal base, warm off-white typography, restrained olive accents, brass/gold rank insignia. Avoid cartoonish military styling.

### Backend / operational state

- Convex

Convex is the authoritative application state store for:

- company profile and policies;
- human identities;
- persistent worker identities;
- capabilities;
- work items;
- assignments;
- approvals;
- worker history/performance counters;
- structured events;
- messaging correlation/state;
- demo-participant state;
- scenario-specific records where needed.

Use Convex reactive queries to drive the live command centre.

### Messaging

- Twilio WhatsApp testing/Sandbox environment
- Twilio webhooks terminate at a Convex HTTP action
- Twilio REST API sends outbound WhatsApp messages

Do not add production Meta WhatsApp Business onboarding during the hackathon.

### Agent orchestration

Primary choice:

- OpenAI Agents SDK for orchestration
- OpenRouter for model inference
- free/tool-capable OpenRouter models where reliability permits

The OpenAI Agents SDK is selected because its manager/worker abstractions fit the workforce story.

Before committing to the runtime path, perform a bounded compatibility spike:

- one tool call;
- one structured extraction;
- one manager-to-worker delegation;
- selected OpenRouter free model through the chosen provider path.

If this is unreliable after a short bounded spike, replace only the runtime/orchestration layer with OpenRouter Agent SDK. Convex state, tools, lane contracts, UI, and workflow remain unchanged.

Do not introduce Hermes into the hackathon core runtime.

### Core architecture

```text
      REAL HUMANS ON WHATSAPP
 Owner / Tenant / Contractor A/B/C
               │
               ▼
             Twilio
               │
               ▼
        Convex HTTP Action
               │
          Work intake
               │
               ▼
      Generic Workforce Kernel
   objective → capabilities → staffing
               │
               ▼
        OpenAI Agents SDK
               │
         manager + workers
               │
               ▼
          tool execution
               │
               ▼
           OpenRouter
        model inference


             Convex
               │
      reactive subscriptions
               │
               ▼
      Next.js Command Centre
```

## 7. Generic domain model

Keep the schema intentionally small but generic.

### `companyProfiles`

- `name`
- `businessDescription`
- `ownerPersonId`
- `operatingPolicies`
- `approvalPolicies`
- `terminology`
- `availableToolIds`

The demo company can configure a spending threshold and property-operations context without hardcoding those into orchestration.

### `people`

Represents humans participating in workflows.

- `displayName`
- `roleType`
- `whatsappNumber`
- `demoCallsign`
- `active`
- optional scenario metadata

The core engine should not require `tenant` or `contractor` as universal human types. Those are scenario roles.

Phone numbers must never be rendered publicly.

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

Examples:

- `maintenance_triage`
- `stakeholder_messaging`
- `vendor_sourcing`
- `option_evaluation`
- `scheduling`
- `research`
- `copywriting`
- `bookkeeping`

Fields:

- `key`
- `name`
- `description`
- optional default tool requirements

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
- optional budget / policy metadata

Examples that must fit the same object:

- fix a leaking toilet;
- prepare next week’s social campaign;
- chase an overdue invoice;
- source three caterers under a budget;
- schedule interviews for shortlisted candidates.

### `assignments`

Generic delegation relationship.

- `workItemId`
- `workerId`
- `responsibility`
- `status`
- `resultSummary`

### `approvals`

Generic human-authority boundary.

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

Today this can represent approving a contractor spend. Tomorrow the same mechanism could approve sending a campaign, placing an order, or changing a record.

### `events`

Primary interface contract between runtime logic and the live command centre.

- `timestamp`
- `workerId`
- `workItemId`
- `eventType`
- `summary`
- `metadata`

### `toolDefinitions`

Registry describing available tools and permissions.

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

Scenario-specific data such as contractor quote fields may exist, but should live behind the property-maintenance scenario adapter and not define the generic orchestration contract.

For the demo, an `optionResponses` or `scenarioQuotes` collection can store:

- responder person ID;
- raw message;
- extracted fields such as price/availability;
- viability flags;
- ranking.

## 8. Generic workforce manager responsibilities

Alex should not contain property-management instructions.

The manager loop is conceptually:

```text
What is being requested?
What does success look like?
What capabilities does this require?
Who do I already have?
Who should own the work?
Is capability missing?
What work can proceed in parallel?
What requires human authority?
Has the result actually been achieved?
What did this teach me about workforce demand?
```

Worker creation must operate from a generic `WorkerSpec`, for example:

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

The worker factory persists the profile before the worker receives assignments.

## 9. Generic tool design

Avoid demo-named tools such as `requestPlumberQuotes()`.

Prefer reusable tools/primitives such as:

### `solicitOptions`

Input:

- target audience;
- requirements;
- structured fields to collect;
- work item reference.

For the demo:

- requirement: repair leaking toilet by 5pm;
- collect: price + availability.

The same primitive should later support caterers, freelance designers, suppliers, etc.

### `requestApproval`

Input:

- proposed action;
- reason;
- payload;
- risk/authority context.

### `requestStaffing`

Input:

- missing capability;
- reason;
- desired responsibility.

### `verifyOutcome`

Input:

- success criteria;
- relevant human/system source.

## 10. Shared foundation phase — complete before lane split

This phase is shared and must end with a **generic workforce kernel**, not merely messaging plumbing.

### Foundation deliverables

1. Initialise one Next.js + TypeScript application with Convex.
2. Install shared UI/runtime dependencies.
3. Define generic domain schema/types for company profiles, people, workers, capabilities, work items, assignments, approvals, events, and tool definitions.
4. Define the allowed event vocabulary.
5. Configure environment handling; never commit secrets or `.env` files.
6. Configure the Twilio WhatsApp testing environment.
7. Prove inbound WhatsApp delivery:
   - send `hello` from a phone;
   - Convex receives and stores it.
8. Prove outbound WhatsApp delivery:
   - backend sends an Army of Interns test reply.
9. Prove reactive UI delivery:
   - insert a fake worker/event;
   - UI updates without refresh.
10. Implement generic work intake:
   - incoming natural-language request becomes a `workItem`.
11. Implement capability analysis contract:
   - runtime produces required capabilities for the work item.
12. Implement workforce matching:
   - inspect current workers by capability.
13. Implement generic worker creation:
   - when no suitable worker exists, create a persisted worker from a `WorkerSpec`.
14. Implement assignment creation.
15. Emit structured events for all of the above.
16. Render the resulting worker/work item/event changes in a basic realtime UI.
17. Commit the shared schema/contracts/kernel before the lanes diverge.

### Foundation genericity acceptance test

The same orchestration code must handle at least two different requests without scenario-specific branching.

Example A:

> “The toilet in Room 3 is leaking.”

Expected result:

```text
WorkItem created
→ capability: maintenance_triage
→ no worker match
→ Operations-type intern created
→ assignment created
```

Example B:

> “Prepare our Instagram posts for next week.”

Expected result:

```text
WorkItem created
→ capability: content_marketing
→ no worker match
→ Marketing-type intern created
→ assignment created
```

Passing condition:

**No orchestration code changes between A and B.** Only request content / capability output / worker spec differ.

### Foundation gate

Do not split into implementation lanes until all of these are proven:

```text
WhatsApp -> Twilio -> Convex
Convex -> Twilio -> WhatsApp
Convex -> reactive UI
Natural request -> generic WorkItem
WorkItem -> required capabilities
Capabilities -> workforce match or WorkerSpec
WorkerSpec -> persisted worker
Worker -> assignment
Runtime changes -> structured events -> UI
```

This foundation is the source-of-truth contract for both lanes.

## 11. Post-foundation lane split

After the foundation gate passes, split cleanly into two independent lanes.

### Lane contract

The lanes communicate only through:

- Convex domain state;
- shared domain types;
- the approved event vocabulary.

The runtime lane must not call frontend component functions.

The command-centre lane must not import or depend on runtime internals, prompts, provider-specific objects, or model SDK classes.

If a shared schema/type change is required after the split, make that change as a small explicit shared commit before either lane builds on it.

### Lane A — Workforce Runtime, Tools & Messaging

Objective: make the generic workforce engine perform real work and complete the live property-maintenance scenario.

Owns:

- OpenAI Agents SDK / runtime provider integration;
- OpenRouter model provider wiring;
- manager logic;
- worker factory;
- capability analysis;
- workforce matching;
- assignment/delegation logic;
- generic tool registry;
- Twilio inbound/outbound workflow logic;
- option solicitation/response extraction;
- deterministic option evaluation;
- approval execution guards;
- outcome verification;
- promotion/retention rules;
- scenario adapter logic for the property-maintenance demo;
- runtime tests.

Does **not** own visual rendering, React Flow, animations, dashboard composition, or presentation-mode UI.

#### A1. Provider/runtime spike

- configure OpenAI Agents SDK;
- configure OpenRouter provider path;
- validate selected free/tool-capable model;
- prove one tool call;
- prove one structured extraction;
- prove one manager-to-worker delegation;
- switch to OpenRouter Agent SDK if this bounded spike is unreliable.

#### A2. Manager runtime

Implement the generic manager responsibilities defined above.

Required generic actions:

- inspect workforce;
- infer capabilities;
- match worker;
- request/create worker;
- assign work;
- receive staffing request from a worker;
- request human approval;
- monitor work item status;
- trigger outcome verification;
- evaluate promotion eligibility.

#### A3. Worker factory and permission mapping

Create workers from `WorkerSpec` records.

Tool availability must be assigned by code/configuration according to capability/permission mapping, not invented by the LLM.

#### A4. Generic option-solicitation workflow

Implement the reusable “ask multiple external humans/providers for structured options” flow.

For the property-maintenance scenario:

- select 3 joined Contractor participants;
- send request;
- associate replies with the current work item;
- extract price + availability;
- persist structured responses.

#### A5. Deterministic evaluation

For the demo adapter, evaluate options with explicit rules:

1. reject options that miss the deadline;
2. prefer options within budget;
3. among equally viable options, prefer lower price;
4. preserve explainable data for the manager’s recommendation.

The core option-solicitation primitive remains generic; only the scenario evaluation rule is property-demo-specific.

#### A6. Approval boundary

Required demo commands:

- `APPROVE <work-item-id>`
- `REJECT <work-item-id>`

No spend-committing contractor confirmation may execute before an approval record is `approved`.

On rejection:

- persist rejection;
- do not confirm contractor;
- move work into an explicit blocked/re-source state;
- emit visible events.

#### A7. Outcome verification and promotion

- Contractor reports completion;
- Tenant verifies success;
- only verified outcome completes the work item;
- worker success counters update;
- promotion/retention check runs;
- owner approval persists worker promotion.

### Lane B — Live Command Centre & Demo Theatre

Objective: make the generic workforce system understandable, trustworthy, and visually memorable.

Owns:

- overall visual system;
- realtime org chart;
- work item views;
- operations/event feed;
- worker cards/profile drawer;
- capability/permission display;
- participant lobby;
- scenario quote/option board;
- approval visibility;
- agent status states;
- animations;
- promotion payoff;
- presentation mode;
- UI-specific tests and visual verification.

Does **not** own agent prompts, model/runtime SDKs, Twilio workflow logic, tool execution, option ranking, or approval enforcement.

#### B1. Visual system

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

Only Intern, Permanent Employee, and Manager need implementation for the hackathon.

#### B2. Generic realtime org chart

Use React Flow.

Render workers from Convex state, not hardcoded Alex/Shu Zhen/Kai nodes.

Required behaviours:

- reporting relationships visible;
- worker spawn animation;
- status visible;
- rank/employment type visible;
- worker cards respond to realtime state changes;
- any dynamically created worker can render without a code change.

#### B3. Generic AI Operations Feed

Render structured `events` generically.

Examples:

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

No raw chain-of-thought.

#### B4. Work item panel

Generic panel should render:

- objective;
- status;
- constraints;
- required capabilities;
- assigned workers;
- current human/system dependency;
- success criteria;
- completion state.

Property-maintenance-specific fields can be shown through a scenario panel layered on top.

#### B5. Participant lobby

Presentation-mode join screen showing:

- WhatsApp QR / join instructions;
- required demo roles and readiness;
- `DEMO CREW READY` when required participants exist.

Never display real phone numbers.

#### B6. Scenario option/quote board

Render the property-maintenance scenario’s three contractor responses live.

The UI may call them “quotes,” but it must consume generic scenario option-response state rather than dictate runtime logic.

#### B7. Promotion payoff

On promotion:

- update insignia;
- title;
- employment type;
- org-chart structure;
- metrics/history;
- restrained celebration animation.

## 12. Integration checkpoints

Do not let the lanes disappear until the end. Merge/test at these checkpoints.

### Checkpoint 1 — Generic workforce creation

Runtime evidence:

- arbitrary WhatsApp work request becomes `workItem`;
- capabilities are inferred;
- existing workforce is checked;
- missing capability creates a persisted worker;
- assignment + events exist.

Command-centre evidence:

- generic worker appears from Convex state;
- generic work item is visible;
- operations feed renders events.

Run both plumbing and marketing genericity tests.

### Checkpoint 2 — External execution and approval

Runtime evidence:

- property scenario adapter contacts 3 Contractors;
- natural responses become structured options;
- deterministic evaluation works;
- owner approval is requested and enforced;
- rejection path prevents execution.

Command-centre evidence:

- option board updates live;
- worker statuses update;
- approval state is visible;
- chosen option is understandable.

### Checkpoint 3 — Verified outcome and workforce evolution

Runtime evidence:

- Contractor reports completion;
- Tenant verifies result;
- work closes;
- performance counters update;
- promotion recommendation executes;
- approved promotion persists.

Command-centre evidence:

- work visibly closes;
- promotion animation works;
- org chart reflects permanent worker state.

After Checkpoint 3, freeze feature scope.

## 13. Reliability and invariants

### Participant safety / privacy

The join screen must state that this is a hackathon simulation and no real service or payment is being requested.

Never display participants’ phone numbers publicly.

Provide a demo reset/delete operation for temporary participant mappings and scenario response data.

### Idempotency

Twilio webhooks can be retried. Persist/process Twilio message identifiers so duplicate inbound delivery cannot:

- create duplicate work items;
- create duplicate workers;
- create duplicate option responses;
- execute duplicate approvals;
- send duplicate confirmations.

### Approval invariant

No authority-requiring external action may execute before the corresponding approval is `approved`.

### Outcome-verification invariant

A worker/vendor reporting completion is not itself proof of success. Close the work item only when the configured success criteria are verified.

### Worker-creation invariant

Worker profile creation must persist successfully before assignments execute.

### Permission invariant

A worker may only receive tools explicitly allowed by its configured capability/permission mapping.

### Model independence

Provider/model choice must not define worker identity or organisational state.

## 14. Required tests and checks

Prioritise high-risk deterministic logic.

### Automated tests

At minimum:

- arbitrary request becomes generic `workItem`;
- capability output maps to workforce matching;
- existing suitable worker is reused;
- missing capability creates a new worker without scenario-specific branching;
- plumbing request and marketing request both pass the genericity acceptance test;
- role/tool mapping prevents unauthorized tool access;
- structured responder parser extracts required demo fields;
- property scenario ranking rejects late options and applies budget rules;
- approval rejection prevents external confirmation;
- duplicate Twilio webhook does not duplicate state/actions;
- work cannot close before configured outcome verification;
- promotion threshold triggers only after required success count.

### Manual end-to-end checks

Before presentation:

1. join required participants;
2. run plumbing request;
3. verify dynamic worker creation;
4. Tenant receives message;
5. 3 Contractors receive requests;
6. all reply differently;
7. response data populates UI;
8. owner receives approval request;
9. test rejection path and confirm no contractor is booked;
10. reset;
11. run approval happy path;
12. selected Contractor receives confirmation;
13. Tenant receives update;
14. Contractor sends completion;
15. Tenant verifies success;
16. promotion executes;
17. UI survives refresh;
18. run the marketing genericity smoke test;
19. verify no secrets or phone numbers are exposed.

## 15. Scope exclusions

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
- multi-company production tenancy;
- production billing;
- production authentication;
- arbitrary recursive agent spawning;
- raw chain-of-thought display;
- full HR/admin functionality;
- sophisticated learned worker scoring.

## 16. Stretch goals — only after feature freeze criteria pass

In priority order:

1. Rename a worker through WhatsApp and persist the identity.
2. Adjustable communication-style preset.
3. Polished worker profile drawer with work history and permissions.
4. Generic worker reuse across a second non-maintenance workflow.
5. Exa-backed sourcing if sponsor access is trivial and the core workflow is already reliable.
6. Additional ranks/career progression.

Do not trade core reliability for stretch goals.

## 17. Demo presentation flow

1. Explain the SME problem: owners become the operating system for recurring WhatsApp work.
2. Show the initial company with only Alex.
3. Show the product thesis: the owner gives work; the organisation forms around it.
4. Live audience roles join.
5. Tenant sends an unscripted issue.
6. Show the generic work item and capability analysis.
7. Alex identifies a capability gap and creates an Operations Intern.
8. The new worker interacts with the real Tenant.
9. The worker identifies another capability gap.
10. Alex creates a Procurement Intern.
11. Procurement worker contacts 3 real Contractor participants.
12. Unscripted responses appear live.
13. System evaluates viable options.
14. Owner approval is requested.
15. Demonstrate explicit human control.
16. Real humans receive resulting messages.
17. Contractor reports completion.
18. Tenant verifies outcome.
19. Worker is promoted after repeated successful use.
20. Close on the architecture thesis: the same engine can staff different work because the core operates on work items, capabilities, workers, tools, approvals, and verified outcomes—not on plumbing-specific code.

## 18. Definition of done

The hackathon MVP is done when one clean live run proves:

> A real human sends an unpredictable work request through WhatsApp; the generic workforce kernel converts it into a work item, identifies required capabilities, matches or creates workers, delegates visible work, coordinates external humans, respects an owner approval boundary, verifies the actual result, persists workforce history, and evolves the organisation — while the command centre shows the process live.

In addition, the repository must pass the genericity check:

> Changing the incoming request from a property-maintenance problem to a marketing task produces a different capability/worker selection without changing orchestration code.

Once those conditions pass reliably, stop adding backend capability and spend remaining time on visual polish, README/submission materials, demo rehearsal, and failure-proofing.