export const loadAudio = (src) =>
  new Promise((resolve, reject) => {
    const audio = new Audio(src);
    audio.preload = 'auto';
    audio.oncanplaythrough = () => resolve(audio);
    audio.onerror = (event) => reject(event);
  });

export const playAudio = async (src, { loop = false, volume = 1.0 } = {}) => {
  const audio = await loadAudio(src);
  audio.loop = loop;
  audio.volume = volume;
  await audio.play();
  return audio;
};

export const stopAudio = (audio) => {
  if (!audio) return;
  audio.pause();
  audio.currentTime = 0;
};

export const setAudioVolume = (audio, volume) => {
  if (!audio) return;
  audio.volume = Math.min(Math.max(volume, 0), 1);
};

export const fadeAudio = async (audio, targetVolume, duration = 500) => {
  if (!audio) return;
  const start = audio.volume;
  const delta = targetVolume - start;
  const steps = Math.max(Math.floor(duration / 16), 1);
  for (let i = 1; i <= steps; i += 1) {
    audio.volume = Math.min(Math.max(start + (delta * i) / steps, 0), 1);
    await new Promise((resolve) => setTimeout(resolve, 16));
  }
  audio.volume = Math.min(Math.max(targetVolume, 0), 1);
};
