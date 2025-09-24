import React, { useEffect, useRef, useState } from "react";

// Rapsody — Bouncing Balls Beatmaker (Vite + Tailwind)
// ----------------------------------------------------
// - Bolas que rebotan en un canvas; colisiones disparan sonidos.
// - Renombrar bolas, mover con arrastre y “lanzar” para fijar dirección.
// - Energía +/– para escalar velocidad.
// - Añadir / quitar bolas, asignar instrumento.
// - Presets (localStorage) y grabación .webm opcional.

const rnd = (min, max) => Math.random() * (max - min) + min;

const QUANT_OPTIONS = [
  { label: "1/4", value: 1 / 4 },
  { label: "1/8", value: 1 / 8 },
  { label: "1/16", value: 1 / 16 },
  { label: "1/32", value: 1 / 32 },
];

const VOICES = [
  { label: "Kick", value: "kick" },
  { label: "Snare", value: "snare" },
  { label: "Hi-hat", value: "hat" },
  { label: "OpenHat", value: "ohat" },
  { label: "Clap", value: "clap" },
  { label: "Tom Low", value: "tomL" },
  { label: "Tom High", value: "tomH" },
  { label: "Rim", value: "rim" },
  { label: "Clave", value: "clave" },
  { label: "Blip", value: "blip" },
];


// --- Web Audio: síntesis simple de percusiones ---
function createAudio() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioCtx();

  const master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);

  // ruido compartido
  const noiseBuffer = (() => {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 1.0, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  })();

  const voices = {
    kick(time = ctx.currentTime) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(150, time);
      osc.frequency.exponentialRampToValueAtTime(50, time + 0.12);
      gain.gain.setValueAtTime(1, time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.13);
      osc.connect(gain).connect(master);
      osc.start(time);
      osc.stop(time + 0.14);
    },
    snare(time = ctx.currentTime) {
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 1800;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.9, time);
      g.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);
      noise.connect(bp).connect(g).connect(master);
      noise.start(time);
      noise.stop(time + 0.2);

      const osc = ctx.createOscillator();
      const og = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(200, time);
      og.gain.setValueAtTime(0.3, time);
      og.gain.exponentialRampToValueAtTime(0.0001, time + 0.08);
      osc.connect(og).connect(master);
      osc.start(time);
      osc.stop(time + 0.09);
    },
    hat(time = ctx.currentTime) {
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 8000;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.6, time);
      g.gain.exponentialRampToValueAtTime(0.0001, time + 0.06);
      noise.connect(hp).connect(g).connect(master);
      noise.start(time);
      noise.stop(time + 0.07);
    },
    clave(time = ctx.currentTime) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(1200, time);
      g.gain.setValueAtTime(0.4, time);
      g.gain.exponentialRampToValueAtTime(0.0001, time + 0.09);
      osc.connect(g).connect(master);
      osc.start(time);
      osc.stop(time + 0.1);
    },
    blip(time = ctx.currentTime) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(700, time);
      osc.frequency.exponentialRampToValueAtTime(400, time + 0.12);
      g.gain.setValueAtTime(0.25, time);
      g.gain.exponentialRampToValueAtTime(0.0001, time + 0.12);
      osc.connect(g).connect(master);
      osc.start(time);
      osc.stop(time + 0.13);
    },
    // Clap: ruido + breve “snap”
clap(time = ctx.currentTime) {
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass"; hp.frequency.value = 2000;

  const g = ctx.createGain();
  // envolvente con dos picos muy cortos (simula palmas dobles)
  g.gain.setValueAtTime(0.0, time);
  g.gain.linearRampToValueAtTime(0.8, time + 0.005);
  g.gain.linearRampToValueAtTime(0.2, time + 0.012);
  g.gain.linearRampToValueAtTime(0.7, time + 0.020);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.12);

  noise.connect(hp).connect(g).connect(master);
  noise.start(time);
  noise.stop(time + 0.13);
},

// Open hi-hat: ruido + filtro HP, decay más largo
ohat(time = ctx.currentTime) {
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass"; hp.frequency.value = 9000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.5, time);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.35);
  noise.connect(hp).connect(g).connect(master);
  noise.start(time);
  noise.stop(time + 0.36);
},

// Tom bajo: seno con barrido leve
tomL(time = ctx.currentTime) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(150, time);
  osc.frequency.exponentialRampToValueAtTime(110, time + 0.18);
  g.gain.setValueAtTime(0.8, time);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);
  osc.connect(g).connect(master);
  osc.start(time);
  osc.stop(time + 0.23);
},

