let audio: AudioContext | null = null;

function context(): AudioContext {
  audio ??= new AudioContext();
  if (audio.state === 'suspended') void audio.resume();
  return audio;
}

/** Soft, low tap for picking up a piece. */
export function playTap(): void {
  const ctx = context();
  const now = ctx.currentTime;
  const tone = ctx.createOscillator();
  tone.type = 'sine';
  tone.frequency.setValueAtTime(520, now);
  tone.frequency.exponentialRampToValueAtTime(300, now + 0.04);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.07, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
  tone.connect(gain).connect(ctx.destination);
  tone.start(now);
  tone.stop(now + 0.06);
}

/** Rising major arpeggio that rings out together, for a solved puzzle. */
export function playChime(): void {
  const ctx = context();
  const start = ctx.currentTime + 0.05;
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  notes.forEach((freq, i) => {
    const t = start + i * 0.11;
    const tone = ctx.createOscillator();
    tone.type = 'sine';
    tone.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    tone.connect(gain).connect(ctx.destination);
    tone.start(t);
    tone.stop(t + 1.7);
  });
}

/**
 * Plays a short wooden "click". Must be called from a user gesture the first
 * time, since browsers only allow audio to start after interaction.
 * `pitch` > 1 sounds higher; a lower click marks a piece locking onto the board.
 */
export function playClick(pitch = 1): void {
  const audio = context();
  const now = audio.currentTime;

  // A filtered noise burst gives the attack...
  const length = Math.floor(audio.sampleRate * 0.03);
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
  const noise = audio.createBufferSource();
  noise.buffer = buffer;
  const band = audio.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 2400 * pitch;
  band.Q.value = 1.2;
  const noiseGain = audio.createGain();
  noiseGain.gain.value = 0.5;
  noise.connect(band).connect(noiseGain).connect(audio.destination);

  // ...and a quickly decaying tone gives it body.
  const tone = audio.createOscillator();
  tone.type = 'triangle';
  tone.frequency.setValueAtTime(900 * pitch, now);
  tone.frequency.exponentialRampToValueAtTime(400 * pitch, now + 0.06);
  const toneGain = audio.createGain();
  toneGain.gain.setValueAtTime(0.18, now);
  toneGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  tone.connect(toneGain).connect(audio.destination);

  noise.start(now);
  tone.start(now);
  tone.stop(now + 0.1);
}
