"use client";

import { useMutation, useQuery } from "convex/react";
import { useState, useTransition } from "react";

import { api } from "../../convex/_generated/api";

const MAINTENANCE_REQUEST = "The toilet in Room 3 is leaking.";
const MARKETING_REQUEST = "Prepare our Instagram posts for next week.";

export default function Home() {
  const workers = useQuery(api.workers.list);
  const workItems = useQuery(api.workItems.list);
  const assignments = useQuery(api.assignments.list);
  const capabilities = useQuery(api.capabilities.list);
  const events = useQuery(api.events.list);
  const messages = useQuery(api.messaging.listRecent);
  const intakeAndStaff = useMutation(api.workforce.intakeAndStaff);
  const bootstrapDemo = useMutation(api.seed.bootstrapDemo);
  const [status, setStatus] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  const capabilityNameById = new Map(
    (capabilities ?? []).map((capability) => [capability._id, capability.key]),
  );

  function runRequest(text: string, label: string) {
    startTransition(async () => {
      await bootstrapDemo({});
      const result = await intakeAndStaff({ text });
      setStatus(
        `${label}: ${result.staffingKind} worker ${result.workerId} · caps ${result.requiredCapabilityKeys.join(", ")}`,
      );
    });
  }

  return (
    <main className="spine">
      <header>
        <h1>Army of Interns</h1>
        <p className="lede">
          S3 generic workforce kernel — natural request to work item, capability
          match, worker reuse or creation, assignment, and events. Same pipeline
          for every request shape.
        </p>
      </header>

      <section className="actions" aria-label="Workforce kernel probes">
        <button
          type="button"
          disabled={isPending}
          onClick={() => runRequest(MAINTENANCE_REQUEST, "Maintenance")}
        >
          Submit maintenance request
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => runRequest(MAINTENANCE_REQUEST, "Maintenance reuse")}
        >
          Resubmit maintenance (reuse)
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => runRequest(MARKETING_REQUEST, "Marketing")}
        >
          Submit marketing request
        </button>
        {status ? <p className="status">{status}</p> : null}
      </section>

      <div className="columns">
        <section>
          <h2>Work items ({workItems?.length ?? "…"})</h2>
          <ul>
            {(workItems ?? []).map((item) => (
              <li key={item._id}>
                <span className="meta">
                  {item.status} ·{" "}
                  {item.requiredCapabilityIds
                    .map((id) => capabilityNameById.get(id) ?? id)
                    .join(", ") || "no capabilities"}
                </span>
                <span className="body">{item.objective}</span>
              </li>
            ))}
            {workItems?.length === 0 ? (
              <li className="empty">No work items yet.</li>
            ) : null}
          </ul>
        </section>

        <section>
          <h2>Workers ({workers?.length ?? "…"})</h2>
          <ul>
            {(workers ?? []).map((worker) => (
              <li key={worker._id}>
                <span className="meta">
                  {worker.status} · {worker.employmentType} ·{" "}
                  {worker.capabilityIds
                    .map((id) => capabilityNameById.get(id) ?? "cap")
                    .join(", ") || "no capabilities"}
                </span>
                <span className="body">
                  {worker.name} — {worker.title}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2>Assignments ({assignments?.length ?? "…"})</h2>
          <ul>
            {(assignments ?? []).map((assignment) => (
              <li key={assignment._id}>
                <span className="meta">{assignment.status}</span>
                <span className="body">{assignment.responsibility}</span>
              </li>
            ))}
            {assignments?.length === 0 ? (
              <li className="empty">No assignments yet.</li>
            ) : null}
          </ul>
        </section>

        <section>
          <h2>Events ({events?.length ?? "…"})</h2>
          <ul>
            {(events ?? []).slice(0, 30).map((event) => (
              <li key={event._id}>
                <span className="meta">{event.eventType}</span>
                <span className="body">{event.summary}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2>Messages ({messages?.length ?? "…"})</h2>
          <ul>
            {(messages ?? []).slice(0, 10).map((message) => (
              <li key={message._id}>
                <span className="meta">
                  {message.direction} ·{" "}
                  {message.personDisplayName ?? "uncorrelated"}
                </span>
                <span className="body">{message.body || "(empty)"}</span>
              </li>
            ))}
            {messages?.length === 0 ? (
              <li className="empty">No messages yet.</li>
            ) : null}
          </ul>
        </section>
      </div>
    </main>
  );
}
