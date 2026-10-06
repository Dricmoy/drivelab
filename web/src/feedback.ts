// Quiet, opt-in interface feedback. Never represents simulation success/failure.
let audio: AudioContext | null = null;
let lastClick = 0;
export function clickSound() {
  const now = performance.now();
  if (now - lastClick < 45) return;
  lastClick = now;
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') void audio.resume();
    const oscillator = audio.createOscillator(), gain = audio.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(820, audio.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(320, audio.currentTime + .035);
    gain.gain.setValueAtTime(.0001, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(.045, audio.currentTime + .004);
    gain.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + .045);
    oscillator.connect(gain); gain.connect(audio.destination);
    oscillator.start(); oscillator.stop(audio.currentTime + .05);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  } catch { /* Sound is optional; unsupported audio must never interrupt controls. */ }
}
