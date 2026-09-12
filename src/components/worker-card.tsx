import { motion } from "motion/react";
import { Wrench, BrainCircuit, CirclePause, Send, CheckCircle2, ShieldAlert, Moon } from "lucide-react";
import { statusLabel, type WorkforceWorker } from "@/lib/command-centre-types";

const statusIcon = { idle: Moon, thinking: BrainCircuit, using_tool: Wrench, waiting_human: CirclePause, delegating: Send, blocked: ShieldAlert, complete: CheckCircle2 };

function portraitKey(worker: WorkforceWorker): string {
  const name = worker.name.toLowerCase();
  if (name.includes("shu")) return "shu-zhen";
  if (name.includes("daniel") || name.includes("kai")) return "daniel";
  if (name.includes("alex")) return "alex";
  return worker.id;
}

export function WorkerCard({ worker }: { worker: WorkforceWorker }) {
  const Icon = statusIcon[worker.status];
  return <motion.article initial={{ opacity: 0, scale: 0.94, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="worker-card">
    <div className="worker-card__top"><span className={`employment-chip employment-chip--${worker.employmentType === "permanent" ? "permanent" : "intern"}`}>{worker.employmentType === "permanent" ? "Permanent" : "Intern"}</span><span className={`status-dot status-dot--${worker.status}`} /></div>
    <div className={`worker-portrait worker-portrait--${portraitKey(worker)}`} aria-hidden="true"><span>{worker.name.slice(0, 1)}</span></div>
    <h3>{worker.name}</h3><p className="worker-card__title">{worker.title}</p>
    <div className="worker-card__status"><Icon size={13} /><span>{statusLabel[worker.status]}</span></div>
  </motion.article>;
}
