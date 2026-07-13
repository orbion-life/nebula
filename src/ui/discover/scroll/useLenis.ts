/**
 * Re-export of Lenis's React hook so consumers (e.g. useRunScroll) import from one
 * place. The provider stays mounted across motion-preference changes so application state
 * is preserved; callers choosing animated scrolling must still honor reduced motion.
 */
export { useLenis } from "lenis/react";
