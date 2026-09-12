> **Reference-only disclaimer for Army of Interns**
>
> This document was copied from another repository as general model-routing guidance. It contains Folio-specific language, examples, hardware observations, file references, and project assumptions. **Army of Interns is not related to Folio, does not depend on Folio, and should not treat Folio-specific statements below as project requirements.**
>
> For this repository, `IMPLEMENTATION_PLAN.md` and the current task prompt are authoritative. Use this file only as a reference when choosing a harness, model class, reasoning effort, or independent reviewer. References below to files such as `MODELS_ARSENAL.md` may refer to the source repository and may not exist here.

# Agent Model Selection

Lean routing guidance for choosing an AI harness, model class, and effort level for Folio engineering work.

For model-specific evidence, current roster notes, sentiment, fallbacks, and research links, see [`MODELS_ARSENAL.md`](MODELS_ARSENAL.md). Do **not** load that deeper file for routine work unless model choice is genuinely unclear or the routing guidance needs reevaluation.

Last routing review: **2026-09-02**.

## Routing order

Choose in this order:

1. **Role** — Planner / Architect, Prompter, Implementer, Integrator, Reviewer, or Promotion / Release.
2. **Harness** — use the surface that can actually access the required repo, branch/worktree, terminal, browser, database, secrets, or provider environment.
3. **Risk class** — Economy, Normal, Complex, or Critical.
4. **Independence** — use a different model family or surface for high-stakes review when practical.
5. **Effort** — raise reasoning effort only when the task needs it.

Model prestige is not a routing rule. Prefer the cheapest/fastest option that can safely complete and verify the assigned role.

## Risk classes

| Class | Use for | Routing intent |
|---|---|---|
| **Economy** | Bounded, reversible, easy-to-check work | Cheap/fast model or delegated subagent |
| **Normal** | Ordinary feature work, refactors, tests, API/UI work | Daily-driver model/router |
| **Complex** | Cross-contract work, hard debugging, long-horizon tasks, ambiguous integration | Strong explicit model or intelligence router |
| **Critical** | Auth/RLS, migrations, destructive state, concurrency/CAS/idempotency, payments, rollback, security-sensitive irreversible seams | Explicit premium primary/reviewer plus independent challenge when warranted |

Risk class reflects failure cost and ambiguity, not milestone importance.

## Harness map

| Harness | Best use | Important constraint |
|---|---|---|
| **ChatGPT + GitHub** | Planning, prompt generation, repo reasoning, static review | Inspection is not execution evidence |
| **Cursor** | Default local implementation, terminal/test loops, browser-capable work | Prefer Auto unless a named-model reason exists |
| **Codex** | Local implementation, terminal work, tests, sustained execution | Choose model/effort by task risk |
| **Claude Code** | Local implementation, long-context work, independent implementation/review | Useful model-family independence from OpenAI/Qwen/GLM |
| **Qoder** | Qwen/Kimi implementation and long-context alternatives | **Observed slow on the user's ARM64 computer. Avoid for time-sensitive write/run/fix loops or deadline-critical execution.** Use when model fit matters more than local latency. |
| **Kilo Code on Cursor/VS Code + OpenRouter** | Free/cheap OpenRouter models, delegated work, second opinions, alternative-family review | Free routes can be unstable and provider data policies differ; never expose secrets and keep sensitive repo work off unapproved routes |

When local latency matters, prefer Cursor/Codex/Claude Code over Qoder on the current ARM64 machine even if a Qwen/Kimi model is otherwise a good fit.

## Default routing

| Task shape | Strong defaults | Notes |
|---|---|---|
| Planner / architecture, normal | ChatGPT Medium; Terra High; Sonnet; GLM-5.3; Qwen3.8-Max | Planning does not require an execution harness unless repo actions are needed |
| Planner / architecture, Critical | Sol High or Opus High + independent challenger | Do not outsource the final irreversible decision to a cheap subagent |
| Prompter from approved plan | ChatGPT Medium | Do not re-plan or review |
| Economy implementation / delegated subtask | Auto Cost; Luna; GLM-5.3-Flash; Qwen3.8-Flash | Keep contracts crisp and verification cheap |
| Normal implementation | **Cursor Auto Balance**; Composer 2.5; Grok 4.6 Medium; Terra; Sonnet | Default to the local fast harness; use Qwen3.8-Flash/GLM-5.3-Flash when their harness is practical |
| Complex reversible implementation | **Cursor Auto Intelligence**; Grok 4.6 High; Terra High; Sonnet High; GLM-5.3; Qwen3.8-Max; Kimi K3 | Qoder options are poor for deadline-sensitive loops on current ARM64 hardware |
| Long-horizon agent task | Auto Intelligence; Grok 4.6 High; GLM-5.3; Qwen3.8-Max; Kimi K3 | Use `ACTIVE_TASK.md` when the work meets the long-horizon criteria; harness stability matters as much as model quality |
| Hard debugging / DevOps | Grok 4.6 High; Terra High; Sol High; GLM-5.3 | Prefer a fast execution harness with terminal access |
| Normal integration | Auto Balance; Composer; Grok; Terra; Sonnet | Test new seams/conflicts, not every historical lane |
| Complex integration | Auto Intelligence; Grok High; Terra High; Sonnet High; GLM-5.3 | Escalate to premium only when risk justifies it |
| Routine static review | ChatGPT Medium/High; GLM-5.3; Grok; Terra; Sonnet; Qwen3.8-Max | Prefer a different family from the implementer when independence is useful |
| High-risk review | **Sol High or Opus High**, preferably different from implementer | GLM-5.3 or Qwen3.8-Max can be an additional challenger, not a substitute for required execution evidence |
| Free non-sensitive second opinion | Kilo + Nemotron 3 Ultra or GLM-5.2-free | Opportunistic only; endpoint reliability/privacy can dominate model quality |
| Ultra-cheap bounded extraction/transformation | Kilo + Nemotron 3.5 Lightning | Not a primary coder or final verifier |

