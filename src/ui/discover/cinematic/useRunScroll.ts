/**
 * Keeps scroll sane across Act transitions. When the active Act changes (objective →
 * search → result → workspace) the page resets to the top so each Act starts at its
 * beginning, and ScrollTrigger is refreshed so Act III's scroll-scrubbed chapters
 * measure against the newly-mounted layout. Lenis-aware; degrades to window.scrollTo
 * under reduced-motion (no Lenis).
 */
import { useEffect } from "react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLenis } from "../scroll/useLenis";

export function useRunScroll(actKey: string) {
  const lenis = useLenis();
  useEffect(() => {
    if (lenis) lenis.scrollTo(0, { immediate: true });
    else window.scrollTo(0, 0);
    // let the new Act lay out, then re-measure any scroll-driven triggers
    const id = window.setTimeout(() => {
      try {
        ScrollTrigger.refresh();
      } catch {
        /* ScrollTrigger not registered (reduced-motion) — fine */
      }
      const heading = document.querySelector<HTMLElement>("#main-content h1, #main-content h2");
      if (heading) {
        heading.setAttribute("tabindex", "-1");
        heading.focus({ preventScroll: true });
      }
    }, 60);
    return () => window.clearTimeout(id);
  }, [actKey, lenis]);
}
