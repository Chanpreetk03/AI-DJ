import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";
import type { Group, Points } from "three";

export type SceneVariant = "landing" | "output" | "booth" | "fallback" | "status";

type ScenePalette = {
  primary: string;
  secondary: string;
  accent: string;
};

const palettes: Record<SceneVariant, ScenePalette> = {
  landing: { primary: "#b99aff", secondary: "#ffab96", accent: "#fff0e9" },
  output: { primary: "#ffab96", secondary: "#b99aff", accent: "#fff0e9" },
  booth: { primary: "#b99aff", secondary: "#f59fb1", accent: "#ffdacd" },
  fallback: { primary: "#ffab96", secondary: "#ffdf9b", accent: "#fff0e9" },
  status: { primary: "#86e9cb", secondary: "#b99aff", accent: "#eafff8" },
};

function supportsWebGl(): boolean {
  const canvas = document.createElement("canvas");
  return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
}

export default function AdaptiveScene({ variant }: { variant: SceneVariant }): ReactElement | null {
  const [isSupported, setIsSupported] = useState(false);
  const [isVisible, setIsVisible] = useState(document.visibilityState === "visible");

  useEffect(() => {
    setIsSupported(supportsWebGl());
    const onVisibilityChange = (): void => setIsVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  if (!isSupported || !isVisible) return null;

  return <div className={`webgl-scene webgl-scene-${variant}`} aria-hidden="true">
    <Canvas dpr={[1, 1.25]} gl={{ alpha: true, antialias: true, powerPreference: "low-power" }} camera={{ fov: 44, position: [0, 0, 7] }}>
      <AdaptiveObjects variant={variant} />
    </Canvas>
  </div>;
}

function AdaptiveObjects({ variant }: { variant: SceneVariant }): ReactElement {
  const palette = palettes[variant];
  return <>
    <ambientLight intensity={.55} />
    <pointLight position={[2.5, 3, 4]} intensity={26} color={palette.primary} />
    <pointLight position={[-3, -2, 3]} intensity={17} color={palette.secondary} />
    {variant === "landing" && <VinylPortal palette={palette} />}
    {variant === "output" && <EnergyOrb palette={palette} />}
    {variant === "booth" && <MixerSculpture palette={palette} />}
    {variant === "fallback" && <RecoveryRunway palette={palette} />}
    {variant === "status" && <RoomConstellation palette={palette} />}
    <ParticleCloud palette={palette} />
  </>;
}

function VinylPortal({ palette }: { palette: ScenePalette }): ReactElement {
  const group = useRef<Group>(null);

  useFrame((state, delta) => {
    if (group.current === null) return;
    group.current.rotation.z += delta * .09;
    group.current.rotation.x = Math.sin(state.clock.elapsedTime * .32) * .12;
  });

  return <group ref={group} position={[2.1, .05, -.6]}>
    <mesh>
      <circleGeometry args={[1.3, 64]} />
      <meshBasicMaterial color="#1b1215" transparent opacity={.78} />
    </mesh>
    {[.42, .66, .9, 1.14, 1.36].map((radius, index) => <mesh key={radius} position={[0, 0, index * .012]}>
      <torusGeometry args={[radius, .018, 8, 72]} />
      <meshBasicMaterial color={index % 2 === 0 ? palette.primary : palette.secondary} transparent opacity={.68 - index * .07} />
    </mesh>)}
    <mesh position={[0, 0, .12]}>
      <circleGeometry args={[.32, 48]} />
      <meshBasicMaterial color={palette.secondary} />
    </mesh>
    <mesh position={[0, 0, .15]}>
      <ringGeometry args={[.36, .42, 48]} />
      <meshBasicMaterial color={palette.accent} />
    </mesh>
  </group>;
}

function EnergyOrb({ palette }: { palette: ScenePalette }): ReactElement {
  const group = useRef<Group>(null);

  useFrame((state, delta) => {
    if (group.current === null) return;
    const energy = roomEnergy();
    group.current.rotation.y += delta * (.18 + energy * .65);
    group.current.rotation.x = Math.sin(state.clock.elapsedTime * 1.2) * .18;
    group.current.scale.setScalar(1 + energy * .3);
  });

  return <group ref={group} position={[2.4, .2, -.7]}>
    <mesh><icosahedronGeometry args={[.88, 2]} /><meshStandardMaterial color={palette.primary} emissive={palette.primary} emissiveIntensity={.85} wireframe transparent opacity={.78} /></mesh>
    <mesh rotation={[.72, .15, 0]}><torusGeometry args={[1.25, .018, 8, 96]} /><meshBasicMaterial color={palette.accent} transparent opacity={.84} /></mesh>
    <mesh rotation={[-.48, .7, .42]}><torusGeometry args={[1.62, .012, 8, 96]} /><meshBasicMaterial color={palette.secondary} transparent opacity={.7} /></mesh>
    <mesh><sphereGeometry args={[.28, 24, 24]} /><meshBasicMaterial color={palette.secondary} /></mesh>
  </group>;
}

function MixerSculpture({ palette }: { palette: ScenePalette }): ReactElement {
  const group = useRef<Group>(null);

  useFrame((state, delta) => {
    if (group.current === null) return;
    group.current.rotation.y = Math.sin(state.clock.elapsedTime * .34) * .3 - .35;
    group.current.rotation.x = -.22;
    group.current.position.y = Math.sin(state.clock.elapsedTime * .7) * .08;
  });

  return <group ref={group} position={[2.35, -.2, -.6]}>
    <mesh><boxGeometry args={[2.45, 1.36, .28]} /><meshStandardMaterial color="#1c1518" metalness={.8} roughness={.3} /></mesh>
    {[-.75, -.25, .25, .75].map((x, index) => <group key={x} position={[x, 0, .22]}>
      <mesh position={[0, .28, .08]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.14, .14, .08, 24]} /><meshStandardMaterial color={index % 2 === 0 ? palette.primary : palette.secondary} emissive={index % 2 === 0 ? palette.primary : palette.secondary} emissiveIntensity={.4} /></mesh>
      <mesh position={[0, -.2 + Math.sin(index * 1.8) * .24, .08]}><boxGeometry args={[.12, .5, .1]} /><meshBasicMaterial color={palette.accent} /></mesh>
      <mesh position={[0, -.2 + Math.sin(index * 1.8) * .24, .13]}><boxGeometry args={[.24, .09, .08]} /><meshBasicMaterial color={palette.secondary} /></mesh>
    </group>)}
  </group>;
}

function RecoveryRunway({ palette }: { palette: ScenePalette }): ReactElement {
  const group = useRef<Group>(null);

  useFrame((state) => {
    if (group.current === null) return;
    group.current.position.z = Math.sin(state.clock.elapsedTime * .5) * .18;
    group.current.rotation.z = Math.sin(state.clock.elapsedTime * .3) * .05;
  });

  return <group ref={group} position={[2.15, -.2, -1.6]} rotation={[-.55, -.3, 0]}>
    {Array.from({ length: 8 }, (_, index) => <group key={index} position={[0, (index - 3.5) * .42, -index * .22]}>
      <mesh position={[-.8, 0, 0]}><boxGeometry args={[.95, .022, .025]} /><meshBasicMaterial color={palette.primary} transparent opacity={.7 - index * .055} /></mesh>
      <mesh position={[.8, 0, 0]}><boxGeometry args={[.95, .022, .025]} /><meshBasicMaterial color={palette.secondary} transparent opacity={.7 - index * .055} /></mesh>
      <mesh><sphereGeometry args={[.05 + index * .009, 16, 16]} /><meshBasicMaterial color={palette.accent} /></mesh>
    </group>)}
  </group>;
}

function RoomConstellation({ palette }: { palette: ScenePalette }): ReactElement {
  const group = useRef<Group>(null);
  const nodes = useMemo(() => [[-.95, .55, 0], [-.28, -.45, .15], [.25, .3, -.1], [.88, -.2, .1], [.52, .86, -.2]] as const, []);

  useFrame((state, delta) => {
    if (group.current === null) return;
    group.current.rotation.y += delta * .12;
    group.current.position.y = Math.sin(state.clock.elapsedTime * .7) * .1;
  });

  const linePositions = useMemo(() => new Float32Array([
    -.95, .55, 0, -.28, -.45, .15, -.28, -.45, .15, .25, .3, -.1, .25, .3, -.1, .88, -.2, .1, .25, .3, -.1, .52, .86, -.2,
  ]), []);

  return <group ref={group} position={[2.3, .1, -.5]}>
    <lineSegments><bufferGeometry><bufferAttribute attach="attributes-position" args={[linePositions, 3]} /></bufferGeometry><lineBasicMaterial color={palette.secondary} transparent opacity={.72} /></lineSegments>
    {nodes.map(([x, y, z], index) => <mesh key={`${x}-${y}`} position={[x, y, z]}><sphereGeometry args={[index === 2 ? .16 : .1, 24, 24]} /><meshBasicMaterial color={index === 2 ? palette.accent : palette.primary} /></mesh>)}
  </group>;
}

function ParticleCloud({ palette }: { palette: ScenePalette }): ReactElement {
  const points = useRef<Points>(null);
  const positions = useMemo(() => {
    const values = new Float32Array(210 * 3);
    for (let index = 0; index < values.length; index += 3) {
      values[index] = (Math.random() - .5) * 9;
      values[index + 1] = (Math.random() - .5) * 6;
      values[index + 2] = (Math.random() - .5) * 3 - 1;
    }
    return values;
  }, []);

  useFrame((_, delta) => {
    if (points.current !== null) points.current.rotation.z += delta * .018;
  });

  return <points ref={points}>
    <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
    <pointsMaterial color={palette.secondary} size={.035} sizeAttenuation transparent opacity={.7} depthWrite={false} />
  </points>;
}

function roomEnergy(): number {
  const stage = document.querySelector<HTMLElement>(".speaker-stage");
  if (stage === null) return .2;
  const value = Number.parseFloat(getComputedStyle(stage).getPropertyValue("--room-energy"));
  return Number.isFinite(value) ? Math.max(0, Math.min(value, 1)) : .2;
}
