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
      <span aria-hidden>{enabled ? "♪" : "♪̸"}</span>
      <span className="audio-label">{enabled ? "sound on" : "sound"}</span>
    </button>
  );
}
