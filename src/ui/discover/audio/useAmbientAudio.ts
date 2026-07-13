/**
 * Procedural ambient sound, generated with the Web Audio API (no audio file shipped,
 * no copyright surface, genuinely "sound design"). The character is SPACE + MARINE +
 * MEDITATIVE:
 *   space     , a deep sub, slowly rotating fifths, and a faint high shimmer;
 *   marine    , a breathing wave-surge of filtered noise under a dark low-pass;
 *   meditative, slow harmonic changes, soft bell glints, no beat, nothing rhythmic.
 * The low-pass `filter` is left exposed on the graph so the descent can later pull it
 * darker as you sink toward the quantum core.
 *
 * MUTED BY DEFAULT. The AudioContext is created only on a user gesture (the toggle
 * click or the run-start), satisfying browser autoplay policy. Preference persists in
 * localStorage but never auto-starts without a gesture. Once started, it keeps playing
 * while the user switches tabs or apps; only the user mute control stops it.
 */
import { useCallback, useEffect, useRef, useState } from "react";

const KEY = "nebula.audio";

type Mood = "bio" | "cell" | "field" | "redox" | "light";
type Graph = {
  ctx: AudioContext;
  master: GainNode;
  filter: BiquadFilterNode;
  moodBase: number;
  setMood: (mood: Mood) => void;
  stop: () => void;
};

const ROOTS = [55, 61.74, 48.99, 65.41] as const;
const MOODS: Record<Mood, { rootOffset: number; filter: number; q: number; noise: number; wet: number; shimmer: number }> = {
  bio: { rootOffset: 0, filter: 380, q: 0.75, noise: 520, wet: 0.46, shimmer: 0.012 },
  cell: { rootOffset: 1, filter: 460, q: 0.9, noise: 620, wet: 0.52, shimmer: 0.017 },
  field: { rootOffset: 2, filter: 330, q: 1.15, noise: 430, wet: 0.62, shimmer: 0.01 },
  redox: { rootOffset: 3, filter: 420, q: 0.82, noise: 740, wet: 0.42, shimmer: 0.02 },
  light: { rootOffset: 1, filter: 560, q: 0.68, noise: 880, wet: 0.5, shimmer: 0.026 },
};

