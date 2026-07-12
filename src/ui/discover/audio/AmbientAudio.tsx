/**
 * Ambient-audio toggle for the header. Keyboard-operable, aria-pressed, muted by
 * default. The click is the user gesture that unlocks Web Audio (see useAmbientAudio).
 */
import { useAmbientAudio } from "./useAmbientAudio";

export function AmbientAudio() {
  const { enabled, toggle } = useAmbientAudio();
  return (
    <button
      type="button"
      className={`audio-toggle ${enabled ? "on" : ""}`}
      aria-pressed={enabled}
      aria-label={enabled ? "mute ambient sound" : "enable ambient sound"}
      title={enabled ? "ambient sound on" : "ambient sound off"}
      onClick={toggle}
    >
      <svg className="audio-eq" viewBox="0 0 14 14" width="13" height="13" aria-hidden>
        <rect x="1" y="5" width="1.7" height="4" rx="0.85" />
        <rect x="4.15" y="3" width="1.7" height="8" rx="0.85" />
        <rect x="7.3" y="1.5" width="1.7" height="11" rx="0.85" />
        <rect x="10.45" y="4.5" width="1.7" height="5" rx="0.85" />
      </svg>
      <span className="audio-label">{enabled ? "sound on" : "sound"}</span>
    </button>
  );
}
