"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import avatarDefinition from "@/data/alex.avatar.json";
import oneeDefinition from "@/data/shu-zhen.avatar.json";
import kirbyDefinition from "@/data/kai.avatar.json";

type AvatarDefinition = {
  name: string;
  colors: { body: string; eyes: string };
  animationOrder: string[];
};

const definition = avatarDefinition as AvatarDefinition;
const onee = oneeDefinition as AvatarDefinition;
const kirby = kirbyDefinition as AvatarDefinition;
const preferredAnimations = ["idle", "listening", "thinking", "working"];

function TeamAvatar({ definition: avatar, variant }: { definition: AvatarDefinition; variant: "contractor" | "tenant" }) {
  return <span
    className={`team-avatar team-avatar--${variant}`}
    style={{ "--team-avatar-body": avatar.colors.body, "--team-avatar-eyes": avatar.colors.eyes } as CSSProperties}
    aria-label={`${avatar.name} avatar`}
  ><i /><i /></span>;
}

/**
 * A local renderer for Alex's supplied Strobi avatar definition.
 * The package in the supplied demo is private, so this uses the definition's
 * palette and animation vocabulary without making the production UI depend on
 * an unavailable registry package.
 */
export function LandlordAvatarScene() {
  const animations = useMemo(
    () => preferredAnimations.filter((animation) => definition.animationOrder.includes(animation)),
    [],
  );
  const [animation, setAnimation] = useState(animations[0] ?? "idle");

  useEffect(() => {
    if (animations.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      setAnimation((current) => animations[(animations.indexOf(current) + 1) % animations.length]);
    }, 3600);
    return () => window.clearInterval(timer);
  }, [animations]);

  return (
    <div className="landlord-avatar-scene" aria-label={`${definition.name} avatar, representing Alex the Property Manager`}>
      <div className="alex-avatar-aura" aria-hidden="true" />
      <div className="alex-avatar-orbit alex-avatar-orbit--outer" aria-hidden="true" />
      <div
        className={`alex-avatar alex-avatar--${animation}`}
        style={{ "--alex-body": definition.colors.body, "--alex-eyes": definition.colors.eyes } as CSSProperties}
        aria-hidden="true"
      >
        <div className="alex-avatar__reflection" />
        <div className="alex-avatar__eye alex-avatar__eye--left" />
        <div className="alex-avatar__eye alex-avatar__eye--right" />
        <div className="alex-avatar__status"><i /> {animation}</div>
      </div>
      <div className="alex-avatar-orbit alex-avatar-orbit--inner" aria-hidden="true" />
      <div className="avatar-scene-label avatar-scene-label--contractor"><TeamAvatar definition={onee} variant="contractor" /><span>Shu Zhen<br />Contractor agent</span></div>
      <div className="avatar-scene-label avatar-scene-label--alex"><b>AX</b><span>Alex<br />Property Manager</span></div>
      <div className="avatar-scene-label avatar-scene-label--tenant"><TeamAvatar definition={kirby} variant="tenant" /><span>Kai<br />Tenant agent</span></div>
    </div>
  );
}
