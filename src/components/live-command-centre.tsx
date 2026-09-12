"use client";

import { useMutation, useQuery } from "convex/react";
import { useState, useTransition } from "react";

import { api } from "../../convex/_generated/api";
import { CommandCentre } from "./command-centre";
import { emptyCommandCentreState, toCommandCentreState } from "@/lib/project-command-centre";

export function LiveCommandCentre() {
  const snapshot = useQuery(api.demoRuntime.getCommandCentreSnapshot);
  const resetDemo = useMutation(api.demoRuntime.resetDemo);
  const [resetNote, setResetNote] = useState("");
  const [isPending, startTransition] = useTransition();

  const state = snapshot ? toCommandCentreState(snapshot) : emptyCommandCentreState;

  return (
    <>
      <CommandCentre initialState={state} />
      <button
        type="button"
        className="demo-reset"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await resetDemo({});
            setResetNote("Demo reset. Telegram role mappings kept.");
          })
        }
      >
        Reset demo
      </button>
      {resetNote ? <p className="demo-reset-note">{resetNote}</p> : null}
    </>
  );
}
