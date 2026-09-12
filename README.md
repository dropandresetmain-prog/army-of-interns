# Army of Interns

Shared milestones build a generic adaptive AI workforce demo. **S3** adds the
generic workforce kernel on top of the S1 contracts and S2 messaging spine.

## Local setup

Requirements: Node.js 20.9 or newer and npm.

```powershell
npm install
npx convex dev
```

Leave Convex running, then use a second terminal:

```powershell
npm run verify:convex
npm run verify:s2
npm run verify:s3
npm run dev
```

Convex writes local deployment settings to `.env.local`; all `.env*` files are
ignored except the credential-free `.env.example`. Never commit deployment
credentials or Twilio keys.

## S3 — Generic Workforce Kernel

Pipeline (scenario-independent):

```text
natural request
→ WorkItem
→ required capabilities (controlled vocabulary)
→ workforce lookup
→ existing worker reuse OR WorkerSpec
→ persisted worker
→ assignment
→ structured events
→ realtime UI
```

Smoke cases use the same `workforce:intakeAndStaff` entrypoint:

- `The toilet in Room 3 is leaking.` → `maintenance_triage` + `stakeholder_messaging`
- `Prepare our Instagram posts for next week.` → `content_marketing`

A second request for an existing capability set reuses the persisted worker.

## Shared public Convex boundary

| Function | Kind | Purpose |
| --- | --- | --- |
| `seed:bootstrapDemo` | mutation | Idempotently persist demo owner, company, Alex, capabilities |
| `companyProfiles:get` | query | Read the company profile |
| `workers:list` | query | Read up to 100 workers |
| `workers:createRealtimeProbe` | mutation | S2 realtime worker insert |
| `workItems:list` | query | Read up to 100 work items |
| `assignments:list` | query | Read up to 100 assignments |
| `capabilities:list` | query | Read controlled capability catalog rows |
| `workforce:intakeAndStaff` | mutation | S3 kernel: intake → match/create → assign |
| `workforce:getWorkItemDetail` | query | Work item + assignments + events + workers |
| `events:list` / `events:create` | query / mutation | Structured events |
| `messaging:listRecent` | query | Public message feed (no phone numbers) |
| `messaging:simulateInbound` | mutation | Local inbound simulation / idempotency checks |
| `messaging:insertRealtimeProbe` | mutation | S2 realtime event insert |
| `messagingOutbound:sendWhatsApp` | action | Outbound WhatsApp via Twilio adapter |
| `messagingOutbound:sendTestWhatsApp` | action | Fixed S2 test send |
| `POST /twilio/whatsapp` | HTTP action | Twilio inbound webhook |

These functions are intentionally unauthenticated for local development. Do not
expose a deployment with real participant data publicly without auth.

## Verification

```powershell
npm run typecheck
npm test
# Run while `npx convex dev` is active.
npm run verify:convex
npm run verify:s2
npm run verify:s3
npm run build
```
