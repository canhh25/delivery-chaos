// Audio helpers for Delivery Chaos (no external assets; synthesized WebAudio).
// Provides:
// - initAudio(): create AudioContext after a user gesture
// - BGM.start()/stop(): background "lo-fi" synth
// - Sfx.uiConfirm()/collision()/engineOn()/engineUpdate()/engineOff()

let audioCtx = null;
let masterGain = null;

let noiseBuffer = null;

let audioRunningPromise = null;

let bgm = {
  playing: false,
  intervalId: null,
  nextTime: 0,
  gain: null,
};

let engine = {
  active: false,
  osc: null,
  filter: null,
  gain: null,
};

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function semitoneToFreq(semitoneFromA4) {
  // A4 = 440Hz, semitone offset can be negative/positive.
  return 440 * Math.pow(2, semitoneFromA4 / 12);
}

function ensureAudioReady() {
  return !!audioCtx && !!masterGain;
}

function ensureAudioRunning() {
  if (!audioCtx) return Promise.resolve();
  if (audioCtx.state === 'running') return Promise.resolve();
  try {
    if (!audioRunningPromise) audioRunningPromise = audioCtx.resume();
    return audioRunningPromise || Promise.resolve();
  } catch {
    return Promise.resolve();
  }
}

function createNoiseBuffer() {
  // Precreate a short noise buffer to avoid heavy allocations on every collision.
  const durationSec = 0.25;
  const length = Math.floor(audioCtx.sampleRate * durationSec);
  const buffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function playOneShotTone(freq, durationSec, { type = 'triangle', gain = 0.25 } = {}) {
  if (!ensureAudioReady()) return;
  const t = audioCtx.currentTime;

  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1200, t);

  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);

  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + durationSec);

  osc.connect(filter);
  filter.connect(g);
  g.connect(masterGain);

  osc.start(t);
  osc.stop(t + durationSec + 0.02);
}

function playNoiseBurst({ durationSec = 0.12, volume = 0.35, tone = 120 } = {}) {
  if (!ensureAudioReady()) return;
  const t = audioCtx.currentTime;

  const source = audioCtx.createBufferSource();
  source.buffer = noiseBuffer;

  const filter = audioCtx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(tone, t);
  filter.Q.setValueAtTime(6, t);

  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + durationSec);

  source.connect(filter);
  filter.connect(g);
  g.connect(masterGain);

  source.start(t);
  source.stop(t + durationSec + 0.02);
}

function ensureEngineNodes() {
  if (engine.osc) return;

  engine.osc = audioCtx.createOscillator();
  engine.osc.type = 'sawtooth';

  engine.filter = audioCtx.createBiquadFilter();
  engine.filter.type = 'lowpass';
  engine.filter.frequency.setValueAtTime(900, audioCtx.currentTime);

  engine.gain = audioCtx.createGain();
  engine.gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);

  engine.osc.connect(engine.filter);
  engine.filter.connect(engine.gain);
  engine.gain.connect(masterGain);

  engine.osc.start();
}

export function initAudio() {
  if (audioCtx) return;

  const Ctx = window.AudioContext || window.webkitAudioContext;
  audioCtx = new Ctx();

  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.65;
  masterGain.connect(audioCtx.destination);

  noiseBuffer = createNoiseBuffer();

  // Background music routed through a dedicated gain so we can fade.
  bgm.gain = audioCtx.createGain();
  bgm.gain.gain.value = 0.0;
  bgm.gain.connect(masterGain);

  // Important: on some browsers, even after user gesture, the context can still be "suspended".
  if (audioCtx.state === 'suspended') {
    audioRunningPromise = audioCtx.resume().catch(() => {});
  }
}

export const BGM = {
  start() {
    if (!ensureAudioReady()) return;
    if (bgm.playing) return;

    bgm.playing = true;

    // Ensure context is running before scheduling oscillators.
    ensureAudioRunning().then(() => {
      if (!bgm.playing) return;

      // Fade in.
      const t = audioCtx.currentTime;
      bgm.gain.gain.cancelScheduledValues(t);
      bgm.gain.gain.setValueAtTime(0.0001, t);
      bgm.gain.gain.exponentialRampToValueAtTime(0.26, t + 1.0);

      // A very small synth "progression" loop: low tempo.
      const scale = [0, 3, 7, 10]; // minor-ish
      const roots = [0, 5, 3, 7]; // degrees offsets
      const tempoMs = 220;
      const beatsPerStep = 0.55; // affects scheduling rhythm feel

      const scheduleStep = () => {
        const now = audioCtx.currentTime;
        // Schedule a short chord each tick.
        const stepDur = tempoMs / 1000;

        // Drift correction if tab hiccups.
        if (bgm.nextTime < now) bgm.nextTime = now;

        const rootDeg = roots[Math.floor((bgm.nextTime / stepDur) % roots.length)];
        const baseA4Offset = -9; // shift base toward lower range

        // Build 3 notes from the scale.
        const chord = [
          scale[0] + rootDeg,
          scale[1] + rootDeg,
          scale[2] + rootDeg + 2,
        ];

        for (let i = 0; i < chord.length; i++) {
          const semitone = baseA4Offset + chord[i];
          const freq = semitoneToFreq(semitone);

          const osc = audioCtx.createOscillator();
          const g = audioCtx.createGain();
          const filter = audioCtx.createBiquadFilter();

          osc.type = i === 0 ? 'triangle' : 'sine';
          osc.frequency.setValueAtTime(freq, bgm.nextTime);

          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(1200 + i * 320, bgm.nextTime);
          filter.Q.setValueAtTime(0.65, bgm.nextTime);

          g.gain.setValueAtTime(0.0001, bgm.nextTime);
          g.gain.exponentialRampToValueAtTime(0.16 / (i + 1), bgm.nextTime + 0.02);
          g.gain.exponentialRampToValueAtTime(
            0.0001,
            bgm.nextTime + stepDur * beatsPerStep + 0.02
          );

          osc.connect(filter);
          filter.connect(g);
          g.connect(bgm.gain);

          osc.start(bgm.nextTime);
          osc.stop(bgm.nextTime + stepDur * beatsPerStep + 0.05);
        }

        bgm.nextTime += stepDur;
      };

      bgm.nextTime = audioCtx.currentTime + 0.06;
      scheduleStep();
      bgm.intervalId = window.setInterval(scheduleStep, tempoMs);
    });
  },

  stop() {
    if (!bgm.playing) return;
    bgm.playing = false;

    if (bgm.intervalId) window.clearInterval(bgm.intervalId);
    bgm.intervalId = null;

    const t = audioCtx.currentTime;
    bgm.gain.gain.cancelScheduledValues(t);
    bgm.gain.gain.setValueAtTime(Math.max(0.0001, bgm.gain.gain.value), t);
    bgm.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
  },
};

