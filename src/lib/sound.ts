let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(value: boolean) {
  enabled = value;
}

export function unlockAudio() {
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
}

function tone(freq: number, startSec: number, durSec: number, volume = 0.25) {
  if (!ctx || !enabled) return;
  const t0 = ctx.currentTime + startSec;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durSec);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + durSec + 0.02);
}

export const sounds = {
  success: () => tone(1800, 0, 0.08),
  unknown: () => {
    tone(600, 0, 0.12);
    tone(600, 0.18, 0.12);
  },
  warning: () => {
    tone(440, 0, 0.25);
    tone(330, 0.3, 0.35);
  },
};
