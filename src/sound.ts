let audio: AudioContext | null = null;

/**
 * Plays a short wooden "click". Must be called from a user gesture the first
 * time, since browsers only allow audio to start after interaction.
 * `pitch` > 1 sounds higher; a lower click marks a piece locking onto the board.
 */
export function playClick(pitch = 1): void {
  audio ??= new AudioContext();
  if (audio.state === 'suspended') void audio.resume();
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
