import { afterEach, describe, expect, it, vi } from 'vitest';
import { isSoundSupported, playCue, resetSoundEngine } from './sound';

afterEach(() => {
  resetSoundEngine();
  vi.unstubAllGlobals();
});

describe('sound engine', () => {
  it('reports no support when the browser has no Web Audio', () => {
    // jsdom ships neither AudioContext nor the webkit-prefixed constructor.
    expect(isSoundSupported()).toBe(false);
  });

  it('stays silent and does not throw when Web Audio is unavailable', () => {
    expect(() => playCue('win', false)).not.toThrow();
  });

  it('does nothing at all when muted', () => {
    const ctor = vi.fn();
    vi.stubGlobal('AudioContext', ctor);

    playCue('win', true);

    expect(ctor).not.toHaveBeenCalled();
  });

  it('synthesises a cue when Web Audio is available', () => {
    const oscillator = {
      type: '',
      frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
    const gain = {
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
    };
    oscillator.connect.mockReturnValue(gain);
    gain.connect.mockReturnValue({});

    const instance = {
      state: 'running',
      currentTime: 0,
      createOscillator: vi.fn().mockReturnValue(oscillator),
      createGain: vi.fn().mockReturnValue(gain),
      destination: {},
      resume: vi.fn(),
      close: vi.fn(),
    };
    vi.stubGlobal(
      'AudioContext',
      vi.fn(() => instance),
    );

    playCue('fill', false);

    expect(instance.createOscillator).toHaveBeenCalledOnce();
    expect(oscillator.start).toHaveBeenCalledOnce();
    expect(oscillator.stop).toHaveBeenCalledOnce();
  });

  it('swallows a failure inside the audio graph rather than breaking the game', () => {
    vi.stubGlobal(
      'AudioContext',
      vi.fn(() => ({
        state: 'running',
        currentTime: 0,
        createOscillator: () => {
          throw new Error('audio hardware went away');
        },
        createGain: vi.fn(),
        destination: {},
        resume: vi.fn(),
        close: vi.fn(),
      })),
    );

    expect(() => playCue('tick', false)).not.toThrow();
  });
});