// Tom alto
tomH(time = ctx.currentTime) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(230, time);
  osc.frequency.exponentialRampToValueAtTime(170, time + 0.16);
  g.gain.setValueAtTime(0.75, time);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.20);
  osc.connect(g).connect(master);
  osc.start(time);
  osc.stop(time + 0.21);
},

// Rimshot: click corto + banda
rim(time = ctx.currentTime) {
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass"; bp.frequency.value = 2800; bp.Q = 6;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.7, time);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.06);
  noise.connect(bp).connect(g).connect(master);
  noise.start(time);
  noise.stop(time + 0.07);
},

  };

  // Para grabación (opcional)
  const mediaDest = ctx.createMediaStreamDestination();
  master.connect(mediaDest);

  return { ctx, master, voices, mediaDest };
}

function nextQuantizedTime(ctxTime, bpm, subdivision) {
  const spb = 60 / bpm;
  const step = spb * subdivision;
  if (!isFinite(step) || step <= 0) return ctxTime + 0.01;
  const steps = Math.ceil(ctxTime / step);
  return steps * step;
}

export default function Rapsody() {
  // --- Canvas / Phys ---
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const lastTRef = useRef(0);
  const pairsCooldown = useRef(new Map());

  // --- Audio ---
  const [audioReady, setAudioReady] = useState(false);
  const audioRef = useRef(null);

  // Grabación (opcional)
  const mediaRecorderRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const recordedChunksRef = useRef([]);

  // Transporte
  const [isRunning, setIsRunning] = useState(false);
  const [bpm, setBpm] = useState(100);
  const [quant, setQuant] = useState(1 / 8);

  

  // Estado de bolas (con name)
  const [balls, setBalls] = useState(() =>
    Array.from({ length: 5 }).map((_, i) => ({
      id: i + 1,
      name: `Bola ${i + 1}`, // <- nuevo campo
      x: rnd(100, 500),
      y: rnd(80, 300),
      vx: rnd(-120, 120),
      vy: rnd(-120, 120),
      r: rnd(10, 16),
      color: `hsl(${Math.floor(rnd(0, 360))} 80% 60%)`,
      voice: VOICES[i % VOICES.length].value,
    }))
  );

  // --- Interacción pointer (drag & flick) ---
  const draggingIdRef = useRef(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const lastPtrRef = useRef({ x: 0, y: 0, t: 0 });
  const showArrowRef = useRef(null);
  const pointerHistoryRef = useRef([]);

  const MAX_SPEED = 260;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  function getPointer(evt, canvas) {
    const rect = canvas.getBoundingClientRect();
    const x = (evt.clientX - rect.left) * window.devicePixelRatio;
    const y = (evt.clientY - rect.top) * window.devicePixelRatio;
    return { x, y, t: performance.now() };
  }
  function findBallAt(x, y, arr) {
    for (let i = arr.length - 1; i >= 0; i--) {
      const b = arr[i];
      const dx = x - b.x, dy = y - b.y;
      if (dx * dx + dy * dy <= b.r * b.r) return [b, i];
    }
    return [null, -1];
  }

  // Audio ensure
  const ensureAudio = () => {
    if (!audioRef.current) audioRef.current = createAudio();
    if (audioRef.current.ctx.state !== "running") audioRef.current.ctx.resume();

    // MediaRecorder init una vez
    if (!mediaRecorderRef.current) {
      try {
        const stream = audioRef.current.mediaDest.stream;
        const mr = new MediaRecorder(stream);
        mr.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
        };
        mr.onstop = () => {
          const blob = new Blob(recordedChunksRef.current, { type: "audio/webm" });
          recordedChunksRef.current = [];
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `rapsody_${Date.now()}.webm`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        };
        mediaRecorderRef.current = mr;
      } catch (err) {
        console.warn("MediaRecorder no disponible:", err);
      }
    }
    setAudioReady(true);
  };

  const trigger = (voice) => {
    if (!audioRef.current) return;
    const { ctx, voices } = audioRef.current;
    const t = ctx.currentTime + 0.03;
    const qt = nextQuantizedTime(t, bpm, quant * 4);
    (voices[voice] || voices.kick)(qt);
  };

  // Física + dibujo + eventos pointer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let width = (canvas.width = canvas.clientWidth * window.devicePixelRatio);
    let height = (canvas.height = canvas.clientHeight * window.devicePixelRatio);

    const onResize = () => {
      width = canvas.width = canvas.clientWidth * window.devicePixelRatio;
      height = canvas.height = canvas.clientHeight * window.devicePixelRatio;
    };
    window.addEventListener("resize", onResize);

    // --- Eventos pointer (drag & flick) ---
    const onPointerDown = (e) => {
      const p = getPointer(e, canvas);
      lastPtrRef.current = p;
      pointerHistoryRef.current = [p];

      let hit = null, hitIdx = -1;
      setBalls((prev) => {
        const arr = prev.map((b) => ({ ...b }));
        const [b, idx] = findBallAt(p.x, p.y, arr);
        hit = b; hitIdx = idx;
        if (b) {
          draggingIdRef.current = b.id;
          dragOffsetRef.current = { x: p.x - b.x, y: p.y - b.y };
          showArrowRef.current = { x: p.x, y: p.y };
          // parar mientras arrastras
          arr[idx].vx = 0; arr[idx].vy = 0;
        }
        return arr;
      });

      if (hit) {
        canvas.setPointerCapture?.(e.pointerId);
        e.preventDefault();
      }
    };

    const onPointerMove = (e) => {
      if (!draggingIdRef.current) return;
      const p = getPointer(e, canvas);
      const id = draggingIdRef.current;
      const off = dragOffsetRef.current;

      setBalls((prev) => {
        const arr = prev.map((b) => ({ ...b }));
        const i = arr.findIndex((b) => b.id === id);
        if (i >= 0) {
          arr[i].x = p.x - off.x;
          arr[i].y = p.y - off.y;
        }
        return arr;
      });

      showArrowRef.current = { x: p.x, y: p.y };
      lastPtrRef.current = p;
pointerHistoryRef.current.push(p);
const cutoff = p.t - 120; // ms
pointerHistoryRef.current = pointerHistoryRef.current.filter(pt => pt.t >= cutoff);
if (pointerHistoryRef.current.length > 12) {
  pointerHistoryRef.current.shift();
}

    };

    const onPointerUp = (e) => {
      if (!draggingIdRef.current) return;
      const p = getPointer(e, canvas);
      const id = draggingIdRef.current;

      // NUEVO: velocidad basada en historial de ~50–100 ms (flick real)
const hist = pointerHistoryRef.current;
if (hist.length >= 2) {
  const pNow = hist[hist.length - 1];
  // busca una muestra ~60 ms atrás; si no hay, usa la más antigua
  let pPast = hist[0];
  for (let i = hist.length - 1; i >= 0; i--) {
    if (pNow.t - hist[i].t >= 60) { // 60 ms ventana objetivo
      pPast = hist[i];
      break;
    }
  }

  const dt = Math.max((pNow.t - pPast.t) / 1000, 1 / 240);
  const vxRaw = (pNow.x - pPast.x) / dt;
  const vyRaw = (pNow.y - pPast.y) / dt;

  const mag = Math.hypot(vxRaw, vyRaw) || 0;
  const k = mag > 0 ? Math.min(MAX_SPEED / mag, 1) : 0;
  const vx = vxRaw * k;
  const vy = vyRaw * k;

  setBalls((prevBalls) => {
    const arr = prevBalls.map((b) => ({ ...b }));
    const i = arr.findIndex((b) => b.id === id);
    if (i >= 0) {
      arr[i].vx = vx;
      arr[i].vy = vy;
    }
    return arr;
  });
} else {
  // sin historial suficiente: no “lanzamos”
  setBalls((prevBalls) => {
    const arr = prevBalls.map((b) => ({ ...b }));
    const i = arr.findIndex((b) => b.id === id);
    if (i >= 0) {
      arr[i].vx = 0;
      arr[i].vy = 0;
    }
    return arr;
  });
}

// limpiar historial
pointerHistoryRef.current = [];


      draggingIdRef.current = null;
      showArrowRef.current = null;
      canvas.releasePointerCapture?.(e.pointerId);
    };

    canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
    canvas.addEventListener("pointermove", onPointerMove, { passive: false });
    canvas.addEventListener("pointerup", onPointerUp, { passive: false });
    canvas.addEventListener("pointercancel", onPointerUp, { passive: false });

    const step = (t) => {
      const prev = lastTRef.current || t;
      let dt = (t - prev) / 1000;
      if (dt > 0.05) dt = 0.05;
      lastTRef.current = t;

      if (isRunning) {
        setBalls((prevBalls) => {
          const arr = prevBalls.map((b) => ({ ...b }));

          // mover
          for (const b of arr) {
            b.x += b.vx * dt;
            b.y += b.vy * dt;

            // paredes
            if (b.x - b.r < 0) { b.x = b.r; b.vx = Math.abs(b.vx); }
            else if (b.x + b.r > width) { b.x = width - b.r; b.vx = -Math.abs(b.vx); }
            if (b.y - b.r < 0) { b.y = b.r; b.vy = Math.abs(b.vy); }
            else if (b.y + b.r > height) { b.y = height - b.r; b.vy = -Math.abs(b.vy); }
          }

          // colisiones O(n^2)
          for (let i = 0; i < arr.length; i++) {
            for (let j = i + 1; j < arr.length; j++) {
              const a = arr[i], b = arr[j];
              const dx = b.x - a.x, dy = b.y - a.y;
              const dist = Math.hypot(dx, dy), minD = a.r + b.r;
              if (dist < minD) {
                // cooldown por par
                const key = `${a.id}-${b.id}`;
                const now = performance.now();
                const last = pairsCooldown.current.get(key) || 0;
                if (now - last > 80) {
                  pairsCooldown.current.set(key, now);
                  trigger(a.voice);
                }
                // respuesta elástica simple
                const overlap = minD - dist || 0.01;
                const nx = dx / (dist || 1), ny = dy / (dist || 1);
                a.x -= nx * overlap * 0.5; a.y -= ny * overlap * 0.5;
                b.x += nx * overlap * 0.5; b.y += ny * overlap * 0.5;

                const avn = a.vx * nx + a.vy * ny;
                const bvn = b.vx * nx + b.vy * ny;
                const swap = bvn - avn;
                a.vx += nx * swap; a.vy += ny * swap;
                b.vx -= nx * swap; b.vy -= ny * swap;
              }
            }
          }
          return arr;
        });
      }

      // dibujar
      ctx.clearRect(0, 0, width, height);
      for (const b of balls) {
        ctx.beginPath();
        ctx.fillStyle = b.color;
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // flecha mientras arrastras
      if (showArrowRef.current && draggingIdRef.current) {
        const id = draggingIdRef.current;
        const b = balls.find((bb) => bb.id === id);
        if (b) {
          const tip = showArrowRef.current;
          const fromX = b.x, fromY = b.y;
          const toX = tip.x - dragOffsetRef.current.x;
          const toY = tip.y - dragOffsetRef.current.y;

          ctx.save();
          ctx.strokeStyle = "#22d3ee";
          ctx.lineWidth = 2 * window.devicePixelRatio;
          ctx.beginPath();
          ctx.moveTo(fromX, fromY);
          ctx.lineTo(toX, toY);
          ctx.stroke();

          const ang = Math.atan2(toY - fromY, toX - fromX);
          const ah = 10 * window.devicePixelRatio;
          ctx.beginPath();
          ctx.moveTo(toX, toY);
          ctx.lineTo(toX - ah * Math.cos(ang - Math.PI / 6), toY - ah * Math.sin(ang - Math.PI / 6));
          ctx.lineTo(toX - ah * Math.cos(ang + Math.PI / 6), toY - ah * Math.sin(ang + Math.PI / 6));
          ctx.closePath();
          ctx.fillStyle = "#22d3ee";
          ctx.fill();
          ctx.restore();
        }
      }

      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onResize);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
    };
  }, [isRunning, balls, bpm, quant]);

  // --- Helpers UI ---
  const addBall = () => {
    const id = (balls.at(-1)?.id || 0) + 1;
    const voice = VOICES[Math.floor(rnd(0, VOICES.length))].value;
    const b = {
      id,
      name: `Bola ${id}`,
      x: rnd(50, (canvasRef.current?.clientWidth || 640) - 50),
      y: rnd(50, (canvasRef.current?.clientHeight || 360) - 50),
      vx: rnd(-160, 160),
      vy: rnd(-160, 160),
      r: rnd(10, 16),
      color: `hsl(${Math.floor(rnd(0, 360))} 85% 60%)`,
      voice,
    };
    setBalls((arr) => [...arr, b]);
  };
  const removeBall = () => setBalls((arr) => arr.slice(0, -1));
  const updateBallVoice = (id, voice) =>
    setBalls((arr) => arr.map((b) => (b.id === id ? { ...b, voice } : b)));
  const updateBallName = (id, name) =>
    setBalls((arr) => arr.map((b) => (b.id === id ? { ...b, name } : b)));
  const nudgeEnergy = (scale = 1.1) =>
    setBalls((arr) => arr.map((b) => ({ ...b, vx: b.vx * scale, vy: b.vy * scale })));

  // Presets
  const savePreset = () => {
    const data = { bpm, quant, balls };
    localStorage.setItem("rapsody_preset", JSON.stringify(data));
  };
  const loadPreset = () => {
    try {
      const raw = localStorage.getItem("rapsody_preset");
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data?.bpm) setBpm(data.bpm);
      if (data?.quant) setQuant(data.quant);
      if (Array.isArray(data?.balls)) setBalls(data.balls);
    } catch (e) {
      console.warn("Preset inválido", e);
    }
  };

  // Grabación
  const toggleRecording = () => {
    ensureAudio();
    const mr = mediaRecorderRef.current;
    if (!mr) return;
    if (isRecording) {
      mr.stop();
      setIsRecording(false);
    } else {
      recordedChunksRef.current = [];
      mr.start();
      setIsRecording(true);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4">
      <header className="flex flex-wrap gap-2 mb-4 items-center">
        <button
          onClick={() => { ensureAudio(); setIsRunning((v) => !v); }}
          className={`px-4 py-2 rounded-2xl shadow-sm transition ${
            isRunning ? "bg-rose-500 hover:bg-rose-600" : "bg-emerald-500 hover:bg-emerald-600"
          }`}
        >
          {isRunning ? "Pausar" : "Iniciar"}
        </button>

        <label className="flex items-center gap-3 ml-2">
          <span className="text-sm text-slate-300">BPM</span>
          <input
            type="range"
            min={60}
            max={180}
            value={bpm}
            onChange={(e) => setBpm(parseInt(e.target.value))}
          />
          <span className="w-10 text-right tabular-nums">{bpm}</span>
        </label>

        <label className="flex items-center gap-3">
          <span className="text-sm text-slate-300">Cuantización</span>
          <select
            value={quant}
            onChange={(e) => setQuant(parseFloat(e.target.value))}
            className="bg-slate-700 rounded-xl px-2 py-1"
          >
            {QUANT_OPTIONS.map((q) => (
              <option key={q.value} value={q.value}>{q.label}</option>
            ))}
          </select>
        </label>

        <button
          onClick={() => { ensureAudio(); nudgeEnergy(1.1); }}
          className="px-4 py-2 rounded-2xl bg-sky-500 hover:bg-sky-600"
        >
          Energía +
        </button>
        <button
          onClick={() => { ensureAudio(); nudgeEnergy(0.9); }}
          className="px-4 py-2 rounded-2xl bg-purple-500 hover:bg-purple-600"
        >
          Energía –
        </button>

        <button onClick={addBall} className="px-4 py-2 rounded-2xl bg-violet-500 hover:bg-violet-600">
          Añadir bola
        </button>
        <button
          onClick={removeBall}
          disabled={balls.length <= 1}
          className="px-4 py-2 rounded-2xl bg-fuchsia-500 hover:bg-fuchsia-600 disabled:opacity-40"
          title={balls.length <= 1 ? "Debe quedar al menos 1 bola" : ""}
        >
          Quitar bola
        </button>

        <button onClick={savePreset} className="px-4 py-2 rounded-2xl bg-teal-500 hover:bg-teal-600">
          Guardar preset
        </button>
        <button onClick={loadPreset} className="px-4 py-2 rounded-2xl bg-amber-500 hover:bg-amber-600">
          Cargar preset
        </button>

        {/* Puedes comentar este botón si no usas grabación */}
        <button
          onClick={toggleRecording}
          className={`px-4 py-2 rounded-2xl ${isRecording ? "bg-yellow-500" : "bg-indigo-500 hover:bg-indigo-600"}`}
          title="Graba salida de audio y descarga .webm"
        >
          {isRecording ? "Grabando…" : "Grabar .webm"}
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 rounded-3xl overflow-hidden bg-slate-800 ring-1 ring-slate-700">
          <canvas ref={canvasRef} className="h-[420px] w-full" />
        </div>

        {/* Lista desplazable de bolas */}
        <aside className="lg:col-span-1">
          <div className="rounded-3xl bg-slate-800 ring-1 ring-slate-700 overflow-hidden">
            <div className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur px-4 py-2 text-xs text-slate-400">
              Bolas e instrumentos
            </div>
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-2 p-3" role="list" aria-label="Bolas e instrumentos">
              {balls.map((b) => (
                <div key={b.id} className="flex items-center gap-3 bg-slate-900/40 rounded-xl p-2">
                  <span className="inline-block h-3 w-3 rounded-full" style={{ background: b.color }} />
                  <input
                    type="text"
                    value={b.name}
                    onChange={(e) => updateBallName(b.id, e.target.value)}
                    className="bg-slate-700 rounded px-2 py-1 text-sm text-slate-100 flex-1 min-w-0"
                    placeholder={`Bola ${b.id}`}
                  />
                  <select
                    value={b.voice}
                    onChange={(e) => updateBallVoice(b.id, e.target.value)}
                    className="bg-slate-700 rounded-xl px-2 py-1 text-sm"
                  >
                    {VOICES.map((v) => (
                      <option key={v.value} value={v.value}>{v.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
