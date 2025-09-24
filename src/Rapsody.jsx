import React, { useEffect, useRef, useState } from "react";

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
  { label: "Clave", value: "clave" },
  { label: "Blip", value: "blip" },
];

function createAudio() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioCtx();

  const master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);

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
  };

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
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const lastTRef = useRef(0);
  const pairsCooldown = useRef(new Map());

  const [audioReady, setAudioReady] = useState(false);
  const audioRef = useRef(null);

  const mediaRecorderRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const recordedChunksRef = useRef([]);

  const [isRunning, setIsRunning] = useState(false);
  const [bpm, setBpm] = useState(100);
  const [quant, setQuant] = useState(1 / 8);

  const [balls, setBalls] = useState(() =>
    Array.from({ length: 5 }).map((_, i) => ({
      id: i + 1,
      x: rnd(100, 500),
      y: rnd(80, 300),
      vx: rnd(-120, 120),
      vy: rnd(-120, 120),
      r: rnd(10, 16),
      color: `hsl(${Math.floor(rnd(0, 360))} 80% 60%)`,
      voice: VOICES[i % VOICES.length].value,
    }))
  );

  const ensureAudio = () => {
    if (!audioRef.current) {
      audioRef.current = createAudio();
    }
    if (audioRef.current.ctx.state !== "running") {
      audioRef.current.ctx.resume();
    }
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
    const fn = voices[voice] || voices.kick;
    fn(qt);
  };

  // física y canvas
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

    const step = (t) => {
      const prev = lastTRef.current || t;
      let dt = (t - prev) / 1000;
      if (dt > 0.05) dt = 0.05;
      lastTRef.current = t;

      if (isRunning) {
        setBalls((prevBalls) => {
          const arr = prevBalls.map((b) => ({ ...b }));
          for (const b of arr) {
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            if (b.x - b.r < 0) { b.x = b.r; b.vx = Math.abs(b.vx); }
            else if (b.x + b.r > width) { b.x = width - b.r; b.vx = -Math.abs(b.vx); }
            if (b.y - b.r < 0) { b.y = b.r; b.vy = Math.abs(b.vy); }
            else if (b.y + b.r > height) { b.y = height - b.r; b.vy = -Math.abs(b.vy); }
          }
          for (let i = 0; i < arr.length; i++) {
            for (let j = i + 1; j < arr.length; j++) {
              const a = arr[i], b = arr[j];
              const dx = b.x - a.x, dy = b.y - a.y;
              const dist = Math.hypot(dx, dy), minD = a.r + b.r;
              if (dist < minD) {
                const key = `${a.id}-${b.id}`;
                const now = performance.now();
                const last = pairsCooldown.current.get(key) || 0;
                if (now - last > 80) {
                  pairsCooldown.current.set(key, now);
                  trigger(a.voice);
                }
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

      ctx.clearRect(0, 0, width, height);
      for (const b of balls) {
        ctx.beginPath();
        ctx.fillStyle = b.color;
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      }
      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onResize);
    };
  }, [isRunning, balls, bpm, quant]);

  // helpers
  const addBall = () => {
    const id = (balls.at(-1)?.id || 0) + 1;
    const voice = VOICES[Math.floor(rnd(0, VOICES.length))].value;
    const b = {
      id,
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
  const nudgeEnergy = (scale = 1.1) =>
    setBalls((arr) => arr.map((b) => ({ ...b, vx: b.vx * scale, vy: b.vy * scale })));

  // presets
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

  // grabación
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
      <header className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => { ensureAudio(); setIsRunning((v) => !v); }}
          className={`px-4 py-2 rounded-2xl shadow-sm transition ${
            isRunning ? "bg-rose-500 hover:bg-rose-600" : "bg-emerald-500 hover:bg-emerald-600"
          }`}
        >
          {isRunning ? "pausar" : "Iniciar"}
        </button>
        <button
          onClick={() => { ensureAudio(); nudgeEnergy(); }}
          className="px-4 py-2 rounded-2xl bg-sky-500 hover:bg-sky-600"
        >velocidad</button>

        <button
          onClick={toggleRecording}
          className={`px-4 py-2 rounded-2xl ${isRecording ? 'bg-yellow-500' : 'bg-indigo-500 hover:bg-indigo-600'}`}
        >
          {isRecording ? "Grabando…" : "Grabar .webm"}
        </button> 



        <button onClick={savePreset} className="px-4 py-2 rounded-2xl bg-teal-500 hover:bg-teal-600">guardar </button>
        <button onClick={loadPreset} className="px-4 py-2 rounded-2xl bg-amber-500 hover:bg-amber-600">Cargar </button>
      </header>

      <div className="rounded-3xl overflow-hidden bg-slate-800 ring-1 ring-slate-700">
        <canvas ref={canvasRef} className="h-[420px] w-full" />
      </div>

      <aside className="mt-6 space-y-2">
        {balls.map((b) => (
          <div key={b.id} className="flex items-center gap-3">
            <span className="inline-block h-3 w-3 rounded-full" style={{ background: b.color }} />
            <span>Bola #{b.id}</span>
            <select
              value={b.voice}
              onChange={(e) => updateBallVoice(b.id, e.target.value)}
              className="ml-auto bg-slate-700 rounded-xl px-2 py-1"
            >
              {VOICES.map((v) => (
                <option key={v.value} value={v.value}>{v.label}</option>
              ))}
            </select>
          </div>
        ))}
      </aside>
    </div>
  );
}
