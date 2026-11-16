// Sound only: tiny WebAudio synth, no audio files. Every effect is an oscillator or filtered
// noise burst built at boot; nothing here touches the game state. The context is created on the
// first user gesture (browsers block audio before that) and stays muted until then.
export function createSound() {
  let context = null;
  let master = null;
  let muted = false;
  let noiseBuffer = null;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume();
      return true;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.32;
      master.connect(context.destination);
      noiseBuffer = context.createBuffer(1, context.sampleRate * 0.4, context.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!context || muted) return;
    const now = context.currentTime;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), now + dur);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + dur);
  }

  function noise(dur, vol, cutoff) {
    if (!context || muted) return;
    const now = context.currentTime;
    const source = context.createBufferSource();
    source.buffer = noiseBuffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = context.createGain();
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(now);
    source.stop(now + dur);
  }

  return {
    /** Call from any user gesture; safe to call every frame. */
    unlock() {
      ensure();
    },
    shoot() {
      tone(880, 0.07, 'square', 0.10, 440);
    },
    hit() {
      noise(0.18, 0.22, 900);
    },
    explode() {
      noise(0.35, 0.30, 700);
      tone(160, 0.3, 'sawtooth', 0.16, 40);
    },
    hurt() {
      tone(220, 0.25, 'sawtooth', 0.22, 55);
      noise(0.2, 0.18, 500);
    },
    pickup() {
      tone(660, 0.09, 'sine', 0.18);
      setTimeout(() => tone(990, 0.12, 'sine', 0.18), 70);
    },
    wave() {
      tone(330, 0.18, 'triangle', 0.20, 660);
    },
    over() {
      tone(392, 0.22, 'triangle', 0.20, 196);
      setTimeout(() => tone(262, 0.4, 'triangle', 0.20, 131), 200);
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
  };
}
