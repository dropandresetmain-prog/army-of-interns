"use client";

import { useMutation, useQuery } from "convex/react";
import { RotateCcw } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import { api } from "../../convex/_generated/api";
import { CommandCentre } from "./command-centre";
import { emptyCommandCentreState, toCommandCentreState } from "@/lib/project-command-centre";

export function LiveCommandCentre() {
  const snapshot = useQuery(api.demoRuntime.getCommandCentreSnapshot);
  const resetDemo = useMutation(api.demoRuntime.resetDemo);
  const [resetNote, setResetNote] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!resetNote) {
      return;
    }
    const timeout = window.setTimeout(() => setResetNote(""), 2500);
    return () => window.clearTimeout(timeout);
  }, [resetNote]);

  const state = snapshot ? toCommandCentreState(snapshot) : emptyCommandCentreState;
  const boardKey = snapshot
    ? [
        snapshot.participants.ownerReady ? "owner" : "no-owner",
        snapshot.participants.tenant.joined,
        snapshot.participants.contractors.joined,
        snapshot.workers.map((worker) => worker.id).join("-") || "alex-only",
        snapshot.workItem?.id ?? "idle",
      ].join(":")
    : "loading";

  return (
    <CommandCentre
      key={boardKey}
      initialState={state}
      headerActions={
        <>
          <button
            type="button"
            className="demo-reset"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                try {
                  await resetDemo({});
                  setResetNote("Demo reset");
                } catch (error) {
                  setResetNote(
                    error instanceof Error ? error.message : "Reset failed",
                  );
                }
              })
            }
          >
            <RotateCcw size={14} aria-hidden="true" />
            Reset Demo
          </button>
          {resetNote ? <p className="demo-reset-note">{resetNote}</p> : null}
        </>
      }
    />
  );
}
