"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

function material(color: THREE.ColorRepresentation, metalness = 0.15, roughness = 0.5) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness });
}

function agentOrb(color: string) {
  const group = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.35, 24, 24), material(color, 0.35, 0.25));
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.018, 10, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.72 }));
  halo.rotation.x = Math.PI / 2;
  group.add(shell, halo);
  return group;
}

/** Decorative Three.js scene. All operational state stays in the surrounding UI. */
export function LandlordAvatarScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 0.1, 7.2);
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    scene.add(new THREE.HemisphereLight(0xdbe6ff, 0x172117, 1.5));
    const key = new THREE.PointLight(0xe8b84b, 11, 13);
    key.position.set(-3, 3.5, 4);
    scene.add(key);
    const rim = new THREE.PointLight(0x60a5fa, 7, 11);
    rim.position.set(3, 1, 3);
    scene.add(rim);

    const alex = new THREE.Group();
    const head = new THREE.Mesh(new THREE.SphereGeometry(1.03, 32, 32), material(0xd6ac7d, 0.05, 0.6));
    head.position.y = 0.58;
    const hair = new THREE.Mesh(new THREE.SphereGeometry(1.055, 32, 18, 0, Math.PI * 2, 0, Math.PI * 0.47), material(0x28302b, 0.15, 0.65));
    hair.position.y = 0.84;
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.88, 1.42, 32), material(0x566743, 0.25, 0.38));
    torso.position.y = -1.03;
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.045, 10, 32), material(0xc4973f, 0.65, 0.25));
    collar.position.y = -0.34;
    collar.rotation.x = Math.PI / 2;
    alex.add(head, hair, torso, collar);

    [-0.34, 0.34].forEach((x) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 16), material(0x172117, 0, 0.4));
      eye.position.set(x, 0.66, 0.94);
      alex.add(eye);
    });
    const badge = new THREE.Mesh(new THREE.CircleGeometry(0.15, 20), material(0xc4973f, 0.6, 0.2));
    badge.position.set(0, -0.95, 0.71);
    alex.add(badge);
    scene.add(alex);

    const commandRing = new THREE.Mesh(new THREE.TorusGeometry(1.85, 0.016, 8, 80), new THREE.MeshBasicMaterial({ color: 0xc4973f, transparent: true, opacity: 0.55 }));
    commandRing.rotation.x = Math.PI * 0.42;
    scene.add(commandRing);
    const contractor = agentOrb("#7A9147");
    const tenant = agentOrb("#60A5FA");
    scene.add(contractor, tenant);

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const resize = () => {
      const { width, height } = host.getBoundingClientRect();
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => {
      const elapsed = clock.getElapsedTime();
      const motion = reduceMotion ? 0 : elapsed;
      alex.rotation.y = Math.sin(motion * 0.55) * 0.12;
      alex.position.y = Math.sin(motion * 1.15) * 0.07;
      commandRing.rotation.z = motion * 0.11;
      contractor.position.set(Math.cos(motion * 0.65 + 2.55) * 2.32, Math.sin(motion * 0.65 + 2.55) * 0.86, 0);
      tenant.position.set(Math.cos(motion * 0.65 - 0.55) * 2.32, Math.sin(motion * 0.65 - 0.55) * 0.86, 0);
      contractor.rotation.y = -motion * 0.8;
      tenant.rotation.y = motion * 0.8;
      renderer.render(scene, camera);
    });

    return () => {
      observer.disconnect();
      renderer.setAnimationLoop(null);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((item) => item.dispose());
        }
      });
      renderer.dispose();
    };
  }, []);

  return <div className="landlord-avatar-scene" ref={hostRef} aria-label="Alex, Shu Zhen and Kai form the property management team">
    <canvas ref={canvasRef} aria-hidden="true" />
    <div className="avatar-scene-fallback" aria-hidden="true"><div className="avatar-fallback-head"><i /><i /></div><div className="avatar-fallback-body"><b>AX</b><span>Alex</span></div></div>
    <div className="avatar-scene-label avatar-scene-label--contractor"><b>SZ</b><span>Shu Zhen<br />Contractor agent</span></div>
    <div className="avatar-scene-label avatar-scene-label--alex"><b>AX</b><span>Alex<br />Property Manager</span></div>
    <div className="avatar-scene-label avatar-scene-label--tenant"><b>KA</b><span>Kai<br />Tenant agent</span></div>
  </div>;
}
