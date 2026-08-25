/**
 * A tiny synthesised sound engine.
 *
 * Everything is generated with the Web Audio API — there are no audio files, no network
 * requests and no third-party services. The context is created lazily on the first cue so
 * it always begins inside a user gesture, which is what browsers require.
 *
 * Every entry point is defensive: if Web Audio is missing (jsdom, older browsers, locked-down
 * devices) the engine degrades to silence instead of throwing into the game loop.
 */

export type SoundCue =
  | 'tick' // batch pulse
  | 'arm' // the market event fires
  | 'win'
  | 'lose'
  | 'fill'
  | 'select'
  | 'advance';

type Ctor = typeof AudioContext;

function getAudioContextCtor(): Ctor | null {
  if (typeof window === 'undefined') return null;
  // Safari only exposes the prefixed constructor, and jsdom exposes neither.
  const w = window as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

export function isSoundSupported(): boolean {
  return getAudioContextCtor() !== null;
}

interface Voice {
  /** Oscillator frequency in hertz at the start of the cue. */
  from: number;
  /** Frequency it glides to. Equal to `from` for a flat tone. */
  to: number;
  duration: number;
  type: OscillatorType;
  gain: number;
}

const VOICES: Record<SoundCue, Voice> = {
  tick: { from: 880, to: 880, duration: 0.04, type: 'square', gain: 0.05 },
  arm: { from: 300, to: 1100, duration: 0.16, type: 'sawtooth', gain: 0.11 },
  win: { from: 520, to: 1040, duration: 0.24, type: 'triangle', gain: 0.12 },
  lose: { from: 340, to: 120, duration: 0.3, type: 'sawtooth', gain: 0.1 },
  fill: { from: 660, to: 990, duration: 0.18, type: 'sine', gain: 0.12 },
  select: { from: 520, to: 620, duration: 0.07, type: 'triangle', gain: 0.08 },
  advance: { from: 440, to: 660, duration: 0.1, type: 'sine', gain: 0.08 },
};

let context: AudioContext | null = null;

function ensureContext(): AudioContext | null {
  const Ctor = getAudioContextCtor();
  if (!Ctor) return null;
  try {
    context ??= new Ctor();
    // Browsers park the context until a gesture; resuming here is a no-op when already running.
    if (context.state === 'suspended') void context.resume();
    return context;
  } catch {
    return null;
  }
}

/** Play one cue. Never throws, and does nothing at all when muted or unsupported. */
export function playCue(cue: SoundCue, muted: boolean): void {
  if (muted) return;

  const ctx = ensureContext();
  if (!ctx) return;

  try {
    const voice = VOICES[cue];
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();

    osc.type = voice.type;
    osc.frequency.setValueAtTime(voice.from, now);
    if (voice.to !== voice.from) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(voice.to, 1), now + voice.duration);
    }

    // Short attack, exponential release — keeps cues percussive rather than beepy.
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(voice.gain, now + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + voice.duration);

    osc.connect(amp).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + voice.duration + 0.02);
  } catch {
    /* a failed cue must never interrupt the game */
  }
}

/** Test seam: drop the cached context so each test starts clean. */
export function resetSoundEngine(): void {
  try {
    void context?.close();
  } catch {
    /* ignore */
  }
  context = null;
}
