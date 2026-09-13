import type { CSSProperties } from "react";
import alexAvatar from "@/data/alex.avatar.json";
import shuZhenAvatar from "@/data/shu-zhen.avatar.json";
import kaiAvatar from "@/data/kai.avatar.json";
import { statusLabel, type WorkforceWorker } from "@/lib/command-centre-types";

type AvatarDefinition = { name: string; colors: { body: string; eyes: string } };

const knownAvatars: Record<string, AvatarDefinition> = {
  alex: alexAvatar as AvatarDefinition,
  "shu-zhen": shuZhenAvatar as AvatarDefinition,
  kai: kaiAvatar as AvatarDefinition,
};

const fallbackBodies = ["#d7e4c1", "#d4e6f7", "#f1d6b4", "#e7d3f4", "#d5e6dd"];

function fallbackAvatar(worker: WorkforceWorker): AvatarDefinition {
  const paletteIndex = [...worker.id].reduce((sum, character) => sum + character.charCodeAt(0), 0) % fallbackBodies.length;
  return { name: `${worker.name} bot`, colors: { body: fallbackBodies[paletteIndex], eyes: "#17202c" } };
}

/** Maps generic worker state to a supplied avatar definition or deterministic fallback. */
export function WorkerAvatarBot({ worker }: { worker: WorkforceWorker }) {
  const avatarKey = worker.id in knownAvatars ? worker.id : worker.name.toLowerCase().replaceAll(" ", "-");
  const avatar = knownAvatars[avatarKey] ?? fallbackAvatar(worker);
  const style = { "--bot-body": avatar.colors.body, "--bot-eyes": avatar.colors.eyes } as CSSProperties;

  return <div className={`worker-avatar-bot worker-avatar-bot--${worker.status}`} style={style} role="img" aria-label={`${avatar.name}, ${statusLabel[worker.status]}`}>
    <span className="worker-avatar-bot__aura" aria-hidden="true" />
    <span className="worker-avatar-bot__orbit worker-avatar-bot__orbit--one" aria-hidden="true" />
    <span className="worker-avatar-bot__orb" aria-hidden="true"><i className="worker-avatar-bot__glint" /><i className="worker-avatar-bot__eye worker-avatar-bot__eye--left" /><i className="worker-avatar-bot__eye worker-avatar-bot__eye--right" /></span>
    <span className="worker-avatar-bot__signal" aria-hidden="true" />
  </div>;
}
