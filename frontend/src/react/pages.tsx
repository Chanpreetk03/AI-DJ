import { motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { lazy, Suspense, useEffect, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import type { PointerEvent } from "react";
import type { SceneVariant } from "./scene/AdaptiveScene";

const AdaptiveScene = lazy(() => import("./scene/AdaptiveScene"));

export type AiDjPage = "landing" | "output" | "participant" | "booth" | "fallback" | "status";

const pagePaths: Record<string, AiDjPage> = {
  "/": "landing",
  "/index.html": "landing",
  "/output.html": "output",
  "/participant.html": "participant",
  "/booth.html": "booth",
  "/fallback.html": "fallback",
  "/status.html": "status",
};

export function resolvePage(pathname: string): AiDjPage {
  return pagePaths[pathname] ?? "landing";
}

export function AppPage({ page }: { page: AiDjPage }): ReactElement {
  const Page = {
    landing: LandingPage,
    output: OutputPage,
    participant: ParticipantPage,
    booth: BoothPage,
    fallback: FallbackPage,
    status: StatusPage,
  }[page];

  return <Page />;
}

function PageMotion({ children, className }: { children: ReactNode; className?: string }): ReactElement {
  const shouldReduceMotion = useReducedMotion();
  return <motion.main className={className} initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .45, ease: "easeOut" }}>{children}</motion.main>;
}

function Navigation({ current }: { current: AiDjPage }): ReactElement {
  const links: Array<{ page: AiDjPage; href: string; label: string }> = [
    { page: "landing", href: "/", label: "AI—DJ" },
    { page: "output", href: "/output.html", label: "Live deck" },
    { page: "participant", href: "/participant.html", label: "Join" },
    { page: "booth", href: "/booth.html", label: "Booth" },
    { page: "status", href: "/status.html", label: "Status" },
  ];

  return <nav className="app-nav tape-nav" aria-label="AI-DJ navigation">
    {links.map(link => <a key={link.page} href={link.href} aria-current={link.page === current ? "page" : undefined}>{link.label}</a>)}
  </nav>;
}

function LandingPage(): ReactElement {
  return <div className="tape-app"><DesktopScene variant="landing" /><Navigation current="landing" /><PageMotion className="landing-deck">
    <section><p className="eyebrow">CROWD-REACTIVE / LIVE</p><h1>THE<br /><em>ROOM</em><br />IS THE DJ.</h1><p>Turn the collective energy in the room into a live, evolving musical story.</p><button id="create-room" className="button landing-cta" type="button">Start a room <span aria-hidden="true">↗</span></button><p id="landing-status" className="status" role="status" /></section>
    <LandingRecord />
  </PageMotion></div>;
}

function LandingRecord(): ReactElement {
  const shouldReduceMotion = useReducedMotion();
  const rotateX = useSpring(useMotionValue(0), { stiffness: 120, damping: 18, mass: .65 });
  const rotateY = useSpring(useMotionValue(0), { stiffness: 120, damping: 18, mass: .65 });

  function updateTilt(event: PointerEvent<HTMLDivElement>): void {
    if (event.pointerType === "touch") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    rotateX.set(((event.clientY - bounds.top) / bounds.height - .5) * -13);
    rotateY.set(((event.clientX - bounds.left) / bounds.width - .5) * 13);
  }

  function resetTilt(): void {
    rotateX.set(0);
    rotateY.set(0);
  }

  return <motion.div className="landing-record-scene" aria-hidden="true" onPointerMove={shouldReduceMotion ? undefined : updateTilt} onPointerLeave={shouldReduceMotion ? undefined : resetTilt} style={shouldReduceMotion ? undefined : { rotateX, rotateY }}>
    <motion.div className="landing-record" animate={{ rotate: shouldReduceMotion ? 0 : 360 }} transition={{ duration: 48, ease: "linear", repeat: shouldReduceMotion ? 0 : Infinity }} />
    <div className="record-light-sweep" />
    <div className="record-label">AI</div>
    <div className="record-badge">MOVE THE ROOM</div>
    <div className="record-sparks"><i /><i /><i /><i /><i /></div>
  </motion.div>;
}

