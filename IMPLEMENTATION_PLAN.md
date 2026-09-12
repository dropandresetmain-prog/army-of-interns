# Army of Interns — Hackathon Implementation Plan

Status: implementation plan for Agents Everywhere hackathon build

## 1. Objective

Build a live, audience-participation demo of an adaptive AI workforce for SMEs.

The product starts with one persistent AI manager. As real work arrives, the manager identifies capability gaps, creates temporary interns, delegates work, coordinates humans through WhatsApp, respects owner approval boundaries, persists useful worker identities, and can recommend promoting repeatedly useful interns into permanent AI employees.

The hackathon demo must prove **execution, not merely advice**. The system must change external state and coordinate real humans. The core demo should make it unreasonable to say, “I could just ask ChatGPT for the answer.”

Core product thesis:

> You do not manually design your AI organisation. You give your AI manager work, and the organisation forms around the work your business actually needs.

Working tagline:

> Your first AI employee hires the rest.

## 2. Demo scenario

The demo simulates a small property-operations SME and uses live audience participation.

Human roles:

- 1 Business Owner
- 1 Tenant
- 3 Contractors

AI workforce at the start:

- Alex — permanent AI General Manager

AI workforce created during the demo:

- Shu Zhen — temporary Operations Intern
- Kai — temporary Procurement Intern

### Required live flow

1. Audience participants join the WhatsApp demo and are assigned the roles Tenant or Contractor.
2. The Business Owner is already registered as the owner identity.
3. The Tenant sends a natural WhatsApp message reporting a leaking toilet.
4. Alex receives the request and determines that the current workforce lacks a property-operations capability.
5. Alex creates Shu Zhen as an Operations Intern and assigns the case.
6. Shu Zhen contacts the Tenant over WhatsApp, asks concise diagnostic questions, and classifies the issue as plumbing maintenance.
7. Shu Zhen determines that contractor sourcing is needed and escalates the capability gap to Alex.
8. Alex creates Kai as a Procurement Intern and delegates contractor sourcing.
9. Kai sends quote requests to the 3 live Contractor participants through WhatsApp.
10. Contractors reply naturally with price and availability.
11. The system extracts structured quote data and ranks viable options using explicit business rules.
12. Alex reports the recommended contractor to the Business Owner and requests approval before committing spend.
13. The Business Owner approves through WhatsApp.
14. The selected Contractor receives confirmation; the non-selected Contractors receive a polite rejection; the Tenant receives the appointment update.
15. The selected Contractor reports completion.
16. Shu Zhen asks the Tenant to verify that the issue is fixed.
17. The Tenant confirms resolution.
18. The case closes only after outcome verification.
19. Shu Zhen’s seeded history plus the live successful case crosses the promotion threshold.
20. Alex recommends that the Business Owner promote Shu Zhen into a permanent role.
21. The Business Owner approves the promotion.
22. The live dashboard visibly updates Shu Zhen from temporary intern to permanent Property Operations Executive.

The end state must make the organisational evolution obvious:

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

## 3. Product principles for the hackathon

### Persistent employee identity

An AI employee is not the underlying model. Employee identity is an application-level object that persists independently of model/provider changes.

A persistent employee contains, at minimum:

- name;
- title / role;
- employment type;
- rank;
- reporting line;
- capabilities;
- allowed tools / permissions;
- personality / communication style;
- job history;
- performance counters;
- standing instructions;
- model configuration.

The same Shu Zhen should remain Shu Zhen even if the model powering her changes later.

### Intern-to-employee lifecycle

Interns are initially temporary. Repeated successful use of the same capability can trigger a promotion recommendation.

For the hackathon, promotion is rule-based rather than ML-based. Seed two prior successful Operations jobs for Shu Zhen, then let the live successful job become the third success and trigger the recommendation.

### Personality is presentation, not authority

Employees may have distinct personalities and light Singlish communication styles to make them memorable and human-like.

Example:

- Alex: calm, concise, pragmatic, lightly cheeky SME-manager tone.
- Shu Zhen: efficient, proactive, slightly kancheong, light Singlish.
- Kai: numbers-driven, transactional, concise.

Personality must never alter deterministic business controls such as spending approval thresholds, permissions, quote ranking, or case closure conditions.

### Structured visibility, not raw chain-of-thought

Do not expose hidden/raw chain-of-thought.

