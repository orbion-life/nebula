/**
 * Re-export of Lenis's React hook so consumers (e.g. useRunScroll) import from one
 * place. Returns the active Lenis instance, or undefined under reduced-motion / outside
 * the provider — callers must null-check and fall back to native scroll.
 */
export { useLenis } from "lenis/react";
