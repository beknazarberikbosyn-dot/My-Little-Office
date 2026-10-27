'use strict';
/* Синтезированные звуки и чиптюн-музыка на WebAudio — без внешних файлов */
const Sfx = (() => {
  let ac = null, master = null, sfxBus = null, musBus = null;
  let muted = false, musicOn = false, chaos = 0;
  let step = 0, nextT = 0, timer = null, noiseBuf = null;

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = 0.55; master.connect(ac.destination);
      sfxBus = ac.createGain(); sfxBus.gain.value = 0.55; sfxBus.connect(master);
      musBus = ac.createGain(); musBus.gain.value = 0.16; musBus.connect(master);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ac = null; }
  }

  function tone(freq, dur, type = 'square', vol = 0.2, when = 0, dest, slide = 0) {
    if (!ac) return;
    const t = ac.currentTime + when;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.linearRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || sfxBus);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol = 0.3, when = 0, freq = 1200, dest, type = 'lowpass') {
    if (!ac) return;
    const t = ac.currentTime + when;
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || sfxBus);
    s.start(t); s.stop(t + dur + 0.02);
  }

  const S = {
    click() { tone(720, 0.04, 'square', 0.08); },
    hover() { tone(980, 0.02, 'square', 0.03); },
    open() { tone(520, 0.05, 'square', 0.1); tone(780, 0.07, 'square', 0.1, 0.05); },
    close() { tone(600, 0.05, 'square', 0.09); tone(420, 0.07, 'square', 0.09, 0.05); },
    pickup() { tone(400, 0.06, 'triangle', 0.2, 0, null, 200); },
    stamp() { noise(0.14, 0.7, 0, 420); tone(85, 0.16, 'sine', 0.7); tone(60, 0.2, 'triangle', 0.4, 0.02); },
    paper() { noise(0.18, 0.18, 0, 4000, null, 'highpass'); },
    coin() { tone(988, 0.07, 'square', 0.12); tone(1319, 0.16, 'square', 0.12, 0.07); },
    good() { tone(523, 0.08, 'square', 0.12); tone(659, 0.08, 'square', 0.12, 0.08); tone(784, 0.16, 'square', 0.12, 0.16); },
    bad() { tone(330, 0.14, 'sawtooth', 0.14); tone(220, 0.26, 'sawtooth', 0.14, 0.13); },
    alarm() { for (let i = 0; i < 4; i++) tone(i % 2 ? 660 : 880, 0.12, 'square', 0.1, i * 0.13); },
    ring() { for (let i = 0; i < 8; i++) tone(i % 2 ? 1175 : 1397, 0.05, 'square', 0.07, i * 0.055); },
    blip() { tone(1500 + Math.random() * 300, 0.018, 'square', 0.025); },
    step() { noise(0.03, 0.05, 0, 700); },
    duck() { tone(900, 0.08, 'square', 0.08, 0, null, -400); tone(820, 0.1, 'square', 0.07, 0.09, null, -380); },
    shout() { tone(220 + Math.random() * 80, 0.18, 'sawtooth', 0.05, 0, null, 120); },
    fanfare() {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.14, 'square', 0.12, i * 0.12));
      tone(1047, 0.5, 'triangle', 0.15, 0.5);
    },
    doom() { [392, 349, 311, 262].forEach((f, i) => tone(f, 0.3, 'sawtooth', 0.12, i * 0.28)); },
    tally() { tone(1200, 0.03, 'square', 0.06); },
  };

  /* ---------- Музыка: простой бодрый луп в духе пиксельных ферм ---------- */
  const N = m => 440 * Math.pow(2, (m - 69) / 12);
  // 4 такта × 8 восьмых
  const LEAD = [
    65, 0, 69, 0, 72, 0, 69, 72,   67, 0, 72, 0, 76, 74, 72, 0,
    69, 0, 74, 0, 77, 0, 74, 72,   70, 69, 67, 0, 65, 0, 0, 0,
    65, 0, 69, 72, 77, 0, 76, 0,   74, 0, 72, 0, 70, 69, 67, 0,
    69, 72, 74, 0, 72, 0, 69, 0,   67, 0, 64, 0, 65, 0, 0, 0,
  ];
  const BASS = [41, 48, 50, 46, 41, 46, 45, 48];

  function sched() {
    if (!ac || !musicOn) return;
    while (nextT < ac.currentTime + 0.2) {
      const bpm = 100 + chaos * 0.55;
      const dur = 60 / bpm / 2;
      const i = step % LEAD.length;
      const m = LEAD[i];
      const crazy = chaos > 60;
      const t0 = nextT - ac.currentTime;
      if (m) {
        const det = crazy ? (Math.random() - 0.5) * chaos * 0.25 : 0;
        tone(N(m) + det, dur * 0.9, crazy ? 'sawtooth' : 'square', crazy ? 0.09 : 0.11, Math.max(0, t0), musBus);
      }
      if (i % 2 === 0) {
        const b = BASS[Math.floor(i / 8) % BASS.length];
        tone(N(b), dur * 1.8, 'triangle', 0.25, Math.max(0, t0), musBus);
      }
      if (chaos > 35 && i % 2 === 1) noise(0.04, 0.08 + chaos / 900, Math.max(0, t0), 6000, musBus, 'highpass');
      if (chaos > 65 && i % 4 === 0) { tone(110, 0.12, 'sine', 0.35, Math.max(0, t0), musBus, -60); }
      step++;
      nextT += dur;
    }
  }

  function startMusic() {
    if (!ac) return;
    musicOn = true;
    nextT = ac.currentTime + 0.1;
    if (!timer) timer = setInterval(sched, 50);
  }
  function stopMusic() { musicOn = false; }

  function play(name) { if (!ac || muted) return; try { S[name] && S[name](); } catch (e) { /* звук — не критично */ } }
  function setMuted(m) {
    muted = m;
    if (master) master.gain.value = m ? 0 : 0.55;
  }
  return {
    init, play, startMusic, stopMusic,
    setChaos: c => { chaos = c; },
    toggleMute() { setMuted(!muted); return muted; },
    isMuted: () => muted,
  };
})();
