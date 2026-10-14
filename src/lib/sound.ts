/** 轻量 WebAudio 音效（无外部音频资源） */

let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(v: boolean) {
  enabled = v;
  if (!v && typeof window !== 'undefined' && 'speechSynthesis' in window) {
    // 只关音效，不影响 TTS
  }
}

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, t0: number, dur: number, type: OscillatorType = 'sine', gain = 0.12) {
  const c = ac();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, c.currentTime + t0);
  g.gain.linearRampToValueAtTime(gain, c.currentTime + t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(c.currentTime + t0);
  osc.stop(c.currentTime + t0 + dur + 0.05);
}

/** 消除成功：上行琶音 */
export function playCorrect(combo = 1) {
  if (!enabled) return;
  const base = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  const step = Math.min(combo - 1, 3);
  tone(base[step], 0, 0.16, 'triangle');
  tone(base[Math.min(step + 1, 3)], 0.09, 0.2, 'triangle');
}

/** 读错：低沉短音 */
export function playWrong() {
  if (!enabled) return;
  tone(220, 0, 0.18, 'sawtooth', 0.07);
  tone(180, 0.12, 0.22, 'sawtooth', 0.06);
}

/** 通关/波次奖励 */
export function playWin() {
  if (!enabled) return;
  [523.25, 587.33, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.1, 0.25, 'triangle'));
}

/** 按钮轻点 */
export function playTap() {
  if (!enabled) return;
  tone(660, 0, 0.08, 'square', 0.05);
}

/** 洗牌 */
export function playShuffle() {
  if (!enabled) return;
  for (let i = 0; i < 5; i++) tone(500 + i * 80, i * 0.05, 0.07, 'sine', 0.05);
}
