/** Small WebAudio sound stage: every sound is synthesized at runtime, with no audio files. */
export function createAudio() {
  let context = null;
  let master = null;
  let ambient = null;
  let musicTimer = null;
  let musicStep = 0;
  let lastEngine = -Infinity;
  let lastFoot = -Infinity;
  let lastTyre = -Infinity;
  let lastSiren = -Infinity;

  function ensure() {
    if (context) return true;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return false;
    context = new AudioContextClass();
    master = context.createGain();
    master.gain.value = .55;
    master.connect(context.destination);
    return true;
  }

  function playTone(frequency, duration, type = 'sine', gain = .04, when = context?.currentTime || 0) {
    if (!context || !master) return;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, when);
    envelope.gain.setValueAtTime(Math.max(.0001, gain), when);
    envelope.gain.exponentialRampToValueAtTime(.001, when + duration);
    oscillator.connect(envelope).connect(master);
    oscillator.start(when);
    oscillator.stop(when + duration + .02);
  }

  function tone(frequency, duration, type, gain) {
    if (!ensure()) return;
    playTone(frequency, duration, type, gain);
  }

  function startMusic() {
    if (musicTimer || !ensure()) return;
    const melody = [196, 247, 294, 247, 220, 277, 330, 277];
    musicTimer = setInterval(() => {
      if (!context) return;
      playTone(melody[musicStep % melody.length], .22, 'triangle', .014);
      musicStep += 1;
    }, 360);
  }

  return {
    setVolume(value) {
      if (!ensure()) return;
      master.gain.setTargetAtTime(Math.max(0, Math.min(1, value)), context.currentTime, .03);
    },
    start() {
      if (!ensure()) return;
      if (context.state === 'suspended') context.resume().catch(() => {});
      if (!ambient) {
        ambient = context.createOscillator();
        const bed = context.createGain();
        ambient.type = 'sine';
        ambient.frequency.value = 58;
        bed.gain.value = .006;
        ambient.connect(bed).connect(master);
        ambient.start();
      }
      startMusic();
      tone(196, .3, 'triangle', .03);
    },
    ambience() { this.start(); },
    foot() {
      if (!ensure() || context.currentTime - lastFoot < .2) return;
      lastFoot = context.currentTime;
      tone(105, .045, 'square', .012);
    },
    engine(speed) {
      if (!ensure() || speed <= .5 || context.currentTime - lastEngine < .075) return;
      lastEngine = context.currentTime;
      tone(55 + speed * 2, .06, 'sawtooth', .012);
    },
    tyre(speed, slip = 0) {
      if (!ensure() || Math.abs(slip) < .3 || Math.abs(speed) < 8 || context.currentTime - lastTyre < .12) return;
      lastTyre = context.currentTime;
      tone(140 + Math.abs(slip) * 80, .1, 'sawtooth', .025);
    },
    gun() {
      tone(80, .12, 'square', .09);
      tone(420, .05, 'sawtooth', .035);
    },
    sirens() {
      if (!ensure() || context.currentTime - lastSiren < .25) return;
      lastSiren = context.currentTime;
      tone(720, .16, 'square', .035);
      tone(520, .16, 'square', .03, context.currentTime + .16);
    },
    crash() { tone(45, .3, 'sawtooth', .08); },
    pickup() {
      tone(520, .08, 'sine', .04);
      if (context) tone(780, .12, 'sine', .03);
    },
  };
}