Instead, every meaningful agent decision or action emits a structured `agentEvent`, such as:

- request classified;
- capability gap identified;
- intern created;
- job assigned;
- tool invoked;
- human response awaited;
- quote received;
- approval requested;
- approval received;
- contractor selected;
- case completed;
- promotion recommended;
- employee promoted.

The dashboard renders these as an “AI Operations Feed” so observers can follow what the workforce is doing and why at an appropriate level of abstraction.

## 4. Locked technical architecture

### Frontend / visual command centre

- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- React Flow (`@xyflow/react`) for the live org chart
- Motion for transitions and agent-spawn / promotion animations
- Lucide for interface icons
- `canvas-confetti` or equivalent lightweight effect for the promotion payoff
- Vercel for deployment if deployment is needed for the venue/demo

Visual direction: premium SME command centre with subtle strategy-game energy. Dark charcoal base, warm off-white text, restrained olive accents, brass/gold rank insignia. Avoid cartoonish military styling.

### Backend / operational state

- Convex

Convex is the authoritative state store for the hackathon application and should own:

- human identities and demo roles;
- persistent AI employee identities;
- workforce hierarchy;
- job/case state;
- assignments;
- contractor quotes;
- approval state;
- promotion state;
- structured agent events;
- demo-participant state.

Use Convex reactive queries to drive the live command-centre UI.

### Messaging

- Twilio WhatsApp testing/Sandbox environment
- Twilio webhooks terminate at a Convex HTTP action
- Twilio REST API sends outbound WhatsApp messages

Do not add the Meta production WhatsApp Business setup during the hackathon.

### Agent orchestration

Primary choice:

- OpenAI Agents SDK for orchestration
- OpenRouter for model inference
- Free/tool-capable OpenRouter models where reliability permits

The OpenAI Agents SDK is selected because its manager / agents-as-tools / handoff abstractions map directly onto the workforce story.

Before relying on this path, perform a bounded provider-compatibility spike. Verify that the chosen OpenRouter model works through the SDK for the specific tool-calling / structured extraction patterns required by the demo.

Fallback if the provider path is unreliable after a short bounded spike:

- replace only the orchestration/runtime layer with OpenRouter Agent SDK;
- keep Convex, Twilio, data contracts, tools, UI, and workflow unchanged.

Do not introduce Hermes into the hackathon core runtime. It remains a possible post-hackathon execution substrate but would add an unnecessary state/runtime boundary to this demo.

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
          inbound event/state
                  │
                  ▼
          OpenAI Agents SDK
                  │
                Alex
             /        \
      Shu Zhen         Kai
          │             │
          └──── tools ──┘
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
 org chart + operations feed + case + quotes