function OutputPage(): ReactElement {
  return <div className="tape-app"><DesktopScene variant="output" /><Navigation current="output" /><PageMotion className="tape-console">
    <header className="tape-console-head"><span>HUMAN + MACHINE SET</span><p id="status" className="status">Connecting…</p><button id="invite-button" className="tape-text-button" type="button">Invite the room ↗</button></header>
    <section className="tape-host-grid">
      <aside className="tape-arc-panel"><p className="eyebrow">SET / LIVE</p><h1>THE<br /><em>ARC.</em></h1><p className="tape-copy">A musical story that reacts to the people in the room—not a playlist that shuffles.</p><div className="arc-meter" aria-hidden="true"><i /><i /><i /><i /><i /></div><div className="tape-stat-stack"><div><span>TEMPO</span><strong id="tempo">92 BPM</strong></div><div><span>PEOPLE</span><strong id="participant-count">0</strong></div><div><span>LAYERS</span><strong id="layers">1 / 4</strong></div></div></aside>
      <section className="tape-deck-panel" aria-label="AI-DJ live deck"><section className="speaker-stage tape-record-stage" aria-label="Room energy visualizer"><div className="stage-grid" aria-hidden="true" /><div className="orbit orbit-one" aria-hidden="true" /><div className="orbit orbit-two" aria-hidden="true" /><div className="speaker-glow" aria-hidden="true" /><div className="speaker" id="speaker" aria-hidden="true"><div className="speaker-tweeter" /><div className="speaker-cone speaker-cone-large" /><div className="speaker-cone speaker-cone-small" /></div><div className="speaker-energy"><span id="energy-value">0%</span><small>ROOM ENERGY</small></div></section><p className="deck-kicker">PLAYING INTO THE ROOM</p><h2 className="deck-title">Crowd-reactive<br /><em>AI—DJ</em></h2><div className="equalizer tape-equalizer" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /><i /></div><div className="deck-actions"><button id="hold-direction" className="deck-icon-button" type="button" aria-label="Hold current direction">◖</button><button id="start-audio" className="deck-play-button" type="button">▶</button><button id="end-session" className="deck-icon-button" type="button" disabled aria-label="End this session">■</button></div><p className="deck-hint">Start audio once, then let the room shape the set.</p></section>
      <aside className="tape-next-panel"><p className="eyebrow">DJ INTENT</p><strong id="dj-intent" className="intent-readout">Warmup · waiting for a room signal</strong><section className="next-card"><span>THE AI IS PREPARING</span><p id="dj-decision">Listening for the next musical moment.</p></section><label className="tape-energy-readout">ROOM ENERGY <output id="host-energy">0%</output><span><i /></span></label><a className="tape-link" href="/booth.html">Open booth controller →</a></aside>
    </section><MusicSources />
  </PageMotion><InviteModal /></div>;
}

