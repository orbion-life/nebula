import { useSyncExternalStore } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function reducedMotionQuery(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  return window.matchMedia(REDUCED_MOTION_QUERY);
}

export function getReducedMotionSnapshot(): boolean {
  return reducedMotionQuery()?.matches ?? false;
}

export function subscribeReducedMotion(onStoreChange: () => void): () => void {
  const query = reducedMotionQuery();
  if (!query) return () => {};

  if (typeof query.addEventListener === "function") {
    query.addEventListener("change", onStoreChange);
    return () => query.removeEventListener("change", onStoreChange);
  }

  // Older Safari exposes the legacy MediaQueryList listener API only.
  query.addListener(onStoreChange);
  return () => query.removeListener(onStoreChange);
}

/** Reacts immediately when the operating-system motion preference changes. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, getReducedMotionSnapshot, () => false);
}

function getPageVisibleSnapshot(): boolean {
  return typeof document === "undefined" || document.visibilityState !== "hidden";
}

function subscribePageVisibility(onStoreChange: () => void): () => void {
  if (typeof document === "undefined") return () => {};
  document.addEventListener("visibilitychange", onStoreChange);
  return () => document.removeEventListener("visibilitychange", onStoreChange);
}

/** Lets animation owners stop their render loops while the document is hidden. */
export function usePageVisible(): boolean {
  return useSyncExternalStore(subscribePageVisibility, getPageVisibleSnapshot, () => true);
}