```

## 5. Minimal data model

Keep the schema intentionally small. This is a hackathon application, not the final SaaS schema.

### `companies`

- `name`
- `ownerPersonId`
- `spendApprovalThreshold`

### `people`

Represents humans participating in workflows.

- `displayName`
- `role`: `owner | tenant | contractor`
- `whatsappNumber`
- `demoCallsign` where needed
- `active`

Phone numbers must never be rendered publicly in the command centre.

### `agents`

- `name`
- `title`
- `employmentType`: `permanent | intern`
- `rank`
- `managerAgentId`
- `status`: `idle | thinking | using_tool | waiting_human | delegating | blocked | complete`
- `capabilities`
- `toolPermissions`
- `personality`
- `communicationStyle`
- `model`
- `tasksCompleted`
- `successfulTasks`
- `promotionEligible`

### `jobs`

- `type`
- `description`
- `status`
- `tenantPersonId`
- `budget`
- `deadline`
- `assignedAgentIds`
- `selectedContractorId`
- `completionVerified`

### `assignments`

- `jobId`
- `agentId`
- `responsibility`
- `status`
- `resultSummary`

### `quotes`

- `jobId`
- `contractorPersonId`
- `rawMessage`
- `price`
- `availability`
- `meetsDeadline`
- `withinBudget`
- `rank`

### `approvals`

- `jobId`
- `requestedFromPersonId`
- `actionType`
- `amount`
- `status`: `pending | approved | rejected`
- `requestedAt`
- `resolvedAt`

### `agentEvents`

The primary interface contract between runtime logic and the live command centre.

- `timestamp`
- `agentId`
- `jobId`
- `eventType`
- `summary`
- `metadata`

### `demoParticipants`

- `personId`
- `requestedRole`
- `assignedRole`
- `ready`
- `joinedAt`

## 6. Shared setup phase

Complete this phase before parallelising work.

### Shared setup deliverables

1. Initialise the repository with one Next.js + TypeScript application and Convex.
2. Install the shared UI/runtime dependencies required by both lanes.
3. Define the Convex schema and shared domain types.
4. Define the allowed `agentEvent` vocabulary.
5. Configure local environment handling; never commit secrets or `.env` files.
6. Configure the Twilio WhatsApp testing environment.
7. Prove inbound WhatsApp delivery:
   - send `hello` from a phone;
   - Convex receives and stores it.
8. Prove outbound WhatsApp delivery:
   - trigger a test backend action;
   - the phone receives an Army of Interns test message.
9. Prove realtime UI delivery:
   - insert a fake `agent_created` event;
   - the frontend reacts without refresh and renders the new workforce member/event.
10. Commit the shared schema/contracts before the lanes diverge.

### Shared setup gate

Do not split work until all three paths are proven:

```text
WhatsApp -> Twilio -> Convex
Convex -> Twilio -> WhatsApp
Convex -> reactive UI
```

## 7. Parallel implementation lanes

The lane boundary is deliberate: runtime logic communicates with the UI only through Convex state and `agentEvents`. The command-centre lane must not depend on runtime internals, and the runtime lane must not depend on frontend component functions.

### Lane A — Workforce Runtime & Messaging

Objective: make the AI organisation actually perform the live workflow.

#### A1. Provider/runtime spike

- Install/configure OpenAI Agents SDK.
- Configure OpenRouter as the model provider.
- Validate one selected free/tool-capable model.
- Prove one tool call and one structured extraction through the selected path.
- If unreliable within the bounded spike, switch the orchestration layer to OpenRouter Agent SDK and continue.

Do not spend hackathon time debugging provider abstraction for its own sake.

#### A2. Manager agent

Implement Alex first.

Required responsibilities:

- inspect current workforce;
- classify incoming work;
- identify a missing capability;
- create an intern profile;
- assign work;
- request owner approval when policy requires it;
- monitor job status;
- issue promotion recommendations.

Initial tool surface:

- `getWorkforce`
- `createIntern`
- `assignJob`
- `getJob`
- `sendWhatsApp`
- `requestOwnerApproval`
- `promoteEmployee`
- `logAgentEvent`

#### A3. Agent factory

Create workers from application-level profiles.

A worker profile should supply:

- name;
- title;
- personality / communication style;
- capabilities;
- tool permissions;
- manager relationship;
- model selection.

Tool availability must be assigned by code/configuration, not invented by the LLM.

#### A4. Operations worker

Implement Shu Zhen.

Required flow:

- receive maintenance case;
- contact Tenant;
- ask concise diagnostic question(s);
- interpret Tenant reply;
- classify as plumbing maintenance;
- persist case updates;
- report contractor-sourcing capability need to Alex;
- update Tenant after contractor confirmation;
- verify completion with Tenant before closing case.

#### A5. Procurement worker

Implement Kai.

Required flow:

- receive contractor-sourcing assignment;
- select the 3 joined Contractor participants;
- send quote requests;
- associate inbound Contractor replies with the live job;
- extract price + availability from natural responses;
- persist structured quotes;
- rank viable options;
- return recommendation to Alex.

Quote ranking should be deterministic application logic rather than free-form LLM judgment:

1. reject options that miss the deadline;
2. prefer options within budget;
3. among equally viable options, prefer lower price;
4. preserve explicit data needed for Alex to explain the recommendation.

#### A6. Owner approval

Required commands for the hackathon:

- `APPROVE <job-id>`
- `REJECT <job-id>`

On approval:

- persist approval;
- confirm the selected Contractor;
- notify non-selected Contractors;
- notify Tenant;
- advance job state.

On rejection:

- no booking/confirmation may execute;
- persist rejection;
- return the case to an explicit waiting/re-sourcing state.

This rejection path is the required visible control/failure path for judging evidence.

#### A7. Completion and promotion

- selected Contractor can report `DONE`;
- Tenant must then confirm that the issue is fixed;
- only Tenant verification closes the case;
- success counters update atomically with case completion;
- promotion threshold check runs after completion;
- Alex asks for promotion approval;
- approved promotion changes Shu Zhen to permanent employee and emits `employee_promoted`.

### Lane B — Live Command Centre & Demo Theatre

Objective: make workforce creation, delegation, human coordination, and promotion immediately understandable and visually memorable.

#### B1. Visual system

Build a cohesive visual language before polishing individual screens.

Required direction:

- dark charcoal base;
- warm off-white typography;
- restrained olive status accents;
- brass/gold rank treatment;
- high-information but uncluttered cards;
- subtle military/strategy cues rather than literal military cosplay.

Rank insignia concept:

- `⌃` Intern
- `⌃⌃` Permanent Employee
- `⌃⌃⌃` Senior
- `◆` Lead
- `★` Manager

Only Intern, Permanent Employee, and Manager need implementation for the hackathon.

#### B2. Realtime org chart

Use React Flow.

Required behaviours:

- Alex visible at initial load;
- Shu Zhen animates into the hierarchy when created;
- Kai animates into the hierarchy when created;
- reporting relationships are visually obvious;
- current status is visible on each card;
- status changes react to Convex state in realtime.

Useful status states:

- IDLE
- THINKING
- USING TOOL
- WAITING ON HUMAN
- DELEGATING
- BLOCKED
- COMPLETE

#### B3. AI Operations Feed

Render `agentEvents` as timestamped structured telemetry.

Example:

```text
10:42:03  ALEX
New maintenance request received.

