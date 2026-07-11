/**
 * Procedural ambient sound — generated with the Web Audio API (no audio file shipped,
 * no copyright surface, genuinely "sound design"). The character is SPACE + MARINE +
 * MEDITATIVE:
 *   space     — a deep sub, an open-fifth drone, and a faint high shimmer;
 *   marine    — a slow moaning whale-song glide and a breathing wave-surge of filtered
 *               noise, all under a dark, slowly sweeping low-pass (underwater);
 *   meditative— a feedback-delay reverb tail and slow LFOs, no beat, nothing rhythmic.
 * The low-pass `filter` is left exposed on the graph so the descent can later pull it
 * darker as you sink toward the quantum core.
 *
 * MUTED BY DEFAULT. The AudioContext is created only on a user gesture (the toggle
 * click or the run-start), satisfying browser autoplay policy. Preference persists in
 * localStorage but never auto-starts without a gesture. Suspends when the tab is hidden.
 */
import { useCallback, useEffect, useRef, useState } from "react";

const KEY = "nebula.audio";

type Graph = { ctx: AudioContext; master: GainNode; filter: BiquadFilterNode; stop: () => void };

function buildGraph(): Graph {
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctor();
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);

  const oscs: OscillatorNode[] = [];
  const sources: AudioScheduledSourceNode[] = [];

  // --- meditative reverb tail: a small feedback-delay network with damping ---
  const wet = ctx.createGain();
  wet.gain.value = 0.5;
  wet.connect(master);
  const reverbIn = ctx.createGain();
  const d1 = ctx.createDelay(1.0);
  const d2 = ctx.createDelay(1.0);
  d1.delayTime.value = 0.33;
  d2.delayTime.value = 0.47;
  const fb1 = ctx.createGain();
  const fb2 = ctx.createGain();
  fb1.gain.value = 0.42;
  fb2.gain.value = 0.36;
  const damp = ctx.createBiquadFilter();
  damp.type = "lowpass";
  damp.frequency.value = 900;
  reverbIn.connect(d1);
  reverbIn.connect(d2);
  d1.connect(fb1).connect(d2);
  d2.connect(fb2).connect(d1);
  d1.connect(damp);
  d2.connect(damp);
  damp.connect(wet);

  // --- dark, slowly sweeping low-pass: the underwater body ---
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 340;
  filter.Q.value = 0.8;
  filter.connect(master);
  filter.connect(reverbIn);

  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = 0.04;
  lfoGain.gain.value = 170;
  lfo.connect(lfoGain).connect(filter.frequency);
  lfo.start();
  oscs.push(lfo);

  // --- space: deep sub + open fifth + faint high shimmer ---
  for (const [freq, gain] of [
    [32.7, 0.5], // deep sub
    [65.4, 0.42], // root
    [98.0, 0.3], // fifth
    [261.6, 0.06], // high shimmer
  ] as const) {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = freq;
    o.detune.value = (Math.sin(freq) * 5) | 0;
    const g = ctx.createGain();
    g.gain.value = gain;
    o.connect(g).connect(filter);
    o.start();
    oscs.push(o);
  }

  // --- marine: a slow moaning whale-song glide, distant (mostly into the reverb) ---
  const whale = ctx.createOscillator();
  whale.type = "sine";
  whale.frequency.value = 170;
  const whaleLfo = ctx.createOscillator();
  const whaleDepth = ctx.createGain();
  whaleLfo.frequency.value = 0.024;
  whaleDepth.gain.value = 70;
  whaleLfo.connect(whaleDepth).connect(whale.frequency);
  whaleLfo.start();
  const whaleBp = ctx.createBiquadFilter();
  whaleBp.type = "bandpass";
  whaleBp.frequency.value = 300;
  whaleBp.Q.value = 2.6;
  const whaleGain = ctx.createGain();
  whaleGain.gain.value = 0.08;
  whale.connect(whaleBp).connect(whaleGain);
  whaleGain.connect(reverbIn);
  whaleGain.connect(master);
  whale.start();
  oscs.push(whale, whaleLfo);

  // --- marine: a breathing wave-surge of filtered noise ---
  const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuf;
  noise.loop = true;
  const noiseBp = ctx.createBiquadFilter();
  noiseBp.type = "bandpass";
  noiseBp.frequency.value = 480;
  noiseBp.Q.value = 0.6;
  const surge = ctx.createGain();
  surge.gain.value = 0.05;
  const surgeLfo = ctx.createOscillator();
  const surgeDepth = ctx.createGain();
  surgeLfo.frequency.value = 0.06;
  surgeDepth.gain.value = 0.045;
  surgeLfo.connect(surgeDepth).connect(surge.gain);
  surgeLfo.start();
  noise.connect(noiseBp).connect(surge);
  surge.connect(reverbIn);
  surge.connect(master);
  noise.start();
  oscs.push(surgeLfo);
  sources.push(noise);

  const stop = () => {
    try {
      oscs.forEach((o) => o.stop());
      sources.forEach((s) => s.stop());
    } catch {
      /* already stopped */
    }
  };
  return { ctx, master, filter, stop };
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

  // descent: scrolling deeper pulls the low-pass darker (the sink toward the quantum core)
  useEffect(() => {
    if (!enabled) return;
    const onScroll = () => {
      const g = graphRef.current;
      if (!g) return;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const t = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      g.filter.frequency.setTargetAtTime(340 - 210 * t, g.ctx.currentTime, 0.5);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [enabled]);

  useEffect(() => () => graphRef.current?.stop(), []);

  return { enabled, toggle };
}