export const Sfx = {
  uiConfirm() {
    // Simple "click" confirmation sound.
    playOneShotTone(660, 0.06, { type: 'triangle', gain: 0.22 });
  },

  redLightPenalty() {
    // Warning + penalty "beep" when money is deducted.
    if (!ensureAudioReady()) return;
    ensureAudioRunning().catch(() => {});

    playNoiseBurst({ durationSec: 0.12, volume: 0.28, tone: 900 });
    playOneShotTone(520, 0.10, { type: 'triangle', gain: 0.22 });

    // Second short beep for emphasis.
    playOneShotTone(440, 0.09, { type: 'triangle', gain: 0.18 });
  },

  orderPickup() {
    // Pickup chime: quick rising notes.
    if (!ensureAudioReady()) return;
    ensureAudioRunning().catch(() => {});

    playOneShotTone(523.25, 0.06, { type: 'triangle', gain: 0.18 }); // C5
    playOneShotTone(659.25, 0.06, { type: 'sine', gain: 0.14 }); // E5
    playOneShotTone(783.99, 0.08, { type: 'sine', gain: 0.12 }); // G5
  },

  orderDeliverSuccess() {
    // Victory stinger: short arpeggio + soft noise sparkle.
    if (!ensureAudioReady()) return;
    ensureAudioRunning().catch(() => {});

    // Sparkle
    playNoiseBurst({ durationSec: 0.08, volume: 0.22, tone: 2400 });

    // Arpeggio
    const tones = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    for (let i = 0; i < tones.length; i++) {
      // Stagger by a tiny offset by using different start times via currentTime.
      // We'll approximate with short, slightly different lengths.
      playOneShotTone(tones[i], 0.06 + i * 0.01, { type: i === 3 ? 'sine' : 'triangle', gain: 0.14 - i * 0.02 });
    }
  },

  collision(kind = 'Vehicle') {
    // Different noise color for different collision types.
    // This is synthesized, but still gives clear feedback.
    if (!ensureAudioReady()) return;
    ensureAudioRunning().catch(() => {});

    if (kind === 'Vehicle') {
      playNoiseBurst({ durationSec: 0.18, volume: 0.58, tone: 170 });
      playOneShotTone(95, 0.14, { type: 'sine', gain: 0.25 });
      playOneShotTone(240, 0.07, { type: 'triangle', gain: 0.18 });
    } else if (kind === 'Building') {
      playNoiseBurst({ durationSec: 0.2, volume: 0.48, tone: 105 });
      playOneShotTone(75, 0.18, { type: 'sine', gain: 0.22 });
    } else if (kind === 'Animal') {
      // Slightly "softer" thud.
      playNoiseBurst({ durationSec: 0.16, volume: 0.36, tone: 145 });
      playOneShotTone(105, 0.11, { type: 'triangle', gain: 0.2 });
    } else {
      playNoiseBurst({ durationSec: 0.16, volume: 0.46, tone: 120 });
    }
  },

  engineOn() {
    if (!ensureAudioReady()) return;
    ensureEngineNodes();
    engine.active = true;
    engine.gain.gain.cancelScheduledValues(audioCtx.currentTime);
    engine.gain.gain.setTargetAtTime(0.02, audioCtx.currentTime, 0.05);
  },

  engineUpdate(speed) {
    if (!ensureAudioReady()) return;
    if (!engine.osc) return;

    // Matter velocities are "small", so normalize with a forgiving curve.
    const v = clamp(speed, 0, 4);
    const factor = Math.pow(v / 4, 0.65); // smooth ramp

    const freq = 110 + factor * 260; // pitch
    const vol = 0.015 + factor * 0.11; // loudness
    const cutoff = 420 + factor * 2200;

    const t = audioCtx.currentTime;
    engine.osc.frequency.setTargetAtTime(freq, t, 0.06);
    engine.filter.frequency.setTargetAtTime(cutoff, t, 0.06);
    engine.gain.gain.setTargetAtTime(vol, t, 0.08);
  },

  engineOff() {
    if (!ensureAudioReady()) return;
    if (!engine.osc) return;
    engine.active = false;
    engine.gain.gain.setTargetAtTime(0.0001, audioCtx.currentTime, 0.06);
  },
};