10:42:05  ALEX
No property-operations capability available.
Created Operations Intern: Shu Zhen.

10:42:26  SHU ZHEN
Tenant response received.
Issue classified: Plumbing.

10:42:27  ALEX
Contractor sourcing capability required.
Created Procurement Intern: Kai.
```

Do not render raw model chain-of-thought.

#### B4. Active job panel

Show at minimum:

- case title;
- Tenant callsign;
- current workflow state;
- budget;
- target deadline;
- assigned agents;
- pending human dependency;
- completion state.

#### B5. Contractor quote board

As live replies arrive, render three quote cards with:

- contractor callsign;
- price;
- availability;
- budget/deadline viability;
- final winner state.

The quote board should make the recommendation understandable before Alex asks for approval.

#### B6. Live participant lobby

Create a presentation-mode join screen showing:

- WhatsApp QR / join instructions;
- Tenant `0/1` -> `1/1`;
- Contractors `0/3` -> `3/3`;
- Business Owner ready state;
- `DEMO CREW READY` once all required roles exist.

Extra participants should not block the demo. Only the selected 1 Tenant and 3 Contractors participate in the workflow.

Never display real phone numbers.

#### B7. Promotion payoff

This is a deliberate visual climax.

On promotion:

- transition insignia from Intern to Permanent Employee;
- title changes from Operations Intern to Property Operations Executive;
- employment type changes to Permanent;
- org chart settles into the new structure;
- use restrained confetti / celebration animation;
- update relevant summary metrics.

This should feel polished enough to be memorable without becoming parody.

## 8. Integration checkpoints

Do not let the lanes diverge until the end of the event. Integrate at these checkpoints.

### Checkpoint 1 — Workforce creation

Runtime evidence:

- Tenant WhatsApp request reaches Alex;
- Alex creates Shu Zhen;
- `agent_created` event is persisted.

Command-centre evidence:

- participant lobby works;
- Alex is rendered;
- Shu Zhen appears from Convex state;
- operations feed renders the event.

Run the merged flow before continuing.

### Checkpoint 2 — Procurement and approval

Runtime evidence:

- 3 Contractor messages sent;
- natural replies extracted into quotes;
- deterministic ranking works;
- owner approval requested and processed.

Command-centre evidence:

- quote board updates live;
- agent statuses update;
- approval state is visible;
- selected option is clear.

Run the workflow through owner approval before continuing.

### Checkpoint 3 — Completion and promotion

Runtime evidence:

- Contractor reports completion;
- Tenant verifies fix;
- case closes;
- promotion recommendation executes;
- approved promotion persists.

Command-centre evidence:

- case visibly closes;
- promotion animation works;
- org chart reflects permanent employee state.

After this checkpoint, freeze feature scope.

## 9. Reliability and demo safeguards

### Participant safety / privacy

The join screen must state that this is a hackathon simulation and no real service or payment is being requested.

Do not display participants’ phone numbers publicly.

Provide an explicit demo-reset/delete operation to remove temporary participant mappings and live-demo quote data after the demo.

### Idempotency

Twilio webhooks can be retried. Persist/process the Twilio message identifier so duplicate inbound delivery cannot:

- create duplicate agents;
- create duplicate quotes;
- execute duplicate approvals;
- send duplicate contractor confirmations.

### Approval invariant

A contractor confirmation that commits spend must never be sent before the owner approval record is `approved`.

### Case closure invariant

A Contractor saying `DONE` is not enough to close the case. The Tenant must verify resolution.

### Agent creation invariant

Agent profile creation must persist successfully before the worker can receive assignments.

### No hidden autonomous spend

The LLM may recommend an action but cannot bypass the application-level spending policy.

## 10. Required tests and checks

Prioritise deterministic/high-risk logic over broad unit-test coverage.

### Automated tests

At minimum:

- quote parser extracts price and availability from representative natural replies;
- quote ranking rejects late options and respects budget preference;
- approval rejection prevents contractor confirmation;
- duplicate Twilio webhook does not duplicate state/actions;
- case cannot close before Tenant verification;
- promotion threshold triggers only after the required success count;
- role/tool permission mapping prevents an agent from receiving tools outside its configured capabilities.

### Manual end-to-end checks

Run on real phones before the live presentation:

1. join required participants;
2. Tenant sends issue;
3. Shu Zhen contacts Tenant;
4. 3 Contractors receive quote requests;
5. all 3 reply differently;
6. quotes populate command centre;
7. owner receives approval request;
8. test one rejection path and verify no contractor is booked;
9. reset;
10. run approval happy path;
11. selected Contractor receives confirmation;
12. Tenant receives update;
13. Contractor sends `DONE`;
14. Tenant confirms fix;
15. promotion executes;
16. command-centre state survives page refresh;
17. verify no secrets or phone numbers are exposed in the public UI/repository.

## 11. Scope exclusions

Do not implement these before the core demo is stable:

- Meta production WhatsApp Business onboarding;
- Gmail integration;
- Google Calendar integration;
- Stripe/payments;
- Auth0/CIBA;
- Exa search;
- Supabase;
- Hermes runtime;
- autonomous org-chart restructuring;
- automatic role splitting;
- deep semantic memory architecture;
- multi-company tenancy;
- production billing;
- production authentication;
- arbitrary recursive agent spawning;
- raw chain-of-thought display;
- full HR/admin functionality;
- sophisticated worker performance scoring.

## 12. Stretch goals — only after feature freeze criteria pass

In priority order:

1. Rename an employee through WhatsApp and persist the new identity.
2. Adjustable communication-style slider / preset.
3. More polished employee profile drawer with work history and permissions.
4. Procurement fallback that creates a sourcing intern only when no known contractors are viable.
5. Exa-backed contractor discovery if sponsor access is trivial and the core workflow is already reliable.
6. Additional rank levels / career progression.

Do not trade core reliability for stretch goals.

## 13. Demo presentation flow

A concise presentation should show, in order:

1. the SME problem: small-business owners become the operating system for recurring WhatsApp work;
2. the initial company with only Alex;
3. live audience roles joining;
4. Tenant sends an unscripted issue;
5. Alex identifies a capability gap and visibly creates Shu Zhen;
6. Shu Zhen interacts with the real Tenant;
7. Alex visibly creates Kai when procurement capability is needed;
8. Kai contacts 3 real Contractor participants;
9. unscripted quote replies appear live;
10. system explains the best viable option;
11. owner approves spend;
12. real humans receive resulting messages;
13. Contractor reports completion;
14. Tenant verifies outcome;
15. Shu Zhen is promoted into a permanent role;
16. close on the thesis: the business owner did not configure an agent graph — the organisation formed around the work.

## 14. Definition of done

The hackathon MVP is done when one clean live run proves all of the following:

> A real Tenant sends an unpredictable WhatsApp request; the AI Manager identifies missing organisational capability; AI workers are created and delegated visibly; the workers coordinate three real human Contractors; the system evaluates real responses; the Business Owner controls spend through an explicit approval boundary; real humans receive the resulting actions; the case closes only after verified outcome; persistent organisational state changes; and the evolving AI workforce is visible live in a polished command centre.

Once this works reliably, stop adding backend capability and spend remaining time on demo reliability, visual polish, README/submission materials, and rehearsal.
