"use client";

import { Background, Controls, Handle, Position, ReactFlow, type Node, type NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { WorkerCard } from "./worker-card";
import type { WorkforceWorker } from "@/lib/command-centre-types";

function WorkerNode({ data }: NodeProps<Node<{ worker: WorkforceWorker }>>) {
  return <><Handle type="target" position={Position.Top} className="org-handle" /><WorkerCard worker={data.worker} /><Handle type="source" position={Position.Bottom} className="org-handle" /></>;
}

const nodeTypes = { worker: WorkerNode };

export function OrgChart({ workers }: { workers: WorkforceWorker[] }) {
  const borderColor = "var(--aoi-bdr)";
  const nodes: Node<{ worker: WorkforceWorker }>[] = workers.map((worker, index) => ({
    id: worker.id, type: "worker", data: { worker },
    position: worker.managerAgentId ? { x: 40 + (index - 1) * 278, y: 190 } : { x: 320, y: 20 },
    draggable: false, selectable: false
  }));
  const edges = workers.filter((worker) => worker.managerAgentId).map((worker) => ({ id: `${worker.managerAgentId}-${worker.id}`, source: worker.managerAgentId!, target: worker.id, animated: worker.status !== "idle", style: { stroke: borderColor, strokeWidth: 1.5 } }));
  return <div className="org-chart"><ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.32 }} nodesConnectable={false} nodesDraggable={false} panOnDrag={false} zoomOnScroll={false} zoomOnPinch={false} proOptions={{ hideAttribution: true }}><Background color={borderColor} gap={24} size={1} /><Controls showInteractive={false} /></ReactFlow></div>;
}
