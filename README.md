# Army of Interns

Shared Milestone S1 establishes a single Next.js + TypeScript application, a Convex
schema, and generic workforce contracts. It intentionally contains no agent runtime,
messaging integration, scenario adapter, or command-centre implementation.

## Local setup

Requirements: Node.js 20.9 or newer and npm.

```powershell
npm install
$env:CONVEX_AGENT_MODE = "anonymous"
npx convex dev
```

Leave Convex running, then use a second terminal:

```powershell
npm run verify:convex
npm run dev
```

Convex writes local deployment settings to `.env.local`; all `.env*` files are ignored
except a credential-free `.env.example` if one is added later. Never commit deployment
credentials or provider keys.

## Shared public Convex boundary

| Function | Kind | Purpose |
| --- | --- | --- |
| `seed:bootstrapDemo` | mutation | Idempotently persist the demo owner, company, and permanent manager Alex |
| `companyProfiles:get` | query | Read the S1 company profile |
| `workers:list` | query | Read up to 100 workers |
| `workItems:list` | query | Read up to 100 work items |
| `events:list` | query | Read the 100 most recent structured events |
| `events:create` | mutation | Append one validated structured event |

The bounded list APIs are sufficient for S1. Pagination, authentication, realtime UI,
runtime logic, and scenario-specific records belong to later milestones.

These S1 functions are intentionally unauthenticated for local development. Do not
expose this deployment publicly; authentication and authorization must be added before
any production or sensitive data is introduced.

## Verification

```powershell
npm run typecheck
npm test
# Run while `npx convex dev` is active.
npm run verify:convex
npm run build
```
