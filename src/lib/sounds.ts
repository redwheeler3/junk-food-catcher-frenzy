const audioCtx = () => {
  if (!(window as any).__gameAudioCtx) {
    (window as any).__gameAudioCtx = new AudioContext();
  }
  return (window as any).__gameAudioCtx as AudioContext;
};

export const playEatSound = (good: boolean) => {
  const ctx = audioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  if (good) {
    // Happy chomp sound
    osc.type = "square";
    osc.frequency.setValueAtTime(300, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.08);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  } else {
    // Yuck sound
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.25);
  }
};

export const playFartSound = () => {
  const ctx = audioCtx();
  const t = ctx.currentTime;

  // Create noise buffer for realistic texture
  const bufferSize = ctx.sampleRate * 0.6;
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    noiseData[i] = Math.random() * 2 - 1;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;

  // Bandpass filter to shape the noise into a "flappy" rumble
  const bpFilter = ctx.createBiquadFilter();
  bpFilter.type = "bandpass";
  bpFilter.frequency.setValueAtTime(120, t);
  bpFilter.frequency.linearRampToValueAtTime(60, t + 0.2);
  bpFilter.frequency.linearRampToValueAtTime(100, t + 0.35);
  bpFilter.frequency.linearRampToValueAtTime(40, t + 0.55);
  bpFilter.Q.setValueAtTime(3, t);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.3, t);
  noiseGain.gain.linearRampToValueAtTime(0.45, t + 0.08);
  noiseGain.gain.linearRampToValueAtTime(0.2, t + 0.3);
  noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.55);

  noise.connect(bpFilter);
  bpFilter.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noise.start(t);
  noise.stop(t + 0.55);

  // Sub-bass rumble oscillator with wobble
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = "sawtooth";
  osc1.frequency.setValueAtTime(75, t);
  osc1.frequency.linearRampToValueAtTime(55, t + 0.1);
  osc1.frequency.linearRampToValueAtTime(85, t + 0.2);
  osc1.frequency.linearRampToValueAtTime(45, t + 0.35);
  osc1.frequency.linearRampToValueAtTime(70, t + 0.42);
  osc1.frequency.linearRampToValueAtTime(35, t + 0.55);
  gain1.gain.setValueAtTime(0.18, t);
  gain1.gain.linearRampToValueAtTime(0.22, t + 0.08);
  gain1.gain.exponentialRampToValueAtTime(0.01, t + 0.55);
  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.start(t);
  osc1.stop(t + 0.55);

  // LFO to modulate gain for sputtering effect
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.type = "sine";
  lfo.frequency.setValueAtTime(25, t);
  lfo.frequency.linearRampToValueAtTime(15, t + 0.3);
  lfoGain.gain.setValueAtTime(0.1, t);
  lfo.connect(lfoGain);
  lfoGain.connect(gain1.gain);
  lfo.start(t);
  lfo.stop(t + 0.55);
};

let bgmPlaying = false;
let bgmNodes: { oscs: OscillatorNode[]; gains: GainNode[] } | null = null;

export const startBgm = () => {
  if (bgmPlaying) return;
  bgmPlaying = true;
  const ctx = audioCtx();

  const notes = [262, 330, 392, 523, 392, 330, 262, 294, 349, 440, 349, 294];
  const noteDuration = 0.25;

  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0.06, ctx.currentTime);
  masterGain.connect(ctx.destination);

  const oscs: OscillatorNode[] = [];
  const gains: GainNode[] = [];

  // Create a looping melody using multiple oscillators scheduled ahead
  const scheduleLoop = (startTime: number) => {
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, startTime + i * noteDuration);
      g.gain.setValueAtTime(0.8, startTime + i * noteDuration);
      g.gain.setValueAtTime(0, startTime + (i + 0.9) * noteDuration);
      osc.connect(g);
      g.connect(masterGain);
      osc.start(startTime + i * noteDuration);
      osc.stop(startTime + (i + 1) * noteDuration);
      oscs.push(osc);
      gains.push(g);
    });
  };

  // Schedule several loops ahead
  const loopLen = notes.length * noteDuration;
  for (let i = 0; i < 100; i++) {
    scheduleLoop(ctx.currentTime + i * loopLen);
  }

  bgmNodes = { oscs, gains };
};

export const stopBgm = () => {
  bgmPlaying = false;
  if (bgmNodes) {
    bgmNodes.oscs.forEach((o) => { try { o.stop(); } catch {} });
    bgmNodes = null;
  }
};