function MusicSources(): ReactElement {
  return <details className="music-sources"><summary>Music sources &amp; advanced controls</summary><div className="music-source-grid">
    <section><button id="connect-spotify" className="button secondary provider-button" type="button">Connect Spotify</button><p id="spotify-status" className="rehearsal-status">Local AI-DJ audio is active by default.</p><label htmlFor="spotify-search">Search Spotify tracks</label><div className="spotify-search-row"><input id="spotify-search" type="search" placeholder="Song name or artist" /><button id="search-spotify" className="button secondary" type="button">Search</button></div><div id="spotify-results" className="spotify-results" /><input id="spotify-track-uri" type="text" placeholder="spotify:track:…" /><button id="play-spotify" className="button secondary" type="button">Play Spotify track</button><details className="spotify-auto-panel"><summary>Automatic vibe DJ</summary><label htmlFor="auto-language">Language</label><select id="auto-language" defaultValue=""><option value="">Mixed language</option><option value="English">English</option><option value="Hindi">Hindi</option><option value="Punjabi">Punjabi</option></select><label htmlFor="auto-remix">Remix preference</label><select id="auto-remix" defaultValue="allow"><option value="allow">Allow remixes</option><option value="avoid">Prefer originals</option><option value="prefer">Prefer remixes at peak</option></select><button id="toggle-auto-dj" className="button secondary" type="button">Start automatic vibe DJ</button><p id="auto-dj-status" className="rehearsal-status">Automatic mode is off.</p></details></section>
    <section><button id="connect-youtube-music" className="button secondary provider-button" type="button">Connect YouTube Music</button><p id="youtube-music-status" className="rehearsal-status">YouTube Music playback uses the official player.</p><label htmlFor="youtube-music-search">Search YouTube Music</label><div className="spotify-search-row"><input id="youtube-music-search" type="search" placeholder="Song name or artist" /><button id="search-youtube-music" className="button secondary" type="button">Search</button></div><div id="youtube-music-results" className="spotify-results" /><input id="youtube-music-video-id" type="text" placeholder="YouTube video ID" /><button id="play-youtube-music" className="button secondary" type="button">Play YouTube Music song</button><div id="youtube-player" className="youtube-player" /></section>
  </div></details>;
}

function InviteModal(): ReactElement {
  return <div id="invite-modal" className="modal-backdrop" hidden><section className="invite-modal" role="dialog" aria-modal="true" aria-labelledby="invite-title"><button id="close-invite" className="modal-close" aria-label="Close invite">×</button><p className="eyebrow">Bring the room to life</p><h2 id="invite-title">Scan to join the party.</h2><canvas id="invite-qr" width="240" height="240" /><p id="invite-url" className="invite-url" /><button id="copy-invite" className="button secondary">Copy invite link</button></section></div>;
}

function ParticipantPage(): ReactElement {
  return <div className="tape-app participant-app"><Navigation current="participant" /><PageMotion className="participant-deck">
    <section className="participant-signal-stage" aria-label="Your private live signal">
      <div className="signal-pod-topline"><span>YOUR SIGNAL</span><i>LOCAL ONLY</i></div>
      <div className="signal-radar" aria-hidden="true"><i /><i /><i /></div>
      <div id="participant-energy" className="participant-energy-ring"><video id="camera" autoPlay muted playsInline aria-label="Your private camera preview" /></div>
      <p id="contribution" className="contribution" role="status" aria-live="polite">Waiting for permission and connection</p>
      <div className="participant-meters meters"><label>MOTION <meter id="motion-meter" min="0" max="1" value="0" /></label><label>SOUND <meter id="audio-meter" min="0" max="1" value="0" /></label></div>
      <p className="signal-capture-note">Camera + microphone are processed on this device.</p>
    </section>
    <section className="participant-copy"><p className="eyebrow">AUDIENCE / LIVE SIGNAL</p><h1>MOVE<br /><em>THE SET.</em></h1><p>Every movement changes the room. Your camera and mic stay private on this phone.</p><div className="participant-privacy"><span>01</span><strong>Only lightweight vibe numbers join the room.</strong></div><label className="name-field" htmlFor="participant-name"><span>YOUR NAME</span><input id="participant-name" type="text" autoComplete="name" maxLength={24} placeholder="e.g. Maya" /></label><div className="participant-actions"><button id="join-button" className="button participant-join-button" type="button">Join the room ↗</button><button id="leave-button" className="button secondary participant-leave-button" type="button" hidden>Leave</button></div><p id="status" className="status" role="status" aria-live="polite" tabIndex={-1}>Not connected</p></section>
  </PageMotion></div>;
}

