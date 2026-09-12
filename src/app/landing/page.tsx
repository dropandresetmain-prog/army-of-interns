import type { Metadata } from "next";

import styles from "./landing.module.css";

/**
 * Static marketing page. Deliberately has no Convex dependency so that a copy
 * change can never break the live workspace, and the workspace can evolve
 * without touching this route.
 *
 * Point WORKSPACE_HREF at the live dashboard route once it exists.
 */
const WORKSPACE_HREF = "/";
const REPO_HREF = "https://github.com/dropandresetmain-prog/army-of-interns";

export const metadata: Metadata = {
  title: "Army of Interns — Your first AI employee hires the rest",
  description:
    "An adaptive AI workforce for small businesses. Send work from the messaging app you already use; the AI manager works out which capabilities are needed, staffs them, executes through bounded tools, and verifies the outcome.",
  openGraph: {
    title: "Army of Interns — Your first AI employee hires the rest",
    description:
      "You do not design your AI organisation. You give your AI manager work, and the organisation forms around the work your business actually needs.",
    type: "website",
  },
};

const PROBLEMS = [
  {
    title: "Work arrives as messages",
    body:
      "A tenant reports a leak. A customer asks for a quote. A supplier goes quiet. None of it arrives as a ticket — it arrives as a chat message, at 9pm, in the same thread as everything else.",
  },
  {
    title: "You are the router",
    body:
      "Someone has to read it, work out what it really is, decide who should handle it, chase the reply, and check it was actually done. In a small business, that someone is the owner.",
  },
  {
    title: "Advice is not the bottleneck",
    body:
      "You already know a leaking toilet needs a plumber. What you do not have is the hour it takes to source three quotes, compare them, book one, and confirm the tenant is happy.",
  },
];

type LoopStep = {
  title: string;
  body: string;
  branch?: Array<{ key: string; body: string }>;
};

const LOOP: LoopStep[] = [
  {
    title: "Work arrives",
    body:
      "Someone messages the business in the app they already use. No portal, no form, no new habit to learn.",
  },
  {
    title: "The request becomes a work item",
    body:
      "The manager extracts the objective, the context, the constraints, and — critically — what would count as success.",
  },
  {
    title: "Required capabilities are identified",
    body:
      "Not a job title, a capability: maintenance triage, vendor sourcing, option evaluation, stakeholder messaging, bookkeeping, content marketing.",
  },
  {
    title: "The current workforce is inspected",
    body:
      "The manager checks who it already employs before it considers hiring anyone.",
    branch: [
      {
        key: "Match",
        body: "A suitable worker already exists. Assign the work and keep the team small.",
      },
      {
        key: "Gap",
        body: "No one has the capability. Generate a worker spec and hire a temporary intern for it.",
      },
    ],
  },
  {
    title: "The worker executes through permitted tools only",
    body:
      "Each worker holds an explicit set of tool permissions. Work outside that envelope is escalated rather than improvised, so no single agent quietly becomes responsible for everything.",
    branch: [
      {
        key: "Needs a capability",
        body: "The worker requests staffing instead of expanding its own role.",
      },
      {
        key: "Needs authority",
        body: "The worker requests owner approval instead of committing spend.",
      },
    ],
  },
  {
    title: "The outcome is verified",
    body:
      "Work closes when the person who asked confirms it is actually done — not when an agent reports that it tried.",
  },
  {
    title: "The result is recorded",
    body:
      "Success, failure, and repeat capability demand all become durable history, so the company learns which work it keeps needing.",
  },
  {
    title: "The organisation evolves",
    body:
      "An intern used successfully often enough becomes a retention recommendation. You approve the hire; the org chart changes.",
  },
];

const INVARIANTS = [
  {
    title: "Nothing commits spend without you",
    body:
      "Money-committing actions stop at an explicit owner approval. No approval, no confirmation to the vendor — the rule lives in the engine, not in a prompt.",
  },
  {
    title: "Done means verified",
    body:
      "Every work item carries success criteria, and closure requires confirmation from the person who raised it.",
  },
  {
    title: "Permissions are explicit",
    body:
      "Workers hold named tool permissions. Capability and authority limits are enforced, not suggested.",
  },
  {
    title: "Employees outlive models",
    body:
      "A worker is application state — name, title, rank, reporting line, capabilities, permissions, history. Swap the underlying model and the employee is still there.",
  },
  {
    title: "Decisions, not token streams",
    body:
      "Meaningful actions emit structured events, so the workspace shows you what was decided and why, without exposing raw internal reasoning.",
  },
  {
    title: "No scenario hardcoded in the core",
    body:
      "The kernel knows about work items, capabilities, workers, tools, approvals and outcomes. It does not know what a plumber is.",
  },
];

type EmploymentChip = "intern" | "permanent" | null;

