/**
 * Procedural ambient sound — generated with the Web Audio API (no audio file shipped,
 * no copyright surface, genuinely "sound design"). A soft low drone (two detuned sines
 * a fifth apart) through a slowly-sweeping low-pass, plus a whisper of filtered noise.
 *
 * MUTED BY DEFAULT. The AudioContext is created only on a user gesture (the toggle
 * click or the run-start), satisfying browser autoplay policy. Preference persists in
 * localStorage but never auto-starts without a gesture. Suspends when the tab is hidden.
 */
import { useCallback, useEffect, useRef, useState } from "react";

const KEY = "nebula.audio";

type Graph = { ctx: AudioContext; master: GainNode; stop: () => void };

function buildGraph(): Graph {
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctor();
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 420;
  filter.Q.value = 0.7;
  filter.connect(master);

  // slow LFO sweeping the filter cutoff → gentle motion
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = 0.05;
  lfoGain.gain.value = 160;
  lfo.connect(lfoGain).connect(filter.frequency);
  lfo.start();

  const oscs: OscillatorNode[] = [];
  for (const [freq, gain] of [
    [110, 0.5],
    [110 * 1.5, 0.32], // a fifth up
    [55, 0.4], // sub
  ] as const) {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = freq;
    o.detune.value = (Math.sin(freq) * 6) | 0;
    const g = ctx.createGain();
    g.gain.value = gain;
    o.connect(g).connect(filter);
    o.start();
    oscs.push(o);
  }

  // faint filtered noise pad
  const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.sin(i * 0.0007) + (i % 97) / 97 - 0.5) * 0.12;
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuf;
  noise.loop = true;
  const noiseGain = ctx.createGain();
  noiseGain.gain.value = 0.08;
  noise.connect(noiseGain).connect(filter);
  noise.start();

  const stop = () => {
    try {
      lfo.stop();
      oscs.forEach((o) => o.stop());
      noise.stop();
    } catch {
      /* already stopped */
    }
  };
  return { ctx, master, stop };
}

export function useAmbientAudio() {
  const [enabled, setEnabled] = useState(false);
  const graphRef = useRef<Graph | null>(null);

  const fadeTo = (target: number) => {
    const g = graphRef.current;
    if (!g) return;
    const now = g.ctx.currentTime;
    g.master.gain.cancelScheduledValues(now);
    g.master.gain.setValueAtTime(g.master.gain.value, now);
    g.master.gain.linearRampToValueAtTime(target, now + 1.4);
  };

  const enable = useCallback(() => {
    if (!graphRef.current) {
      try {
        graphRef.current = buildGraph();
      } catch {
        return; // Web Audio unavailable — silently no-op
      }
    }
    void graphRef.current.ctx.resume();
    fadeTo(0.06);
    setEnabled(true);
    try {
      localStorage.setItem(KEY, "on");
    } catch {
      /* ignore */
    }
  }, []);

  const disable = useCallback(() => {
    fadeTo(0);
    setEnabled(false);
    try {
      localStorage.setItem(KEY, "off");
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => (enabled ? disable() : enable()), [enabled, enable, disable]);

  // suspend/resume with tab visibility
  useEffect(() => {
    const onVis = () => {
      const g = graphRef.current;
      if (!g) return;
      if (document.hidden) void g.ctx.suspend();
      else if (enabled) void g.ctx.resume();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [enabled]);

  useEffect(() => () => graphRef.current?.stop(), []);

  return { enabled, toggle };
}