## Family shortcuts

Use these shortcuts instead of comparing every model on every task:

- **Cursor:** Auto Balance for Normal; Auto Intelligence for Complex; Auto Cost for Economy. Choose Composer/Grok/Terra/Sonnet explicitly when model-family behavior, repeatability, or a known strength matters.
- **Qwen on Qoder:** Qwen3.8-Flash for economical/normal work; Qwen3.8-Max for complex work. Qwen3.7-Plus and Qwen3.7-Max are fallbacks when the 3.8 route is unavailable or behaving poorly.
- **GLM through OpenRouter/Kilo or another supported harness:** GLM-5.3-Flash for economy/normal; GLM-5.3 for complex implementation or independent review. GLM-5.2-free is opportunistic only because the free route has shown instability.
- **Kimi:** Kimi K3 is a complex/long-horizon alternative, not a universal default. Current Qoder latency limits its use for urgent local loops.
- **NVIDIA Nemotron through Kilo/OpenRouter:** Ultra is a specialist/challenger; 3.5 Lightning is a high-throughput bounded worker. Do not promote Lightning to primary implementation based on speed alone.
- **OpenAI / Anthropic ceiling:** Sol or Opus for Critical work, independent high-stakes review, or when normal-tier models have produced repeated rework.

See [`MODELS_ARSENAL.md`](MODELS_ARSENAL.md) before changing these shortcuts.

## Named-model rules that remain important

- **Composer 2.5** is a legitimate general-purpose primary implementer, not merely a mechanical editor.
- **Grok 4.6** is a legitimate normal/complex implementation and investigation model. Medium is a practical bounded-work default; High for sustained reasoning or higher failure cost; xHigh only for a specific need.
- **Luna** is a bounded-work/subagent model.
- **Terra** is a general engineering workhorse; Medium for focused work, High for broader reversible work.
- **Sonnet** is a strong peer for general implementation and cross-contract reasoning.
- **Sol / Opus** are explicit premium choices for concrete risk or independence reasons, not ceremonial escalation.

## Independent review

High-stakes review should be independent when practical:

- do not let a model family be the sole implementer and sole reviewer of its own Critical change;
- prefer a different family or surface to reduce correlated blind spots;
- review code/contracts and existing evidence first;
- run additional tests only for concrete unresolved questions.

A different model does not replace required runtime, DB/RLS, browser, or release evidence.

## Subagents

Implementation prompts should preserve this instruction:

> Delegate well-defined bounded tasks to cheaper subagents where useful. Keep architecture, integration decisions, high-risk changes, and final verification with the primary model.

Good delegated work includes targeted research, extraction, fixtures/tests with stable contracts, repetitive transformations, isolated UI pieces, and documentation cleanup.

Do not delegate ambiguous architecture or Critical persistence/security decisions merely because a free model is available.

## Effort guidance

Recommend model and effort **separately from the execution prompt**.

- **Low / Medium:** bounded, clear, easily verified work.
- **Medium / High:** normal feature work with meaningful judgement.
- **High:** complex cross-contract reasoning, hard debugging, integration, or high-risk review.
- **xHigh / Max / ceiling:** only after a specific need is identified.

Cursor Auto modes already encode part of this tradeoff; do not manually over-route when Auto is sufficient.

## Privacy, reliability, and free routes

- Never send secrets, credentials, `.env` contents, private keys, or unnecessary personal data to any model.
- OpenRouter data handling is provider-specific. For proprietary code, require an acceptable provider/privacy route; use provider routing controls such as data-collection restrictions where supported.
- Treat **NVIDIA free routes as non-sensitive-only unless the current provider policy is explicitly verified otherwise**.
- Treat **GLM-5.2-free as opportunistic**; observed OpenRouter availability/rate-limit instability makes it unsuitable for a critical path.
- Free availability, provider routing, limits, pricing, context windows, and data policies change. Re-check current documentation when they materially affect the task.

## How routing evolves

Do not run a formal model bakeoff unless explicitly requested. Update routing from normal project evidence: first-pass correctness, rework, scope creep, verification quality, wall-clock time, quota/cost, and required human steering.

A benchmark can justify trying a model. Verified Folio outcomes decide whether it keeps the slot.
