# AI-DJ UX Implementation Plan

## Product direction

AI-DJ should feel like a live nightclub instrument: the host sees and controls a shared room, while each participant feels that their own movement and sound are powering the experience.

## Host flow

1. Landing state
   - Show an entry animation on page load.
   - Use hype copy such as “Are you ready to rock and roll?”
   - Provide one dominant “Yes, let’s rock” CTA.
2. DJ room state
   - Show a central animated speaker as the primary visual.
   - Drive speaker scale, cone movement, glow, and pulse speed from smoothed room energy.
   - Keep tempo, layers, active participants, and connection state visible but secondary.
3. Invite state
   - Open a modal or dedicated overlay from an “Invite people” control.
   - Show a QR code for the participant URL and a readable fallback URL.
   - Keep the room running behind the overlay.

## Participant flow

1. Onboarding state
   - Ask for a display name before requesting camera and microphone access.
   - Explain that only derived vibe values leave the phone.
2. Dashboard state
   - Show a circular, cropped live camera feed.
   - Surround it with an energy ring whose pulse responds to that participant’s local signal.
   - Show name, connection state, permission state, and lightweight motion/sound feedback.
3. Personal theme
   - Select one palette at initial load from a fixed set.
   - Store the selected palette for the session so it never changes during interaction.

## Visual and animation system

- Use CSS custom properties for `--room-energy`, `--participant-energy`, `--pulse-duration`, and palette colors.
- Prefer `transform`, `opacity`, and composited SVG/CSS layers for continuous animation.
- Smooth SignalR and sensor values with a small `requestAnimationFrame` interpolator instead of moving UI directly on every message.
- Respect `prefers-reduced-motion` with static or low-motion fallbacks.
- Keep the host desktop-first and the participant mobile-first.
- Avoid WebGL until the simpler speaker, glow, ring, and gradient system has been performance-tested.

## Implementation sequence

1. Host landing animation and CTA transition.
2. Host DJ room shell and central speaker visualizer.
3. Room-energy smoothing and speaker response.
4. Invite overlay and QR generation.
5. Participant name onboarding.
6. Participant camera dashboard and local energy ring.
7. Stable participant palette selection.
8. Reduced-motion, permission, reconnect, and mobile layout hardening.
9. End-to-end host/phone rehearsal.

## Technical seams

```text
frontend/src/
  host/
    landing.ts
    room.ts
    inviteQr.ts
    speakerVisualizer.ts
  participant/
    onboarding.ts
    dashboard.ts
    participantPalette.ts
    participantVisualizer.ts
  shared/
    animationSmoother.ts
    palette.ts
    qr.ts
```

The existing single-room SignalR model remains the first target. Participant names can be added to the join message later without introducing multi-room routing prematurely.