function buildGraph(): Graph {
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctor();
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);

  const oscs: OscillatorNode[] = [];
  const sources: AudioScheduledSourceNode[] = [];
  const timers: number[] = [];
  let graph: Graph;
  let disposed = false;
  const rand = (a: number, b: number) => a + Math.random() * (b - a);

  // --- larger feedback-delay reverb: four cross-coupled taps + longer, damped tail ---
  const wet = ctx.createGain();
  wet.gain.value = 0.5;
  wet.connect(master);
  const reverbIn = ctx.createGain();
  const damp = ctx.createBiquadFilter();
  damp.type = "lowpass";
  damp.frequency.value = 1100;
  const delays = [0.33, 0.47, 0.61, 0.73].map((t) => {
    const d = ctx.createDelay(1.5);
    d.delayTime.value = t;
    return d;
  });
  delays.forEach((d, i) => {
    reverbIn.connect(d);
    const fb = ctx.createGain();
    fb.gain.value = 0.44 - i * 0.03; // longer taps decay a little faster → a tail, not a runaway
    d.connect(fb).connect(delays[(i + 1) % delays.length]); // cross-couple for density
    d.connect(damp);
  });
  damp.connect(wet);

  // --- Haas stereo width (feature-guarded): a short delay on one side widens the field ---
  const hasPanner = typeof ctx.createStereoPanner === "function";

  // --- dark, slowly sweeping low-pass: the body (exposed for the scroll descent) ---
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 340;
  filter.Q.value = 0.8;
  filter.connect(master);
  filter.connect(reverbIn);

  const bodyLfo = ctx.createOscillator();
  const bodyLfoGain = ctx.createGain();
  bodyLfo.frequency.value = 0.04;
  bodyLfoGain.gain.value = 170;
  bodyLfo.connect(bodyLfoGain).connect(filter.frequency);
  bodyLfo.start();
  oscs.push(bodyLfo);

  // --- the pad: each chord tone is a small UNISON of detuned, filtered saw/tri voices.
  //     Real (non-integer) detune + per-voice amplitude & detune LFOs give chorus + beating,
  //     which is exactly the movement the old pure-sine, integer-truncated stack lacked. ---
  type Voice = { osc: OscillatorNode; gain: GainNode; vf: BiquadFilterNode; ratio: number };
  const voices: Voice[] = [];
  const VOICING: { ratio: number; gain: number; type: OscillatorType }[] = [
    { ratio: 0.5, gain: 0.11, type: "sawtooth" },
    { ratio: 1, gain: 0.10, type: "sawtooth" },
    { ratio: 1.5, gain: 0.08, type: "triangle" },
    { ratio: 2, gain: 0.05, type: "triangle" },
    { ratio: 3, gain: 0.03, type: "sine" },
  ];
  const UNISON = 3;
  let chord = 0;
  VOICING.forEach((v) => {
    for (let u = 0; u < UNISON; u++) {
      const o = ctx.createOscillator();
      o.type = v.type;
      o.frequency.value = ROOTS[0] * v.ratio;
      o.detune.value = rand(-7, 7) + (u - 1) * 4.5; // real spread, NO |0 truncation
      const vf = ctx.createBiquadFilter();
      vf.type = "lowpass";
      vf.frequency.value = 620 + v.ratio * 120;
      vf.Q.value = 0.6;
      const g = ctx.createGain();
      g.gain.value = (v.gain / UNISON) * rand(0.85, 1.15);
      const tail: AudioNode = g;
      o.connect(vf).connect(g);
      if (hasPanner) {
        const pan = ctx.createStereoPanner();
        pan.pan.value = ((u - (UNISON - 1) / 2) / Math.max(1, (UNISON - 1) / 2)) * 0.35;
        tail.connect(pan).connect(filter);
      } else {
        tail.connect(filter);
      }
      o.start(ctx.currentTime + u * 0.06 + v.ratio * 0.02); // staggered starts
      oscs.push(o);
      voices.push({ osc: o, gain: g, vf, ratio: v.ratio });

      // independent slow amplitude LFO (each voice breathes on its own clock)
      const aLfo = ctx.createOscillator();
      const aDepth = ctx.createGain();
      aLfo.frequency.value = rand(0.03, 0.09);
      aDepth.gain.value = g.gain.value * 0.5;
      aLfo.connect(aDepth).connect(g.gain);
      aLfo.start();
      oscs.push(aLfo);

      // independent slow detune LFO (adds shimmer/beating movement)
      const dLfo = ctx.createOscillator();
      const dDepth = ctx.createGain();
      dLfo.frequency.value = rand(0.02, 0.06);
      dDepth.gain.value = rand(2, 6);
      dLfo.connect(dDepth).connect(o.detune);
      dLfo.start();
      oscs.push(dLfo);
    }
  });

  // --- generative drift: re-voice the chord at IRREGULAR intervals over long ramps,
  //     replacing the old metronomic 14s hard cycle. ---
  const drift = () => {
    if (disposed) return;
    chord = (chord + 1 + Math.floor(Math.random() * (ROOTS.length - 1))) % ROOTS.length;
    const root = ROOTS[chord];
    const now = ctx.currentTime;
    const ramp = rand(8, 15);
    voices.forEach((voice, i) => {
      voice.osc.frequency.cancelScheduledValues(now);
      voice.osc.frequency.setValueAtTime(voice.osc.frequency.value, now);
      voice.osc.frequency.exponentialRampToValueAtTime(root * voice.ratio, now + ramp + (i % UNISON) * 0.4);
    });
    timers.push(window.setTimeout(drift, rand(18, 34) * 1000));
  };
  timers.push(window.setTimeout(drift, rand(18, 26) * 1000));

  // --- shimmer: barely-there upper partials that drift in and out ---
  const shimmer = ctx.createOscillator();
  shimmer.type = "triangle";
  shimmer.frequency.value = 523.25;
  const shimmerGain = ctx.createGain();
  shimmerGain.gain.value = 0.008;
  const shimmerLfo = ctx.createOscillator();
  const shimmerDepth = ctx.createGain();
  shimmerLfo.frequency.value = 0.017;
  shimmerDepth.gain.value = 0.018;
  shimmerLfo.connect(shimmerDepth).connect(shimmerGain.gain);
  shimmer.connect(shimmerGain).connect(reverbIn);
  shimmer.start();
  shimmerLfo.start();
  oscs.push(shimmer, shimmerLfo);

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

  // --- soft glints: sparse bell tones, meditative rather than melodic ---
  const playBell = () => {
    const now = ctx.currentTime;
    const root = ROOTS[chord];
    const ratios = [3, 4.5, 6, 8] as const;
    const bell = ctx.createOscillator();
    bell.type = "sine";
    bell.frequency.value = root * ratios[Math.floor(Math.random() * ratios.length)];
    const bellFilter = ctx.createBiquadFilter();
    bellFilter.type = "bandpass";
    bellFilter.frequency.value = bell.frequency.value;
    bellFilter.Q.value = 7;
    const bellGain = ctx.createGain();
    bellGain.gain.setValueAtTime(0, now);
    bellGain.gain.linearRampToValueAtTime(0.034, now + 0.08);
    bellGain.gain.exponentialRampToValueAtTime(0.0001, now + 5.8);
    bell.connect(bellFilter).connect(bellGain);
    bellGain.connect(reverbIn);
    bell.start(now);
    bell.stop(now + 6.2);
  };
  timers.push(window.setInterval(playBell, rand(8, 12) * 1000));

  const setMood = (mood: Mood) => {
    const settings = MOODS[mood] ?? MOODS.bio;
    const now = ctx.currentTime;
    graph.moodBase = settings.filter;
    filter.frequency.setTargetAtTime(settings.filter, now, 1.4);
    filter.Q.setTargetAtTime(settings.q, now, 1.8);
    noiseBp.frequency.setTargetAtTime(settings.noise, now, 2.2);
    wet.gain.setTargetAtTime(settings.wet, now, 2.8);
    shimmerGain.gain.setTargetAtTime(settings.shimmer, now, 3.2);
    // nudge timbre + space, not just the root: brighter moods open the per-voice lowpass
    voices.forEach((voice) => {
      voice.vf.frequency.setTargetAtTime((520 + voice.ratio * 120) * (0.7 + settings.wet), now, 3.4);
    });
    const root = ROOTS[(chord + settings.rootOffset) % ROOTS.length];
    voices.forEach((voice, index) => {
      voice.osc.frequency.cancelScheduledValues(now);
      voice.osc.frequency.setValueAtTime(voice.osc.frequency.value, now);
      voice.osc.frequency.exponentialRampToValueAtTime(root * voice.ratio, now + 6.4 + (index % UNISON) * 0.2);
    });
  };

  const stop = () => {
    disposed = true;
    try {
      oscs.forEach((o) => o.stop());
      sources.forEach((s) => s.stop());
      timers.forEach((t) => {
        window.clearTimeout(t);
        window.clearInterval(t);
      });
    } catch {
      /* already stopped */
    }
  };
  graph = { ctx, master, filter, moodBase: 340, setMood, stop };
  return graph;
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
        return; // Web Audio unavailable, silently no-op
      }
    }
    void graphRef.current.ctx.resume();
    fadeTo(0.12);
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

  useEffect(() => {
    const onMood = (event: Event) => {
      const mood = (event as CustomEvent<{ mood?: Mood }>).detail?.mood;
      if (!mood) return;
      graphRef.current?.setMood(mood);
    };
    window.addEventListener("nebula:world-mood", onMood);
    return () => window.removeEventListener("nebula:world-mood", onMood);
  }, []);

  // descent: scrolling deeper pulls the low-pass darker (the sink toward the quantum core)
  useEffect(() => {
    if (!enabled) return;
    const onScroll = () => {
      const g = graphRef.current;
      if (!g) return;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const t = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      g.filter.frequency.setTargetAtTime(Math.max(120, g.moodBase - 210 * t), g.ctx.currentTime, 0.5);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [enabled]);

  useEffect(() => () => {
    const graph = graphRef.current;
    if (!graph) return;
    graph.stop();
    void graph.ctx.close();
    graphRef.current = null;
  }, []);

  return { enabled, toggle };
}
