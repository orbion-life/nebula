/**
 * Smooth-scroll provider (Lenis), the buttery scroll under the cinematic experience.
 *
 * Lenis SELF-DRIVES its RAF (autoRaf default), so the page always advances, this is the
 * fix for the earlier frozen-scroll bug, where autoRaf:false + a hand-wired GSAP-ticker RAF
 * could no-op (if the ref wasn't ready) and Lenis captured the wheel without ever moving the
 * page. GSAP ScrollTrigger stays in sync via the useLenis hook (no ref timing, no manual RAF).
 *
 * Under prefers-reduced-motion or while the page is hidden, Lenis remains as a stable
 * context provider but runs with native wheel scrolling and no RAF. Keeping the provider
 * mounted prevents a visibility change from remounting the entire application subtree.
 */
import { useEffect, type ReactNode } from "react";
import { ReactLenis, useLenis } from "lenis/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { usePageVisible, useReducedMotion } from "../motion/useReducedMotion";

function LenisGsapSync({ active }: { active: boolean }) {
  // fires on every Lenis scroll frame → keeps ScrollTrigger-driven reveals in lockstep
  useLenis(() => { if (active) ScrollTrigger.update(); }, [active]);
  return null;
}

export function SmoothScroll({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const pageVisible = usePageVisible();
  const active = !reduced && pageVisible;

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
  }, []);

  return (
    <ReactLenis
      root
      options={active
        ? { autoRaf: true, lerp: 0.09, smoothWheel: true, wheelMultiplier: 1 }
        : { autoRaf: false, lerp: 1, smoothWheel: false, wheelMultiplier: 1 }}
    >
      <LenisGsapSync active={active} />
      {children}
    </ReactLenis>
  );
}