const RANKS: Array<{ chip: EmploymentChip; title: string; body: string }> = [
  {
    chip: "intern",
    title: "Intern",
    body:
      "Temporary by default. Created the moment a capability is missing, with only the permissions that capability needs.",
  },
  {
    chip: "permanent",
    title: "Permanent employee",
    body:
      "Earned, not configured. Repeated verified success crosses a retention threshold and the manager recommends keeping them.",
  },
  {
    chip: null,
    title: "Manager",
    body:
      "Holds the staffing authority: reads incoming work, inspects the workforce, hires, delegates, and escalates to you.",
  },
];

export default function LandingPage() {
  return (
    <main className={styles.page}>
      <div className={styles.backdrop} aria-hidden="true" />
      <div className={styles.grid} aria-hidden="true" />

      <nav className={styles.nav} aria-label="Primary">
        <a className={styles.wordmark} href="#top">
          Army of Interns
        </a>
        <ul className={styles.navLinks}>
          <li>
            <a className={styles.navLink} href="#how-it-works">
              How it works
            </a>
          </li>
          <li>
            <a className={styles.navLink} href="#same-engine">
              Same engine
            </a>
          </li>
          <li>
            <a className={styles.navLink} href="#guardrails">
              Guardrails
            </a>
          </li>
          <li>
            <a className={styles.navLink} href={REPO_HREF}>
              GitHub
            </a>
          </li>
        </ul>
      </nav>

      <section className={styles.hero} id="top">
        <span className={styles.eyebrow}>An adaptive AI workforce for small business</span>
        <h1 className={styles.h1}>
          Your first AI employee <em>hires the rest</em>
        </h1>
        <p className={styles.heroLede}>
          You do not sit down and design an AI organisation. You hand your AI manager
          the work your business actually gets — a leaking toilet, an overdue invoice,
          next week&rsquo;s posts — and the organisation forms around it. Capabilities are
          identified, workers are reused or hired, real people get messaged, and nothing
          closes until the outcome is verified.
        </p>
        <div className={styles.ctaRow}>
          <a className={styles.btnPrimary} href={WORKSPACE_HREF}>
            Open the workspace
          </a>
          <a className={styles.btnGhost} href="#how-it-works">
            See how it works
          </a>
        </div>

        <ul className={styles.heroFacts}>
          <li>
            <span className={styles.factLabel}>You say</span>
            <span className={styles.factValue}>&ldquo;Handle this.&rdquo;</span>
          </li>
          <li>
            <span className={styles.factLabel}>Where</span>
            <span className={styles.factValue}>WhatsApp, Telegram, or whichever app you already use</span>
          </li>
          <li>
            <span className={styles.factLabel}>You keep</span>
            <span className={styles.factValue}>Approval over anything that spends money</span>
          </li>
          <li>
            <span className={styles.factLabel}>You get</span>
            <span className={styles.factValue}>A verified outcome, and an org chart that grew</span>
          </li>
        </ul>
      </section>

      <section className={`${styles.section} ${styles.sectionDivider}`}>
        <span className={styles.eyebrow}>The problem</span>
        <h2 className={styles.h2}>You are your company&rsquo;s operating system</h2>
        <p className={styles.lede}>
          Small businesses do not run on software. They run on the owner reading every
          message and deciding what happens next. That is the job we are taking over —
          not the advice, the coordination.
        </p>
        <ul className={styles.cardGrid}>
          {PROBLEMS.map((item) => (
            <li className={styles.card} key={item.title}>
              <div className={styles.cardRule} aria-hidden="true" />
              <h3 className={styles.cardTitle}>{item.title}</h3>
              <p className={styles.cardBody}>{item.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={`${styles.section} ${styles.sectionDivider}`} id="how-it-works">
        <span className={styles.eyebrow}>How it works</span>
        <h2 className={styles.h2}>The manager does not follow a workflow. It staffs one.</h2>
        <p className={styles.lede}>
          There is one loop, and every request runs through it — whether it is a
          blocked drain or a quarter of bookkeeping. The loop is what makes the
          workforce adaptive instead of merely automated.
        </p>

        <ol className={styles.flow}>
          {LOOP.map((step, index) => (
            <li className={styles.step} key={step.title}>
              <span className={styles.stepNum} aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={styles.stepBody}>{step.body}</p>
              {step.branch ? (
                <ul className={styles.branch}>
                  {step.branch.map((fork) => (
                    <li key={fork.key}>
                      <span className={styles.branchKey}>{fork.key}</span>
                      {fork.body}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      <section className={`${styles.section} ${styles.sectionDivider}`} id="same-engine">
        <span className={styles.eyebrow}>The same engine</span>
        <h2 className={styles.h2}>Change the request, and a different company forms</h2>
        <p className={styles.lede}>
          Both of these go through one entrypoint. There is no branch in the core that
          asks what kind of business this is — the capabilities differ, so the staffing
          differs.
        </p>

        <div className={styles.proof}>
          <div className={styles.proofCol}>
            <p className={styles.quote}>&ldquo;The toilet in Room 3 is leaking.&rdquo;</p>
            <p className={styles.quoteWho}>Sent by a tenant, unprompted</p>
            <div className={styles.proofRow}>
              <span className={styles.proofLabel}>Capabilities</span>
              <ul className={styles.tagRow}>
                <li>maintenance_triage</li>
                <li>stakeholder_messaging</li>
              </ul>
            </div>
            <div className={styles.proofRow}>
              <span className={styles.proofLabel}>Staffing</span>
              <span className={styles.proofOut}>
                An operations intern is hired, then requests a second intern for vendor
                sourcing once it discovers it needs contractors.
              </span>
            </div>
          </div>

          <div className={styles.proofSpine} aria-hidden="true">
            <span className={styles.proofSpineLine} />
            <span className={styles.proofEntry}>one entrypoint</span>
            <span className={styles.proofSpineLine} />
          </div>

          <div className={styles.proofCol}>
            <p className={styles.quote}>&ldquo;Prepare our Instagram posts for next week.&rdquo;</p>
            <p className={styles.quoteWho}>Sent by the owner, same thread</p>
            <div className={styles.proofRow}>
              <span className={styles.proofLabel}>Capabilities</span>
              <ul className={styles.tagRow}>
                <li>content_marketing</li>
              </ul>
            </div>
            <div className={styles.proofRow}>
              <span className={styles.proofLabel}>Staffing</span>
              <span className={styles.proofOut}>
                A different worker spec entirely — and no orchestration code changed to
                make that happen.
              </span>
            </div>
          </div>
        </div>

        <p className={styles.proofFoot}>
          This is the part that matters. A demo can fake one impressive workflow. An
          engine has to produce a sensible organisation for work nobody wrote code for.
        </p>
      </section>

      <section className={`${styles.section} ${styles.sectionDivider}`} id="guardrails">
        <span className={styles.eyebrow}>Guardrails</span>
        <h2 className={styles.h2}>Why this is a workforce and not a chatbot</h2>
        <p className={styles.lede}>
          Autonomy is only useful if its limits are real. These are enforced in the
          engine, where a persuasive message cannot talk its way past them.
        </p>
        <ul className={styles.cardGrid}>
          {INVARIANTS.map((item) => (
            <li className={styles.card} key={item.title}>
              <div className={styles.cardRule} aria-hidden="true" />
              <h3 className={styles.cardTitle}>{item.title}</h3>
              <p className={styles.cardBody}>{item.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={`${styles.section} ${styles.sectionDivider}`}>
        <span className={styles.eyebrow}>Careers</span>
        <h2 className={styles.h2}>Interns are temporary. Some of them earn a job.</h2>
        <p className={styles.lede}>
          A worker hired for one leak does not linger forever by default. It has to be
          useful more than once, on verified outcomes, before the manager recommends
          keeping it — and you make the call.
        </p>
        <ul className={styles.ladder}>
          {RANKS.map((rank) => (
            <li className={styles.rank} key={rank.title}>
              {rank.chip ? (
                <span className={styles.rankChip}>
                  {rank.chip === "intern" ? (
                    <span className="employment-chip employment-chip--intern">Intern</span>
                  ) : (
                    <span className="employment-chip employment-chip--permanent">Permanent</span>
                  )}
                </span>
              ) : null}
              <h3 className={styles.cardTitle}>{rank.title}</h3>
              <p className={styles.cardBody}>{rank.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={`${styles.section} ${styles.sectionDivider}`}>
        <span className={styles.eyebrow}>Where it lives</span>
        <h2 className={styles.h2}>It works where the work already is</h2>
        <p className={styles.lede}>
          Your tenants, customers and contractors will not log into a dashboard, and
          they should not have to. Work comes in and goes out through your preferred
          messaging app — the same thread, the same habits. The dashboard is for you,
          so you can watch the organisation think.
        </p>
        <ul className={styles.surfaceRow}>
          <li>WhatsApp</li>
          <li>Telegram</li>
          <li>Your preferred messaging app</li>
        </ul>
      </section>

      <section className={styles.section}>
        <div className={styles.ctaPanel}>
          <span className={styles.eyebrow}>See it run</span>
          <h2 className={styles.h2}>Watch an organisation hire itself, live</h2>
          <p className={styles.lede}>
            The workspace shows the whole thing as it happens: work arriving,
            capabilities identified, interns created, real humans messaged, your
            approval requested, the outcome verified, and the org chart changing when
            somebody earns a promotion.
          </p>
          <div className={styles.ctaRow}>
            <a className={styles.btnPrimary} href={WORKSPACE_HREF}>
              Open the workspace
            </a>
            <a className={styles.btnGhost} href={REPO_HREF}>
              Read the architecture
            </a>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <span>Army of Interns — built for the Agents Everywhere hackathon</span>
        <ul className={styles.footerLinks}>
          <li>
            <a className={styles.footerLink} href={WORKSPACE_HREF}>
              Workspace
            </a>
          </li>
          <li>
            <a className={styles.footerLink} href={REPO_HREF}>
              GitHub
            </a>
          </li>
        </ul>
      </footer>
    </main>
  );
}
