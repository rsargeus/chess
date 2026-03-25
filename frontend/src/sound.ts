let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    // iOS/Android require AudioContext to be resumed inside a user gesture.
    // Listen for the first pointer interaction and unlock once.
    const unlock = () => {
      ctx?.resume();
      document.removeEventListener('pointerdown', unlock, true);
      document.removeEventListener('touchstart',  unlock, true);
    };
    document.addEventListener('pointerdown', unlock, true);
    document.addEventListener('touchstart',  unlock, true);
  }
  // Resume if suspended (e.g. tab was backgrounded)
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// Short wooden thud — like a chess piece placed on a board
function woodThud(time: number, vol = 0.6, pitch = 180): void {
  const ac = getCtx();

  // Low thud
  const osc = ac.createOscillator();
  const oscGain = ac.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(pitch, time);
  osc.frequency.exponentialRampToValueAtTime(pitch * 0.4, time + 0.06);
  oscGain.gain.setValueAtTime(vol, time);
  oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
  osc.connect(oscGain);
  oscGain.connect(ac.destination);
  osc.start(time);
  osc.stop(time + 0.15);

  // Woody click (filtered noise)
  const bufLen = Math.floor(ac.sampleRate * 0.04);
  const buf = ac.createBuffer(1, bufLen, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / bufLen);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const lpf = ac.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.value = 1200;
  const nGain = ac.createGain();
  nGain.gain.setValueAtTime(vol * 0.4, time);
  src.connect(lpf);
  lpf.connect(nGain);
  nGain.connect(ac.destination);
  src.start(time);
}

// Regular move
export function playMove(): void {
  woodThud(getCtx().currentTime, 0.5, 200);
}

// Capture — heavier thud
export function playCapture(): void {
  const ac = getCtx();
  woodThud(ac.currentTime, 0.7, 140);
  woodThud(ac.currentTime + 0.04, 0.4, 110);
}

// Check — clean high ding
export function playCheck(): void {
  const ac = getCtx();
  [880, 1100].forEach((f, i) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f, ac.currentTime + i * 0.07);
    gain.gain.setValueAtTime(0.3, ac.currentTime + i * 0.07);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + i * 0.07 + 0.5);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(ac.currentTime + i * 0.07);
    osc.stop(ac.currentTime + i * 0.07 + 0.5);
  });
}

// Game over — two descending notes like chess.com
export function playGameOver(): void {
  const ac = getCtx();
  [523, 392].forEach((f, i) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f, ac.currentTime + i * 0.3);
    gain.gain.setValueAtTime(0.4, ac.currentTime + i * 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + i * 0.3 + 0.6);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(ac.currentTime + i * 0.3);
    osc.stop(ac.currentTime + i * 0.3 + 0.7);
  });
}
