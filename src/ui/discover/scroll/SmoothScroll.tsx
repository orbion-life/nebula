/**
 * Smooth-scroll provider (Lenis) — the buttery scroll that carries the cinematic
 * scroll-first experience. Lenis drives window scroll; we run its RAF off the GSAP
 * ticker and update ScrollTrigger on every Lenis scroll, so pinned/scrubbed sections
 * stay in perfect sync (the documented Lenis↔GSAP wiring, no scrollerProxy).
 *
 * Under prefers-reduced-motion we do NOT instantiate Lenis — children render with
 * native scroll, no smoothing, no motion. Nested scroll panes opt out with
 * `data-lenis-prevent` (see Workspace).
 */
import { useEffect, useRef, type ReactNode } from "react";
import { ReactLenis, type LenisRef } from "lenis/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

export function SmoothScroll({ children }: { children: ReactNode }) {
  if (prefersReducedMotion()) return <>{children}</>;
  return <SmoothScrollInner>{children}</SmoothScrollInner>;
}

function SmoothScrollInner({ children }: { children: ReactNode }) {
  const ref = useRef<LenisRef | null>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const lenis = ref.current?.lenis;
    const update = (time: number) => lenis?.raf(time * 1000);
    const onScroll = () => ScrollTrigger.update();
    gsap.ticker.add(update);
    gsap.ticker.lagSmoothing(0);
    lenis?.on("scroll", onScroll);
    ScrollTrigger.refresh();
    return () => {
      gsap.ticker.remove(update);
      lenis?.off("scroll", onScroll);
    };
  }, []);

  return (
    <ReactLenis root ref={ref} options={{ autoRaf: false, lerp: 0.09, smoothWheel: true, wheelMultiplier: 1 }}>
      {children}
    </ReactLenis>
  );
}
