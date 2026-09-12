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

  return (
    <CommandCentre
      initialState={state}
      headerActions={
        <>
          <button
            type="button"
            className="demo-reset"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await resetDemo({});
                setResetNote("Demo reset");
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
