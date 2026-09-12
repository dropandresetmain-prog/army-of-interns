"use client";

import { useMutation, useQuery } from "convex/react";
import { useState, useTransition } from "react";

import { api } from "../../convex/_generated/api";

export default function Home() {
  const messages = useQuery(api.messaging.listRecent);
  const workers = useQuery(api.workers.list);
  const events = useQuery(api.events.list);
  const insertProbe = useMutation(api.messaging.insertRealtimeProbe);
  const createProbeWorker = useMutation(api.workers.createRealtimeProbe);
  const [status, setStatus] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  return (
    <main className="spine">
      <header>
        <h1>Army of Interns</h1>
        <p className="lede">
          S2 messaging &amp; realtime spine — shared Convex state, not mock local
          data. Phone numbers are never shown.
        </p>
      </header>

      <section className="actions" aria-label="Realtime probes">
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              const id = await insertProbe({});
              setStatus(`Inserted event ${id}`);
            });
          }}
        >
          Insert event
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              const id = await createProbeWorker({});
              setStatus(`Inserted worker ${id}`);
            });
          }}
        >
          Insert worker
        </button>
        {status ? <p className="status">{status}</p> : null}
      </section>

      <div className="columns">
        <section>
          <h2>Messages ({messages?.length ?? "…"})</h2>
          <ul>
            {(messages ?? []).map((message) => (
              <li key={message._id}>
                <span className="meta">
                  {message.direction} · {message.status} ·{" "}
                  {message.personDisplayName ?? "uncorrelated"}
                </span>
                <span className="body">{message.body || "(empty)"}</span>
              </li>
            ))}
            {messages?.length === 0 ? <li className="empty">No messages yet.</li> : null}
          </ul>
        </section>

        <section>
          <h2>Workers ({workers?.length ?? "…"})</h2>
          <ul>
            {(workers ?? []).map((worker) => (
              <li key={worker._id}>
                <span className="meta">
                  {worker.status} · {worker.employmentType}
                </span>
                <span className="body">
                  {worker.name} — {worker.title}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2>Events ({events?.length ?? "…"})</h2>
          <ul>
            {(events ?? []).slice(0, 20).map((event) => (
              <li key={event._id}>
                <span className="meta">{event.eventType}</span>
                <span className="body">{event.summary}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
