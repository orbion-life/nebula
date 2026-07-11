/**
 * Smooth-scroll provider (Lenis) — the buttery scroll under the cinematic experience.
 *
 * Lenis SELF-DRIVES its RAF (autoRaf default), so the page always advances — this is the
 * fix for the earlier frozen-scroll bug, where autoRaf:false + a hand-wired GSAP-ticker RAF
 * could no-op (if the ref wasn't ready) and Lenis captured the wheel without ever moving the
 * page. GSAP ScrollTrigger stays in sync via the useLenis hook (no ref timing, no manual RAF).
 *
 * Under prefers-reduced-motion we do NOT instantiate Lenis — children render with native
 * scroll, no smoothing, no motion.
 */
import { useEffect, type ReactNode } from "react";
import { ReactLenis, useLenis } from "lenis/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

function LenisGsapSync() {
  // fires on every Lenis scroll frame → keeps ScrollTrigger-driven reveals in lockstep
  useLenis(() => ScrollTrigger.update());
  return null;
}

export function SmoothScroll({ children }: { children: ReactNode }) {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
  }, []);

  if (prefersReducedMotion()) return <>{children}</>;

  return (
    <ReactLenis root options={{ lerp: 0.09, smoothWheel: true, wheelMultiplier: 1 }}>
      <LenisGsapSync />
      {children}
    </ReactLenis>
  );
}
