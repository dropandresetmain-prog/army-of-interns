# Army of Interns

Shared milestones build a generic adaptive AI workforce demo. **S2** proves the
messaging and realtime transport spine on top of the S1 contracts.

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
npm run dev
```

Convex writes local deployment settings to `.env.local`; all `.env*` files are
ignored except the credential-free `.env.example`. Never commit deployment
credentials or Twilio keys.

## S2 — Messaging & Realtime Spine

Transport paths:

```text
WhatsApp -> Twilio -> Convex HTTP `/twilio/whatsapp`
Convex action -> Twilio REST -> WhatsApp
Convex queries -> reactive Next.js UI
```

### Twilio environment (Convex deployment)

Set these on the **Convex** deployment (not only in a local shell):

```powershell
npx convex env set TWILIO_ACCOUNT_SID ACxxxxxxxx
npx convex env set TWILIO_AUTH_TOKEN your_auth_token
npx convex env set TWILIO_WHATSAPP_FROM "whatsapp:+14155238886"
npx convex env set TWILIO_TEST_TO "whatsapp:+15551234567"
```

Webhook URL (cloud deployment example):

```text
https://<deployment>.convex.site/twilio/whatsapp
```

For a local anonymous deployment, `NEXT_PUBLIC_CONVEX_SITE_URL` points at the
local Convex site port. Twilio Sandbox needs a publicly reachable URL (cloud
Convex site URL or a tunnel to that site URL).

### Manual proofs

1. **Inbound:** send `hello` from a joined WhatsApp Sandbox phone → webhook →
   message appears in the S2 UI without refresh.
2. **Outbound:** `npx convex run messagingOutbound:sendTestWhatsApp` → phone
   receives `Army of Interns test 🫡`.
3. **Realtime:** use **Insert event** / **Insert worker** on the home page →
   lists update without refresh.
4. **Idempotency:** replay the same Twilio `MessageSid` → one stored message,
   no second event.

Phone numbers are stored for correlation only and are omitted from public
message queries / UI.

## Shared public Convex boundary

| Function | Kind | Purpose |
| --- | --- | --- |
| `seed:bootstrapDemo` | mutation | Idempotently persist demo owner, company, and Alex |
| `companyProfiles:get` | query | Read the company profile |
| `workers:list` | query | Read up to 100 workers |
| `workers:createRealtimeProbe` | mutation | S2 realtime worker insert |
| `workItems:list` | query | Read up to 100 work items |
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
npm run build
```
