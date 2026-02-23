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
  
  // Low rumbling oscillator
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = "sawtooth";
  osc1.frequency.setValueAtTime(80, ctx.currentTime);
  osc1.frequency.linearRampToValueAtTime(60, ctx.currentTime + 0.15);
  osc1.frequency.linearRampToValueAtTime(90, ctx.currentTime + 0.25);
  osc1.frequency.linearRampToValueAtTime(50, ctx.currentTime + 0.4);
  gain1.gain.setValueAtTime(0.2, ctx.currentTime);
  gain1.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.1);
  gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);
  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.start(ctx.currentTime);
  osc1.stop(ctx.currentTime + 0.45);

  // Noise-like flutter using a second detuned oscillator
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = "square";
  osc2.frequency.setValueAtTime(120, ctx.currentTime);
  osc2.frequency.linearRampToValueAtTime(40, ctx.currentTime + 0.3);
  gain2.gain.setValueAtTime(0.08, ctx.currentTime);
  gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start(ctx.currentTime);
  osc2.stop(ctx.currentTime + 0.35);
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
