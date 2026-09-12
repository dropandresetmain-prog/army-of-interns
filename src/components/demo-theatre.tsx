"use client";

import { useState } from "react";
import { Play, RotateCcw, SkipForward } from "lucide-react";
import { liveFlowStages } from "@/lib/demo-state";
import { CommandCentre } from "./command-centre";

export function DemoTheatre() {
  const [stage, setStage] = useState(0);
  const advance = () => setStage((current) => Math.min(current + 1, liveFlowStages.length - 1));
  const current = liveFlowStages[stage];
  return <><CommandCentre initialState={current.state} />
    <aside className="theatre-controls" aria-label="Live flow replay controls">
      <span>Live flow · {stage + 1}/{liveFlowStages.length}: <b>{current.label}</b></span>
      <div><button onClick={() => setStage(0)} aria-label="Reset live flow"><RotateCcw size={15} /></button><button onClick={advance} disabled={stage === liveFlowStages.length - 1}>{stage === 0 ? <Play size={15} /> : <SkipForward size={15} />} {stage === liveFlowStages.length - 1 ? "Complete" : "Advance"}</button></div>
    </aside></>;
}
