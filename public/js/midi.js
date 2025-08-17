// public/js/midi.js
export async function initMIDI({ listSel, testBtns, max = 20, testDb = -6 }) {
  const $list = document.querySelector(listSel);
  const ctx = new (window.AudioContext || window.webkitAudioContext)();

  function dbToGain(db) { return Math.pow(10, db / 20); }
  function addLine(text) {
    const li = document.createElement('li');
    li.textContent = text;
    $list.prepend(li);
    while ($list.children.length > max) $list.removeChild($list.lastChild);
  }

  const access = await navigator.requestMIDIAccess({ sysex: false });
  for (const input of access.inputs.values()) {
    input.onmidimessage = (ev) => {
      const [s, d1, d2] = ev.data;
      const t = ev.timeStamp.toFixed(0);
      const type = s & 0xF0;
      if (type === 0x90 && d2 > 0) addLine(`NoteOn  n=${d1} v=${d2}  t=${t}`);
      else if (type === 0x80 || (type === 0x90 && d2 === 0)) addLine(`NoteOff n=${d1}        t=${t}`);
      else if (type === 0xE0) addLine(`PitchBend v=${(d2<<7)|d1} t=${t}`);
      else if (type === 0xD0) addLine(`Aftertouch p=${d1} t=${t}`);
    };
  }
  access.onstatechange = (e)=> addLine(`Device ${e.port.name} ${e.port.state}`);

  function playTest(wave='sine', dur=0.15, freq=440) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = wave;
    g.gain.value = 0;
    osc.connect(g).connect(ctx.destination);
    osc.frequency.value = freq;

    const now = ctx.currentTime;
    const peak = dbToGain(testDb);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(peak, now + 0.005);
    g.gain.exponentialRampToValueAtTime(1e-4, now + dur);
    osc.start(now);
    osc.stop(now + dur + 0.05);
  }

  document.querySelectorAll(testBtns).forEach(btn=>{
    btn.addEventListener('click', ()=> playTest(btn.dataset.wave));
  });

  return { playTest };
}