function BoothPage(): ReactElement {
  const states = [["Quiet", .08], ["Warm", .35], ["Active", .68], ["Peak", 1], ["Cool", .16]] as const;
  return <div className="tape-app"><DesktopScene variant="booth" /><Navigation current="booth" /><PageMotion className="booth-deck"><header><p className="eyebrow">FALLBACK / BOOTH DEVICE</p><h1>CONTROL<br /><em>THE ARC.</em></h1><p id="booth-status" className="status">Connecting…</p></header><section className="booth-mixer" aria-labelledby="booth-state-title"><div><span>REHEARSAL INPUT</span><h2 id="booth-state-title">Choose the energy.</h2></div><div className="booth-state-grid">{states.map(([label, energy]) => <button key={label} className="button secondary booth-state" data-energy={energy} type="button">{label}</button>)}</div><label className="booth-slider" htmlFor="booth-energy"><span>MANUAL ENERGY <strong id="booth-energy-value">8%</strong></span><input id="booth-energy" type="range" min="0" max="1" step="0.01" defaultValue="0.08" /></label><p id="booth-mode" className="rehearsal-status">Waiting for connection</p></section><footer className="booth-footer"><button id="booth-leave" className="tape-text-button" type="button">Leave room</button><a className="tape-link" href="/output.html">Back to live deck →</a></footer></PageMotion></div>;
}

function FallbackPage(): ReactElement {
  return <div className="tape-app"><DesktopScene variant="fallback" /><Navigation current="fallback" /><PageMotion className="fallback-deck"><section><p className="eyebrow">SAFE MODE / SAME SIGNAL PATH</p><h1>KEEP THE<br /><em>ROOM MOVING.</em></h1><p>Rehearse a complete crowd arc or switch to a controlled booth source when phones are unavailable.</p><div className="actions"><button id="sequence-button" className="button" type="button">Run quiet → peak → cool</button><button id="booth-button" className="button secondary" type="button">Start booth controls</button></div><p id="status" className="status">Not connected</p></section><section className="fallback-console"><p>LIVE FALLBACK INPUT</p><div id="booth-controls" className="meters hidden"><label>BOOTH MOTION <input id="booth-motion" type="range" min="0" max="1" step="0.01" defaultValue="0.2" /></label><label>BOOTH SOUND <input id="booth-audio" type="range" min="0" max="1" step="0.01" defaultValue="0.2" /></label></div><p id="source-label" className="muted small">Fallback controls are inactive.</p></section></PageMotion></div>;
}

function StatusPage(): ReactElement {
  return <div className="tape-app"><DesktopScene variant="status" /><Navigation current="status" /><PageMotion className="status-deck"><header><p className="eyebrow">OPERATOR / ROOM TELEMETRY</p><h1>THE ROOM<br /><em>READOUT.</em></h1><p id="status" className="status">Connecting…</p></header><section className="status-tape-grid"><div className="status-card"><span>CONNECTED</span><strong id="connected-clients">0</strong></div><div className="status-card"><span>CONTRIBUTING</span><strong id="participant-clients">0</strong></div><div className="status-card"><span>OUTPUT</span><strong id="output-connected">Offline</strong></div><div className="status-card energy-status"><span>ROOM ENERGY</span><strong id="room-energy">0%</strong></div></section><section className="status-tape-wide"><p>LATEST INPUT</p><strong id="latest-input">No vibe received</strong><span id="latest-values">Waiting for a participant, booth, or synthetic source.</span></section><section className="status-tape-wide"><p>MUSIC PARAMETERS</p><span id="music-params">Tempo 92 BPM · Cutoff 18% · Density 15% · Layers 1/4</span></section><footer><a className="button" href="/fallback.html">Open rehearsal controls</a><a className="tape-link" href="/output.html">Return to live deck →</a></footer></PageMotion></div>;
}

function DesktopScene({ variant }: { variant: SceneVariant }): ReactElement | null {
  const [isEligible, setIsEligible] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px) and (prefers-reduced-motion: no-preference)");
    const updateEligibility = (): void => setIsEligible(media.matches);
    updateEligibility();
    media.addEventListener("change", updateEligibility);
    return () => media.removeEventListener("change", updateEligibility);
  }, []);

  if (!isEligible) return null;
  return <Suspense fallback={null}><AdaptiveScene variant={variant} /></Suspense>;
}
