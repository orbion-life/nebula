import { afterEach, describe, expect, it, vi } from "vitest";
import { getReducedMotionSnapshot, subscribeReducedMotion } from "../src/ui/discover/motion/useReducedMotion";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("reduced-motion preference store", () => {
  it("uses a motion-safe server fallback when matchMedia is unavailable", () => {
    vi.stubGlobal("window", undefined);
    expect(getReducedMotionSnapshot()).toBe(false);
  });

  it("notifies subscribers when the media query changes and removes the listener", () => {
    const listeners = new Set<() => void>();
    const query = {
      matches: false,
      addEventListener: vi.fn((_event: string, listener: () => void) => listeners.add(listener)),
      removeEventListener: vi.fn((_event: string, listener: () => void) => listeners.delete(listener)),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    };
    vi.stubGlobal("window", { matchMedia: vi.fn(() => query) });

    const onChange = vi.fn();
    const unsubscribe = subscribeReducedMotion(onChange);
    expect(getReducedMotionSnapshot()).toBe(false);

    query.matches = true;
    listeners.forEach((listener) => listener());
    expect(onChange).toHaveBeenCalledOnce();
    expect(getReducedMotionSnapshot()).toBe(true);

    unsubscribe();
    expect(query.removeEventListener).toHaveBeenCalledWith("change", onChange);
    expect(listeners.size).toBe(0);
  });
});
