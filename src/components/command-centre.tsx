"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import confetti from "canvas-confetti";
import { AnimatePresence, motion } from "motion/react";
import { Check, Clock3, Expand, Flag, Radio, ShieldCheck, UsersRound } from "lucide-react";
import { OrgChart } from "./org-chart";
import { type CommandCentreState, type QuoteView } from "@/lib/command-centre-types";

const TENANT_JOIN = "https://t.me/army_of_intern_demo_bot?start=tenant";
const CONTRACTOR_JOIN = "https://t.me/army_of_intern_demo_bot?start=contractor";

const time = (timestamp: number) =>
  new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(timestamp);

const countLabel = (joined: number, required: number) => `${Math.min(joined, required)}/${required}`;

const qrSrc = (url: string) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(url)}`;

function money(amount?: number) {
  return typeof amount === "number" ? `S$${amount}` : "—";
}

function QuoteCard({ quote }: { quote: QuoteView }) {
  const viable = quote.viable ?? Boolean(quote.meetsDeadline && quote.withinBudget);
  return (
    <article className={`quote-card ${quote.selected ? "quote-card--selected" : ""}`}>
      <div>
        <span className="eyebrow">{quote.contractorCallsign}</span>
        {quote.selected && <span className="winner">Recommended</span>}
      </div>
      <strong>{quote.price ? money(quote.price) : "Awaiting reply"}</strong>
      <p>{quote.availability}</p>
      <div className="quote-card__checks">
        <span className={quote.withinBudget ? "pass" : "fail"}>
          {quote.withinBudget ? "Budget fit" : "Over budget"}
        </span>
        <span className={quote.meetsDeadline ? "pass" : "fail"}>
          {quote.meetsDeadline ? "Deadline fit" : "Late"}
        </span>
      </div>
      {quote.selected && quote.recommendation && <small>{quote.recommendation}</small>}
      {viable === false && <small className="muted">Not viable</small>}
    </article>
  );
}

export function CommandCentre({
  initialState,
  headerActions,
}: {
  initialState: CommandCentreState;
  headerActions?: ReactNode;
}) {
  const [presentation, setPresentation] = useState(false);
  const [promotionFired, setPromotionFired] = useState(false);
  // The parent may be backed by a Convex reactive query. Never cache this
  // value locally: a new worker/status/approval must render immediately.
  const state = initialState;
  const promotedWorker = useMemo(
    () =>
      state.workers.find(
        (worker) => worker.employmentType === "permanent" && worker.id !== "alex" && worker.name !== "Alex",
      ),
    [state.workers],
  );

  useEffect(() => {
    if (!promotedWorker) {
      setPromotionFired(false);
      return;
    }
    if (promotionFired) {
      return;
    }
    confetti({ particleCount: 55, spread: 52, origin: { y: 0.25 }, colors: ["#b69a5e", "#d9d3c5", "#6e7756"] });
    setPromotionFired(true);
  }, [promotedWorker, promotionFired]);

  const ready =
    state.participants.ownerReady &&
    state.participants.tenant.joined >= state.participants.tenant.required &&
    state.participants.contractors.joined >= state.participants.contractors.required;
  const work = state.workItem;
  const assignedNames =
    work?.assignedWorkerIds
      .map((id) => state.workers.find((worker) => worker.id === id)?.name ?? id)
      .join(", ") ?? "";
  const approvalStatus = state.approval?.status;
  const approvalLabel =
    approvalStatus === "pending"
      ? "Decision required"
      : approvalStatus === "rejected"
        ? "Rejected"
        : (approvalStatus ?? "Not required");

  return (
    <main className={presentation ? "command-centre presentation" : "command-centre"}>
      <header className="topbar">
        <div>
          <p className="eyebrow">
            <Radio size={12} /> Live workspace
          </p>
          <h1>Army of Interns</h1>
        </div>
        <div className="topbar__right">
          {headerActions}
          <span className="live-pill">
            <i /> Convex live
          </span>
          <button
            className="icon-button"
            aria-label="Toggle presentation mode"
            onClick={() => setPresentation(!presentation)}
          >
            <Expand size={17} />
          </button>
        </div>
      </header>
      <section className="hero">
        <div>
          <p className="eyebrow">Adaptive AI workforce</p>
          <h2>
            Your first AI employee
            <br />
            <em>hires the rest.</em>
          </h2>
        </div>
        <div className="metrics">
          <div>
            <span>Workforce</span>
            <strong>{state.workers.length}</strong>
          </div>
          <div>
            <span>Active case</span>
            <strong>{work ? "01" : "00"}</strong>
          </div>
          <div>
            <span>Human dependencies</span>
            <strong>{work?.waitingOn ? "01" : "00"}</strong>
          </div>
        </div>
      </section>
      <section className="grid-main">
        <div className="panel org-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Organisation</p>
              <h2>Workforce topology</h2>
            </div>
            <span className="subtle">Reporting lines are live</span>
          </div>
          <OrgChart workers={state.workers} />
        </div>
        <aside className="panel lobby">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Participation</p>
              <h2>Demo crew</h2>
            </div>
            <UsersRound size={18} />
          </div>
          <p className="lobby-instruction">
            Join via Telegram using the venue QR. Owner Tim is registered separately. This is a
            hackathon simulation; no service or payment is requested.
          </p>
          <div className="qr-pair">
            <a className="qr-join" href={TENANT_JOIN} target="_blank" rel="noreferrer">
              <img alt="Tenant Telegram join QR" src={qrSrc(TENANT_JOIN)} width={140} height={140} />
              <span>Tenant</span>
            </a>
            <a className="qr-join" href={CONTRACTOR_JOIN} target="_blank" rel="noreferrer">
              <img alt="Contractor Telegram join QR" src={qrSrc(CONTRACTOR_JOIN)} width={140} height={140} />
              <span>Contractors A/B/C</span>
            </a>
          </div>
          <div className="role-row">
            <span>Business Owner</span>
            <b className={state.participants.ownerReady ? "ready" : ""}>
              {state.participants.ownerReady ? "Ready" : "Waiting"}
            </b>
          </div>
          <div className="role-row">
            <span>Tenant</span>
            <b>{countLabel(state.participants.tenant.joined, state.participants.tenant.required)}</b>
          </div>
          <div className="role-row">
            <span>Contractors</span>
            <b>
              {countLabel(state.participants.contractors.joined, state.participants.contractors.required)}
            </b>
          </div>
          <div className={ready ? "crew-ready" : "crew-pending"}>
            {ready ? (
              <>
                <Check size={16} /> Demo crew ready
              </>
            ) : (
              "Awaiting participants"
            )}
          </div>
        </aside>
      </section>
      <section className="grid-lower">
        <div className="panel case-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Active work</p>
              <h2>{work?.title ?? "No active work"}</h2>
            </div>
            <span className="case-status">{work?.status}</span>
          </div>
          {work && (
            <div className="case-details">
              <div>
                <span>Tenant</span>
                <strong>{work.tenantCallsign}</strong>
              </div>
              <div>
                <span>Budget</span>
                <strong>{money(work.budget)}</strong>
              </div>
              <div>
                <span>Deadline</span>
                <strong>{work.deadline}</strong>
              </div>
              <div>
                <span>Waiting on</span>
                <strong>{work.waitingOn ?? "—"}</strong>
              </div>
              <div>
                <span>Assigned</span>
                <strong>{assignedNames || "—"}</strong>
              </div>
              <div>
                <span>Verified</span>
                <strong>{work.completionVerified ? "Yes" : "No"}</strong>
              </div>
            </div>
          )}
          <div className={`approval${approvalStatus === "rejected" ? " approval--rejected" : ""}`}>
            <ShieldCheck size={19} />
            <div>
              <span>Owner approval</span>
              <strong>{approvalLabel}</strong>
              <small>{state.approval?.action}</small>
            </div>
          </div>
        </div>
        <div className="panel quote-board">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Scenario responses</p>
              <h2>Contractor quotes</h2>
            </div>
            <Flag size={18} />
          </div>
          <div className="quote-list">
            {state.quotes.map((quote) => (
              <QuoteCard key={quote.id} quote={quote} />
            ))}
          </div>
        </div>
        <div className="panel feed">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Structured telemetry</p>
              <h2>Activity</h2>
            </div>
            <Clock3 size={18} />
          </div>
          <div className="event-list">
            <AnimatePresence initial={false}>
              {state.events.slice().sort((a, b) => b.timestamp - a.timestamp).map((event) => {
                const worker = state.workers.find((item) => item.id === event.workerId);
                return (
                  <motion.article
                    key={event.id}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="event"
                  >
                    <time>{time(event.timestamp)}</time>
                    <div>
                      <span>{worker?.name ?? "System"}</span>
                      <p>{event.summary}</p>
                      {event.detail && <small>{event.detail}</small>}
                    </div>
                  </motion.article>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </section>
      {promotedWorker && (
        <div className="promotion-toast">
          <span className="employment-chip employment-chip--permanent">Permanent</span>
          <div>
            <b>{promotedWorker.name} promoted</b>
            <small>
              {promotedWorker.title} · Permanent
            </small>
          </div>
        </div>
      )}
    </main>
  );
}
