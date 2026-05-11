// Web Audio synthesized tones. Avoids shipping audio files; tones play instantly
// after the first user gesture (mobile browsers block autoplay before that).
//
// Swap for <audio src="/sounds/alert.mp3"/> by replacing the play* functions
// below if you drop real files in /public/sounds/ later.

let ctx: AudioContext | null = null;
let unlocked = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

export async function unlockAudio(): Promise<boolean> {
  const c = getCtx();
  if (!c) return false;
  try {
    if (c.state === "suspended") await c.resume();
    unlocked = c.state === "running";
    return unlocked;
  } catch {
    return false;
  }
}

export function isAudioUnlocked(): boolean {
  return unlocked && getCtx()?.state === "running";
}

function beep(freq: number, durMs: number, type: OscillatorType = "sine", gain = 0.15) {
  const c = getCtx();
  if (!c || c.state !== "running") return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, c.currentTime);
  g.gain.linearRampToValueAtTime(gain, c.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + durMs / 1000);
  osc.connect(g).connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + durMs / 1000 + 0.02);
}

export function playOneAwayAlert() {
  // Two quick high beeps — "ding-ding"
  beep(1320, 140, "sine", 0.18);
  setTimeout(() => beep(1760, 180, "sine", 0.18), 150);
}

export function playWinFanfare() {
  // Ascending arpeggio C-E-G-C
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((f, i) => setTimeout(() => beep(f, 250, "triangle", 0.22), i * 130));
  setTimeout(() => beep(1318.5, 600, "triangle", 0.2), notes.length * 130 + 80);
}

export function playTick() {
  // Soft tick used on /tv when a number is called.
  beep(880, 90, "sine", 0.1);
}
