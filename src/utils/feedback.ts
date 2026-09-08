import { getSetting, setSetting } from '../db/operations';

let cachedSoundHaptics: boolean | null = null;
let audioCtx: AudioContext | null = null;

/**
 * Lazily initialize and return the Web Audio Context
 */
function getAudioContext(): AudioContext | null {
  try {
    if (typeof window === 'undefined') return null;
    if (!audioCtx) {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        audioCtx = new AudioCtxClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Initialize sound & haptics preference from settings
 */
export async function initSoundHapticsSetting(): Promise<boolean> {
  if (cachedSoundHaptics !== null) return cachedSoundHaptics;
  try {
    const val = await getSetting<boolean>('soundHapticsEnabled', true);
    cachedSoundHaptics = val;
    return val;
  } catch {
    cachedSoundHaptics = true;
    return true;
  }
}

export function isSoundHapticsEnabled(): boolean {
  if (cachedSoundHaptics === null) {
    // Default to true
    return true;
  }
  return cachedSoundHaptics;
}

export async function setSoundHapticsSetting(enabled: boolean): Promise<void> {
  cachedSoundHaptics = enabled;
  try {
    await setSetting('soundHapticsEnabled', enabled);
  } catch (err) {
    console.warn('Failed to save soundHaptics setting:', err);
  }
}

/**
 * Lightweight Web Audio tone for a correct answer or card mastery.
 * Pure oscillator tone (~200ms) with gentle sine envelope — no external audio files or CDN.
 */
export function playSuccessSound(): void {
  if (!isSoundHapticsEnabled()) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Gentle cheerful two-tone transition: 587Hz (D5) -> 880Hz (A5)
    osc.frequency.setValueAtTime(587.33, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);

    // Smooth gain envelope: instant quiet rise to 0.12, decaying to zero by 200ms
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.22);
  } catch {
    // AudioContext autoplay restrictions: silently no-op
  }
}

/**
 * Haptic feedback: navigator.vibrate(30) guarded by feature detection.
 * Silently no-ops on browsers without vibration support (e.g., iOS Safari).
 */
export function triggerHaptic(): void {
  if (!isSoundHapticsEnabled()) return;

  try {
    if (
      typeof navigator !== 'undefined' &&
      'vibrate' in navigator &&
      typeof navigator.vibrate === 'function'
    ) {
      navigator.vibrate(30);
    }
  } catch {
    // Silently no-op
  }
}

/**
 * Combined audio + haptic cue for correct answers and mastered cards
 */
export function triggerSuccessFeedback(): void {
  playSuccessSound();
  triggerHaptic();
}
