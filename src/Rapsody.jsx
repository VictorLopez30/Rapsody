import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Midi } from "@tonejs/midi";


const rnd = (min, max) => Math.random() * (max - min) + min;

const TEMPO_QUANT_OPTIONS = [
  { label: "1/4", value: 1 / 4 },
  { label: "1/8", value: 1 / 8 },
  { label: "1/12 (ternario)", value: 1 / 12 },
  { label: "1/16", value: 1 / 16 },
  { label: "1/32", value: 1 / 32 },
];

const QUANT_OPTIONS = [
  { label: "1/4", value: 1 / 4 },
  { label: "1/8", value: 1 / 8 },
  { label: "1/16", value: 1 / 16 },
  { label: "1/32", value: 1 / 32 },
];

const QUANT_POOL = Array.from(
  new Set([...QUANT_OPTIONS, ...TEMPO_QUANT_OPTIONS].map((opt) => opt.value))
).sort((a, b) => a - b);
const DEFAULT_TEMPOS = [
  { quant: 1 / 8, velocity: 1.0, angleDeg: 10, speed: 450 },
  { quant: 1 / 12, velocity: 0.95, angleDeg: -16, speed: 420 },
];
const MELODY_VOICES = [
  { label: "Piano", value: "piano" },
  { label: "Pad", value: "pad" },
  { label: "Bass", value: "bass" },
  { label: "Blip", value: "blip" },
  { label: "Guitarra", value: "guitar" },
  { label: "Flauta", value: "flute" },
  { label: "Batería", value: "drums" },
];
const INSTRUMENT_PROFILES = [
  { voice: "piano", label: "Piano", filter: () => true },
  { voice: "pad", label: "Pad", filter: () => true },
  {
    voice: "bass",
    label: "Bass",
    filter: (_, midi) => midi <= 57,
  },
  { voice: "blip", label: "Lead", filter: (note, midi) => midi >= 60 },
  { voice: "guitar", label: "Guitarra", filter: (_, midi) => midi >= 45 && midi <= 72 },
  { voice: "flute", label: "Flauta", filter: (_, midi) => midi >= 72 },
  { voice: "drums", label: "Batería", filter: (_, midi) => midi <= 52 },
];
const CHORD_VOICES = new Set(["piano", "guitar"]);
const CHORD_INTERVALS = [0, 7, 12];
const DRUM_NOTE_OPTIONS = [
  { label: "Kick (C2)", value: "C2" },
  { label: "Snare (D3)", value: "D3" },
  { label: "Hat (F#4)", value: "F#4" },
];
const SAMPLE_LIBRARY = {
  piano: {
    type: "pitched",
    samples: [
      { note: "A0", file: "/samples/vsco/piano/Player_dyn2_rr1_000.wav" },
      { note: "A2", file: "/samples/vsco/piano/Player_dyn2_rr1_012.wav" },
      { note: "A4", file: "/samples/vsco/piano/Player_dyn2_rr1_024.wav" },
      { note: "A5", file: "/samples/vsco/piano/Player_dyn2_rr1_030.wav" },
      { note: "A6", file: "/samples/vsco/piano/Player_dyn2_rr1_036.wav" },
    ],
  },
  flute: {
    type: "pitched",
    samples: [
      { note: "C3", file: "/samples/vsco/flute/LDFlute_expvib_C3_v1_1.wav" },
      { note: "E4", file: "/samples/vsco/flute/LDFlute_expvib_E4_v1_1.wav" },
      { note: "A4", file: "/samples/vsco/flute/LDFlute_expvib_A4_v1_1.wav" },
      { note: "E5", file: "/samples/vsco/flute/LDFlute_expvib_E5_v1_1.wav" },
      { note: "A5", file: "/samples/vsco/flute/LDFlute_expvib_A5_v1_1.wav" },
      { note: "C6", file: "/samples/vsco/flute/LDFlute_expvib_C6_v1_1.wav" },
    ],
  },
  guitar: {
    type: "pitched",
    samples: [
      { note: "B1", file: "/samples/vsco/guitar/KSHarp_B1_mf.wav" },
      { note: "D2", file: "/samples/vsco/guitar/KSHarp_D2_mf.wav" },
      { note: "F2", file: "/samples/vsco/guitar/KSHarp_F2_mf.wav" },
      { note: "A2", file: "/samples/vsco/guitar/KSHarp_A2_mf.wav" },
      { note: "C3", file: "/samples/vsco/guitar/KSHarp_C3_mf.wav" },
      { note: "E3", file: "/samples/vsco/guitar/KSHarp_E3_mf.wav" },
      { note: "G3", file: "/samples/vsco/guitar/KSHarp_G3_mf.wav" },
      { note: "B3", file: "/samples/vsco/guitar/KSHarp_B3_mf.wav" },
      { note: "D4", file: "/samples/vsco/guitar/KSHarp_D4_mf.wav" },
      { note: "F4", file: "/samples/vsco/guitar/KSHarp_F4_mf.wav" },
      { note: "A4", file: "/samples/vsco/guitar/KSHarp_A4_mf.wav" },
      { note: "C5", file: "/samples/vsco/guitar/KSHarp_C5_mf.wav" },
    ],
  },
  drums: {
    type: "drum",
    samples: {
      kick: "/samples/vsco/drums/bdrum_f_1.wav",
      snare: "/samples/vsco/drums/Snare2-HitSN_v1_rr1_Sum.wav",
      hat: "/samples/vsco/drums/cymbal-crashshort_v1.wav",
    },
  },
};
const SECTION_SEQUENCE = ["intro", "verse", "chorus", "verse", "chorus", "bridge", "chorus", "outro"];
const SECTION_PROFILES = {
  intro: {
    label: "Intro",
    percussion: "sparse",
    conductorDensity: 0.45,
    padGain: 0.65,
    octaveShift: -12,
    chordOctaveShift: -12,
  },
  verse: {
    label: "Verso",
    percussion: "dembow",
    conductorDensity: 0.65,
    padGain: 0.8,
    octaveShift: -9,
    chordOctaveShift: -12,
  },
  chorus: {
    label: "Coro",
    percussion: "full",
    conductorDensity: 0.9,
    padGain: 1.0,
    octaveShift: -7,
    chordOctaveShift: -11,
    sustainMultiplier: 1.35,
  },
  bridge: {
    label: "Puente",
    percussion: "syncopated",
    conductorDensity: 0.55,
    padGain: 0.72,
    octaveShift: -10,
    chordOctaveShift: -14,
  },
  outro: {
    label: "Outro",
    percussion: "sparse",
    conductorDensity: 0.5,
    padGain: 0.6,
    octaveShift: -12,
    chordOctaveShift: -12,
  },
};
const PERCUSSION_PATTERNS = {
  sparse: {
    steps: [
      ["kick"],
      [],
      ["hat"],
      ["snare", "hat"],
      ["kick"],
      [],
      ["hat"],
      ["snare"],
    ],
  },
  dembow: {
    steps: [
      ["kick"],
      ["hat"],
      ["snare"],
      ["hat", "clave"],
      ["kick"],
      ["hat"],
      [],
      ["snare", "clap", "hat"],
    ],
  },
  full: {
    steps: [
      ["kick", "hat"],
      [],
      ["hat"],
      ["snare", "hat"],
      ["kick"],
      ["hat"],
      ["kick"],
      ["snare", "hat"],
      ["kick", "hat"],
      [],
      ["hat"],
      ["snare", "clap"],
      ["kick"],
      ["hat"],
      ["kick"],
      ["snare", "hat", "clave"],
    ],
  },
  syncopated: {
    steps: [
      ["kick"],
      ["hat"],
      [],
      ["snare"],
      ["kick", "clave"],
      ["hat"],
      [],
      ["snare", "hat"],
    ],
  },
};
const BACKGROUND_VOICE_COLORS = {
  pad: "rgba(56,189,248,0.55)",
  bass: "rgba(147,197,253,0.7)",
  blip: "rgba(248,113,113,0.65)",
  piano: "rgba(190,242,100,0.65)",
  default: "rgba(148,163,184,0.6)",
};
const THEME_OPTIONS = {
  midnight: {
    label: "Midnight",
    bg: "210 16 12",
    note: (i) => `hsl(${(12 + i * 14) % 360} 85% 60%)`,
    tempo: (i) => `hsl(${(200 + i * 20) % 360} 70% 65%)`,
  },
  neon: {
    label: "Neón",
    bg: "275 55 10",
    note: (i) => `hsl(${(300 + i * 25) % 360} 95% 60%)`,
    tempo: (i) => `hsl(${(160 + i * 25) % 360} 90% 60%)`,
  },
  pastel: {
    label: "Pastel",
    bg: "180 30 92",
    note: () => "hsl(15 60% 70%)",
    tempo: () => "hsl(190 60% 65%)",
  },
};
const MIDI_NOTE_LIMIT = 64;
const FLAT_TO_SHARP_MAP = {
  Bb: "A#",
  Db: "C#",
  Eb: "D#",
  Gb: "F#",
  Ab: "G#",
  Cb: "B",
  Fb: "E",
};
const clampValue = (val, min, max) => Math.max(min, Math.min(max, val));
const clampMidiValue = (val, min = 28, max = 96) => Math.max(min, Math.min(max, Math.round(val)));
const getSectionProfileByIndex = (idx = 0) => {
  const key = SECTION_SEQUENCE[idx % SECTION_SEQUENCE.length] || "verse";
  const profile = SECTION_PROFILES[key] || SECTION_PROFILES.verse;
  return { key, ...profile };
};
function summarizeSectionEvents(events = []) {
  if (!events?.length) {
    return {
      medianMidi: 60,
      span: 0,
      noteDensity: 0,
      totalTime: 4,
      accentNotes: [],
      meanVelocity: 0.8,
    };
  }
  const normalized = events.map((ev, idx) => ({
    note: normalizeNoteName(ev.note || ev.name || "A4"),
    start: Number.isFinite(ev.start) ? ev.start : idx * 0.5,
    duration: Number.isFinite(ev.duration) ? Math.max(0.08, ev.duration) : 0.5,
    velocity: Number.isFinite(ev.velocity) ? ev.velocity : 0.85,
  }));
  const midis = normalized.map((ev) => midiFromNoteName(ev.note)).sort((a, b) => a - b);
  const totalTime = normalized.reduce(
    (max, ev) => Math.max(max, (ev.start ?? 0) + (ev.duration ?? 0.4)),
    0
  );
  const noteDensity = normalized.length / Math.max(1, totalTime || normalized.length * 0.4);
  const uniqNotes = Array.from(new Set(normalized.map((ev) => ev.note)));
  const meanVelocity =
    normalized.reduce((sum, ev) => sum + (ev.velocity ?? 0.8), 0) / normalized.length || 0.8;
  return {
    medianMidi: midis[Math.floor(midis.length / 2)] ?? 60,
    span: (midis[midis.length - 1] ?? 60) - (midis[0] ?? 60),
    noteDensity,
    totalTime: totalTime || normalized.length * 0.5,
    accentNotes: uniqNotes.slice(0, 8),
    meanVelocity,
  };
}
function buildSectionBackgroundLayer(timeline = [], profile = {}, summary = {}) {
  if (!timeline?.length) return [];
  const density = clampValue(profile.conductorDensity ?? 0.7, 0.2, 1.5);
  const every = Math.max(1, Math.round(1 / density));
  const octaveShift = profile.octaveShift ?? -12;
  const sustainMultiplier = profile.sustainMultiplier ?? 1.2;
  const padGain = profile.padGain ?? 0.75;
  const voice = profile.layerVoice || "pad";
  const layer = [];
  for (let i = 0; i < timeline.length; i += every) {
    const base = timeline[i];
    const midi = clampMidiValue(midiFromNoteName(base.note) + octaveShift);
    layer.push({
      start: base.start ?? 0,
      duration: Math.max(0.3, (base.duration ?? 0.4) * sustainMultiplier),
      note: nameFromMidi(midi),
      velocity: Math.min(1.2, (base.velocity ?? summary.meanVelocity ?? 0.8) * padGain),
      voice,
    });
  }
  if (summary?.accentNotes?.length) {
    const perAnchor = Math.max(2, (summary.totalTime || 8) / summary.accentNotes.length);
    summary.accentNotes.forEach((anchor, idx) => {
      const midi = clampMidiValue(midiFromNoteName(anchor) + (profile.chordOctaveShift ?? -12));
      layer.push({
        start: idx * perAnchor,
        duration: perAnchor * 1.1,
        note: nameFromMidi(midi),
        velocity: 0.55,
        voice: "pad",
      });
    });
  }
  return layer;
}
function derivePercussionSettings(profile = {}, summary = {}) {
  const base = profile.percussion || "dembow";
  const density = summary?.noteDensity ?? 0.6;
  const mapped = clampValue(density * (profile.intensityBoost ?? 1), 0.4, 1.6);
  return {
    pattern: base,
    intensity: mapped,
    humanize: profile.humanize ?? 0.018,
  };
}
function normalizeNoteName(name) {
  if (!name) return "A4";
  const match = name.match(/^([A-Ga-g])([#b]?)(-?\d+)$/);
  if (!match) return name;
  const [, letterRaw, accidental = "", octave] = match;
  const letter = letterRaw.toUpperCase();
  const key = `${letter}${accidental}`;
  const replacement = FLAT_TO_SHARP_MAP[key] || key;
  return `${replacement}${octave}`;
}
function clampBpmValue(value, fallback = 100) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.max(50, Math.min(220, Math.round(num)));
}
function pickQuantFromBeats(beats) {
  if (!Number.isFinite(beats) || beats <= 0) return null;
  let best = QUANT_POOL[0];
  let bestDiff = Infinity;
  for (const q of QUANT_POOL) {
    const beatValue = q * 4;
    const diff = Math.abs(beatValue - beats);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = q;
    }
  }
  return best;
}
async function extractPresetFromMidiFile(file) {
  const buffer = await file.arrayBuffer();
  const midi = new Midi(buffer);

  const trackInfos = midi.tracks
    .map((track, idx) => {
      const notes = Array.isArray(track?.notes)
        ? track.notes.filter((note) => (note?.duration ?? 0) > 0 || (note?.durationTicks ?? 0) > 0)
        : [];
      return {
        idx,
        isPercussion: Boolean(track?.instrument?.percussion || track?.channel === 9),
        notes,
      };
    })
    .filter((info) => info.notes.length);

  if (!trackInfos.length) throw new Error("El archivo MIDI no contiene notas reproducibles.");

  trackInfos.sort((a, b) => {
    if (a.isPercussion !== b.isPercussion) return a.isPercussion ? 1 : -1;
    return b.notes.length - a.notes.length;
  });

  const chosenTrack = trackInfos[0];
  const sortedNotes = [...chosenTrack.notes].sort((a, b) => {
    const posA = (a?.ticks ?? 0) || (a?.time ?? 0);
    const posB = (b?.ticks ?? 0) || (b?.time ?? 0);
    return posA - posB;
  });

  const sanitizedEvents = sortedNotes.map((note) => {
    const name = normalizeNoteName(note?.name ?? nameFromMidi(note?.midi ?? 69));
    return {
      name,
      start: note?.time ?? ((note?.ticks ?? 0) / (midi.header?.ppq ?? 480)) * ((60 / (midi.header?.tempos?.[0]?.bpm ?? midi.header?.bpm ?? 100)) || 0.5),
      duration: note?.duration ?? ((note?.durationTicks ?? 0) / (midi.header?.ppq ?? 480)) * ((60 / (midi.header?.tempos?.[0]?.bpm ?? midi.header?.bpm ?? 100)) || 0.5),
      velocity: note?.velocity ?? 0.9,
    };
  });
  const trimmedEvents = sanitizedEvents.filter((ev) => ev.name).slice(0, MIDI_NOTE_LIMIT);
  if (!trimmedEvents.length) throw new Error("No pude extraer notas legibles del MIDI.");
  const trimmedNotes = trimmedEvents.map((ev) => ev.name);

  const bpmCandidate = midi.header?.tempos?.length
    ? midi.header.tempos[0].bpm
    : midi.header?.bpm;
  const bpm = clampBpmValue(bpmCandidate);
  const ppq = midi.header?.ppq ?? 480;

  const durationBeats = sortedNotes
    .map((note) => {
      if (note?.durationTicks && ppq) return note.durationTicks / ppq;
      if (note?.duration && bpm) return note.duration / (60 / bpm);
      return null;
    })
    .filter((val) => Number.isFinite(val) && val > 0.03)
    .sort((a, b) => a - b);

  const medianBeats =
    durationBeats.length > 0
      ? durationBeats[Math.floor(durationBeats.length / 2)]
      : null;
  const baseQuant = pickQuantFromBeats(medianBeats ?? 0.5) || 1 / 8;
  const baseIndex = QUANT_POOL.indexOf(baseQuant);
  const altQuant =
    QUANT_POOL[
      baseIndex >= 0 ? Math.min(baseIndex + 1, QUANT_POOL.length - 1) : QUANT_POOL.length - 1
    ] || 1 / 16;

  const avgVelocity =
    sortedNotes.reduce((sum, note) => sum + (note?.velocity ?? 0.9), 0) / sortedNotes.length || 0.9;

  const tempos = [
    { quant: baseQuant, velocity: clampValue(avgVelocity * 1.1, 0.4, 1.4), angleDeg: 12, speed: 440 },
    { quant: altQuant, velocity: clampValue(avgVelocity * 0.9, 0.4, 1.2), angleDeg: -18, speed: 480 },
  ];

  return { notes: trimmedNotes, noteEvents: trimmedEvents, bpm, tempos };
}

async function extractPresetFromAudioFile(file) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioCtx();
  try {
    const arrBuf = await file.arrayBuffer();
    const audioBuf = await ctx.decodeAudioData(arrBuf);
    const notesDetected = extractNotesFromAudioBuffer(audioBuf);
    if (!notesDetected.length) throw new Error("No pude detectar notas (la señal puede ser muy densa o ruidosa).");
    const noteEvents = notesDetected
      .map((n) => ({
        name: n.note,
        start: n.start,
        duration: n.dur,
        velocity: (n.freq ? Math.min(1, Math.max(0.2, n.freq / 1200)) : 0.9),
      }))
      .slice(0, 96);
    const notesNames = noteEvents.map((n) => n.name);
    const mono = audioBuf.numberOfChannels > 1
      ? (() => {
          const a = audioBuf.getChannelData(0);
          const b = audioBuf.getChannelData(1);
          const n = Math.min(a.length, b.length);
          const m = new Float32Array(n);
          for (let i = 0; i < n; i++) m[i] = (a[i] + b[i]) * 0.5;
          return m;
        })()
      : audioBuf.getChannelData(0);
    const onsets = detectOnsetsMono(mono, audioBuf.sampleRate);
    const estBPM = estimateBPMFromOnsets(onsets);
    const tempos = DEFAULT_TEMPOS;
    return { notes: notesNames, noteEvents, bpm: estBPM, tempos };
  } finally {
    ctx.close?.();
  }
}

function splitNotesIntoSections(notes, { maxSections = 4, minPerSection = 6 } = {}) {
  if (!Array.isArray(notes) || notes.length === 0) return [];
  if (notes.length <= minPerSection) return [notes];
  const sections = Math.min(maxSections, Math.max(2, Math.ceil(notes.length / minPerSection)));
  const chunk = Math.ceil(notes.length / sections);
  const out = [];
  for (let i = 0; i < notes.length; i += chunk) {
    out.push(notes.slice(i, i + chunk));
  }
  return out;
}

function splitNotesByMusicalAnalysis(events, {
  maxSections = 6,
  minPerSection = 4,
  minGapSeconds = 0.9,
  adaptiveFactor = 1.6,
} = {}) {
  if (!Array.isArray(events) || events.length === 0) return [];
  const sorted = [...events].sort((a, b) => (a.start ?? 0) - (b.start ?? 0));
  if (sorted.length <= minPerSection) return [sorted];

  const intervals = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const delta = Math.max(0, (curr.start ?? 0) - ((prev.start ?? 0) + (prev.duration ?? 0.2)));
    intervals.push(delta);
  }
  const sortedIntervals = intervals.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  const medianGap = sortedIntervals.length
    ? sortedIntervals[Math.floor(sortedIntervals.length / 2)]
    : 0.6;
  const gapThreshold = Math.max(minGapSeconds, medianGap * adaptiveFactor);

  const sections = [];
  let current = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const gap = Math.max(0, (curr.start ?? 0) - ((prev.start ?? 0) + (prev.duration ?? 0.2)));
    if ((gap > gapThreshold && current.length >= minPerSection) || current.length >= Math.ceil(sorted.length / Math.max(2, maxSections))) {
      sections.push(current);
      current = [curr];
    } else {
      current.push(curr);
    }
  }
  if (current.length) sections.push(current);

  if (sections.length > maxSections) {
    const merged = [];
    const step = Math.ceil(sections.length / maxSections);
    for (let i = 0; i < sections.length; i += step) {
      merged.push(sections.slice(i, i + step).flat());
    }
    return merged;
  }

  return sections.filter((sec) => sec.length);
}

function buildTimelineFromEvents(events = [], fallbackNotes = [], bpm = 120) {
  if (events.length) {
    return events.map((ev) => ({
      note: ev.note || ev.name,
      start: ev.start ?? ev.begin ?? 0,
      duration: ev.duration ?? ev.dur ?? 0.5,
      velocity: ev.velocity ?? 0.9,
    }));
  }
  const beat = 60 / Math.max(1, bpm || 120);
  return fallbackNotes.map((note, idx) => ({
    note,
    start: idx * beat,
    duration: beat * 0.9,
    velocity: 0.85,
  }));
}

function buildTransitionMap(timeline = []) {
  const map = {};
  for (let i = 0; i < timeline.length - 1; i++) {
    const from = timeline[i]?.note;
    const to = timeline[i + 1]?.note;
    if (!from || !to) continue;
    if (!map[from]) map[from] = {};
    map[from][to] = (map[from][to] || 0) + 1;
  }
  return map;
}

function weightedPick(weightMap = {}) {
  const entries = Object.entries(weightMap);
  if (!entries.length) return null;
  const total = entries.reduce((sum, [, w]) => sum + (w || 0), 0) || 1;
  let r = Math.random() * total;
  for (const [note, weight] of entries) {
    r -= weight || 0;
    if (r <= 0) return note;
  }
  return entries[entries.length - 1][0];
}

function hsl(h, s, l){ return `hsl(${h} ${s}% ${l}%)`; }

function getThemePalette(themeKey) {
  return THEME_OPTIONS[themeKey] || THEME_OPTIONS.midnight;
}

function applyThemeToBalls(balls, palette) {
  return balls.map((ball, idx) => ({
    ...ball,
    color: ball.type === "tempo" ? palette.tempo(idx) : palette.note(idx),
  }));
}

function boostBallVelocities(balls, factor) {
  return balls.map((ball) => ({
    ...ball,
    vx: (ball.vx || 0) * factor,
    vy: (ball.vy || 0) * factor,
  }));
}

function kickstartBallMotion(balls, baseSpeed = 90) {
  return balls.map((ball, idx) => {
    const vx = ball.vx || 0;
    const vy = ball.vy || 0;
    if (Math.abs(vx) + Math.abs(vy) > 0.01) return ball;
    const ang = (idx * 137.5 * Math.PI) / 180;
    return {
      ...ball,
      vx: Math.cos(ang) * baseSpeed,
      vy: Math.sin(ang) * baseSpeed,
    };
  });
}

function buildSequencePreset({
  notes, tempos, bpm,
  areaW = 900, areaH = 420,
}) {
  const marginX = 60;
  const marginY = 60;
  const usableW = Math.max(240, areaW - marginX*2);
  const centerY = Math.floor(areaH * 0.5);

  const yTop = Math.max(marginY, centerY - 80);
  const yBot = Math.min(areaH - marginY, centerY + 80);

  const rNote  = 14;
  const rTempo = 12;

  const balls = [];
  const n = notes.length;
  for (let i = 0; i < n; i++){
    const t = (n === 1) ? 0.5 : (i/(n-1)); 
    const x = Math.floor(marginX + t * usableW);
    const y = (i % 2 === 0) ? yTop : yBot; 
    balls.push({
      id: i+1,
      name: `N${i+1}`,
      x, y,
      vx: 0, vy: 0,
      r: rNote,
      color: hsl((12 + i*14) % 360, 85, 60),
      type: "note",
      isNote: true,
      note: notes[i],
      voice: "blip",
      tempoQuant: 1/8,
      velocity: 1.0,
    });
  }

  const toRad = (deg) => (deg * Math.PI) / 180;
  const baseY = centerY;
  const baseXLeft  = marginX - 25;             
  const baseXRight = areaW - marginX + 25;

  tempos.forEach((tSpec, k) => {
    const id = n + 1 + k;
    const angle = toRad(tSpec.angleDeg || 0);
    const speed = tSpec.speed || 420;
    let vx = Math.cos(angle) * speed;
    let vy = Math.sin(angle) * speed;

    const fromLeft = (k % 2 === 0);
    const x0 = fromLeft ? baseXLeft : baseXRight;
    const y0 = baseY + (k - (tempos.length-1)/2) * 28; 

    if (!fromLeft) vx = -vx;

    balls.push({
      id,
      name: `T${k+1}`,
      x: x0, y: y0,
      vx, vy,
      r: rTempo,
      color: hsl(200 + 24*k, 85, 65),
      type: "tempo",
      isNote: false,
      note: "A4",
      tempoQuant: tSpec.quant ?? 1/8,
      velocity: Math.max(0.3, Math.min(1.5, tSpec.velocity ?? 1.0)),
      voice: "blip",
    });
  });

  return { balls, bpm };
}




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
const DEFAULT_BG = "210 16 12";

const NOTE_NAMES_88 = (() => {
  const names = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
  const list = [];
  for (let midi = 21; midi <= 108; midi++) {
    const n = names[midi % 12];
    const o = Math.floor(midi / 12) - 1;
    list.push(`${n}${o}`);
  }
  return list;
})();

function midiFromNoteName(note) {
  const map = { C:0,"C#":1,D:2,"D#":3,E:4,F:5,"F#":6,G:7,"G#":8,A:9,"A#":10,B:11 };
  const m = note.match(/^([A-G]#?)(-?\d+)$/);
  if (!m) return 69; 
  const [, n, o] = m;
  return 12 * (parseInt(o,10) + 1) + (map[n] ?? 0);
}



function createAudio() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioCtx();

 
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
    pad(time = ctx.currentTime, freq = 330) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, time);
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 5;
      lfoGain.gain.value = 8;
      lfo.connect(lfoGain).connect(osc.frequency);
      g.gain.setValueAtTime(0.0001, time);
      g.gain.linearRampToValueAtTime(0.25, time + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, time + 2.2);
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = freq * 3;
      osc.connect(filter).connect(g).connect(master);
      lfo.start(time);
      osc.start(time);
      osc.stop(time + 2.3);
      lfo.stop(time + 2.3);
    },
    bass(time = ctx.currentTime, freq = 110) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(freq, time);
      g.gain.setValueAtTime(0.35, time);
      g.gain.exponentialRampToValueAtTime(0.0001, time + 0.5);
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = freq * 2;
      osc.connect(filter).connect(g).connect(master);
      osc.start(time);
      osc.stop(time + 0.6);
    },
clap(time = ctx.currentTime) {
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass"; hp.frequency.value = 2000;

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0, time);
  g.gain.linearRampToValueAtTime(0.8, time + 0.005);
  g.gain.linearRampToValueAtTime(0.2, time + 0.012);
  g.gain.linearRampToValueAtTime(0.7, time + 0.020);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.12);

  noise.connect(hp).connect(g).connect(master);
  noise.start(time);
  noise.stop(time + 0.13);
},

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

  const master = ctx.createGain();
  master.gain.value = 0.9;

  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -12;
  comp.knee.value = 20;
  comp.ratio.value = 12;
  comp.attack.value = 0.003;
  comp.release.value = 0.15;

  master.connect(comp);
  comp.connect(ctx.destination);
  const mediaDest = ctx.createMediaStreamDestination();
  comp.connect(mediaDest);

  const sampleState = {
    buffers: {},
    loading: {},
  };
  const loadSampleBuffer = async (url) => {
    if (sampleState.buffers[url]) return sampleState.buffers[url];
    const res = await fetch(url);
    const arr = await res.arrayBuffer();
    const buf = await ctx.decodeAudioData(arr);
    sampleState.buffers[url] = buf;
    return buf;
  };
  const ensureInstrumentSamples = (instrument) => {
    if (sampleState.loading[instrument]) return sampleState.loading[instrument];
    const spec = SAMPLE_LIBRARY[instrument];
    if (!spec) return Promise.resolve([]);
    if (spec.type === "drum") {
      sampleState.loading[instrument] = Promise.all(
        Object.entries(spec.samples).map(async ([key, url]) => [key, await loadSampleBuffer(url)])
      ).then((pairs) => {
        sampleState.buffers[instrument] = Object.fromEntries(pairs);
        return sampleState.buffers[instrument];
      });
      return sampleState.loading[instrument];
    }
    sampleState.loading[instrument] = Promise.all(
      spec.samples.map(async (sample) => ({
        buffer: await loadSampleBuffer(sample.file),
        rootMidi: midiFromNoteName(sample.note),
      }))
    ).then((list) => {
      sampleState.buffers[instrument] = list;
      return list;
    });
    return sampleState.loading[instrument];
  };
  const getClosestSample = (instrument, midi) => {
    const list = sampleState.buffers[instrument];
    if (!Array.isArray(list) || !list.length) return null;
    let best = list[0];
    let bestDiff = Math.abs(midi - best.rootMidi);
    for (const entry of list) {
      const diff = Math.abs(midi - entry.rootMidi);
      if (diff < bestDiff) {
        best = entry;
        bestDiff = diff;
      }
    }
    return best;
  };
  const playSample = (instrument, noteName, when = ctx.currentTime, vel = 1.0, durationSec = 0.6) => {
    const spec = SAMPLE_LIBRARY[instrument];
    if (!spec) return false;
    if (!sampleState.buffers[instrument]) {
      ensureInstrumentSamples(instrument);
      return false;
    }
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(Math.max(0.05, Math.min(1.4, vel)), when);
    if (spec.type === "drum") {
      const midi = midiFromNoteName(noteName);
      const kit = sampleState.buffers[instrument];
      const key = midi < 50 ? "kick" : midi < 62 ? "snare" : "hat";
      const buffer = kit?.[key];
      if (!buffer) return false;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(gain).connect(master);
      src.start(when);
      return true;
    }
    const midi = midiFromNoteName(noteName);
    const sample = getClosestSample(instrument, midi);
    if (!sample?.buffer) return false;
    const src = ctx.createBufferSource();
    src.buffer = sample.buffer;
    src.playbackRate.setValueAtTime(Math.pow(2, (midi - sample.rootMidi) / 12), when);
    const hold = Math.max(0.12, durationSec || 0.6);
    gain.gain.setValueAtTime(Math.max(0.05, Math.min(1.2, vel)), when);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + hold);
    src.connect(gain).connect(master);
    src.start(when);
    src.stop(when + hold + 0.05);
    return true;
  };
  const preloadSamples = (instrument) => ensureInstrumentSamples(instrument);

function playNoteByName(noteName, when = ctx.currentTime, vel = 1.0) {
  const midi = midiFromNoteName(noteName);
  const f0 = freqFromMidi(midi);

  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  osc1.type = "sine";
  osc2.type = "sine";
  osc1.frequency.setValueAtTime(f0, when);
  osc2.frequency.setValueAtTime(f0 * 2, when);

  const g = ctx.createGain();
  const o2g = ctx.createGain(); 
  const A = 0.002;       
  const D = 1.2;         
  const peak = 0.9 * vel;

  g.gain.setValueAtTime(0.0001, when);
  g.gain.linearRampToValueAtTime(peak, when + A);
  g.gain.exponentialRampToValueAtTime(0.0001, when + D);

  o2g.gain.setValueAtTime(0.15 * vel, when);
  o2g.gain.exponentialRampToValueAtTime(0.0001, when + D * 0.8);

  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(Math.max(1200, f0 * 6), when);
  lp.frequency.exponentialRampToValueAtTime(800, when + D * 0.4);
  lp.frequency.exponentialRampToValueAtTime(300, when + D);

  osc1.connect(g);
  osc2.connect(o2g).connect(g);
  g.connect(lp).connect(master);

  osc1.start(when);
  osc2.start(when);
  osc1.stop(when + D + 0.05);
  osc2.stop(when + D + 0.05);
}


  return { ctx, master, voices, mediaDest, playNoteByName, playSample, preloadSamples };
}

let sharedAudio = null;
function getSharedAudio() {
  if (!sharedAudio) sharedAudio = createAudio();
  return sharedAudio;
}

function nextQuantizedTime(ctxTime, bpm, subdivision) {
  const spb = 60 / bpm;
  const step = spb * subdivision;
  if (!isFinite(step) || step <= 0) return ctxTime + 0.01;
  const steps = Math.ceil(ctxTime / step);
  return steps * step;
}


function midiFromFreq(f) { return 69 + 12 * Math.log2(f / 440); }
function freqFromMidi(m, A4=440){ return A4 * Math.pow(2, (m-69)/12); }
function nameFromMidi(m) {
  const NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
  const mi = Math.round(m);
  const name = NAMES[(mi % 12 + 12) % 12];
  const oct  = Math.floor(mi/12) - 1;
  return `${name}${oct}`;
}

function yinPitch(frame, sampleRate, threshold=0.10, minF=60, maxF=1500) {
  const N = frame.length;
  const tauMin = Math.floor(sampleRate / maxF);
  const tauMax = Math.floor(sampleRate / minF);
  const diff = new Float32Array(tauMax+1);
  diff.fill(0);

  for (let tau = 1; tau <= tauMax; tau++) {
    let d = 0;
    for (let i = 0; i < N - tau; i++) {
      const delta = frame[i] - frame[i + tau];
      d += delta * delta;
    }
    diff[tau] = d;
  }
  let running = 0;
  for (let tau = 1; tau <= tauMax; tau++) {
    running += diff[tau];
    diff[tau] = diff[tau] * tau / (running || 1e-12);
  }

  let tau = tauMin;
  let best = -1;
  for (tau = tauMin; tau <= tauMax; tau++) {
    if (diff[tau] < threshold) { best = tau; break; }
  }
  if (best === -1) {
    let minV = Infinity, minI = -1;
    for (let t = tauMin; t <= tauMax; t++) {
      if (diff[t] < minV) { minV = diff[t]; minI = t; }
    }
    best = minI;
  }
  if (best <= 0) return null;
  const x0 = diff[best-1] ?? diff[best];
  const x1 = diff[best];
  const x2 = diff[best+1] ?? diff[best];
  const denom = (x0 + x2 - 2*x1);
  const shift = denom ? 0.5 * (x0 - x2) / denom : 0;
  const tauEst = Math.max(1, best + shift);

  const freq = sampleRate / tauEst;
  if (!isFinite(freq) || freq <= 0) return null;
  return freq;
}

function detectOnsetsMono(samples, sampleRate, hop=512, win=2048, rmsThresh=0.02, derivThresh=0.015) {
  const n = samples.length;
  const onsets = [];
  const rmsArr = [];

  for (let start = 0; start + win <= n; start += hop) {
    let sum = 0;
    for (let i = 0; i < win; i++) {
      const v = samples[start+i];
      sum += v*v;
    }
    const rms = Math.sqrt(sum / win);
    rmsArr.push(rms);
  }

  for (let i = 1; i < rmsArr.length; i++) {
    const dr = rmsArr[i] - rmsArr[i-1];
    if (rmsArr[i] > rmsThresh && dr > derivThresh) {
      const t = (i * hop) / sampleRate;
      if (onsets.length === 0 || (t - onsets[onsets.length - 1]) > 0.09) {
        onsets.push(t);
      }
    }
  }
  if (onsets.length === 0) onsets.push(0);
  return onsets;
}

function extractNotesFromAudioBuffer(audioBuffer, {
  downsampleTo = 22050,
  hop = 256,
  win = 2048,
  yinThresh = 0.10,
} = {}) {
  const ch0 = audioBuffer.getChannelData(0);
  let mono = ch0;
  if (audioBuffer.numberOfChannels > 1) {
    const ch1 = audioBuffer.getChannelData(1);
    const n = Math.min(ch0.length, ch1.length);
    mono = new Float32Array(n);
    for (let i = 0; i < n; i++) mono[i] = 0.5 * (ch0[i] + ch1[i]);
  }

  const sr = audioBuffer.sampleRate;

  let s = mono, srs = sr;
  if (sr > downsampleTo) {
    const ratio = sr / downsampleTo;
    const newLen = Math.floor(mono.length / ratio);
    const out = new Float32Array(newLen);
    for (let i = 0; i < newLen; i++) {
      out[i] = mono[Math.floor(i * ratio)] || 0;
    }
    s = out; srs = downsampleTo;
  }

  const onsets = detectOnsetsMono(s, srs, 512, 2048);

  const notesOut = [];
  const segs = [...onsets, (s.length / srs)]; 
  for (let k = 0; k < segs.length - 1; k++) {
    const t0 = segs[k], t1 = segs[k+1];
    const i0 = Math.floor(t0 * srs);
    const i1 = Math.max(i0 + win, Math.floor(t1 * srs)); 

    const pitches = [];
    for (let i = i0; i + win <= i1; i += hop) {
      const frame = s.subarray(i, i + win);
      const f0 = yinPitch(frame, srs, yinThresh);
      if (f0 && f0 >= 60 && f0 <= 1500) pitches.push(f0);
    }

    if (pitches.length) {
      pitches.sort((a,b) => a-b);
      const med = pitches[(pitches.length/2)|0];
      const midi = midiFromFreq(med);
      const name = nameFromMidi(midi);

      notesOut.push({
        note: name,
        start: t0,
        dur: Math.max(0.08, t1 - t0),
        freq: med,
        midi
      });
    }
  }
  return notesOut;
}

function estimateBPMFromOnsets(onsets) {
  if (!onsets || onsets.length < 4) return 100;
  const intervals = [];
  for (let i = 1; i < onsets.length; i++) intervals.push(onsets[i] - onsets[i-1]);
  const med = intervals.sort((a,b)=>a-b)[(intervals.length/2)|0];
  const bpm = Math.round(60 / Math.max(med, 1e-3));
  return Math.max(60, Math.min(180, bpm));
}


function CanvasRig({
  instanceIndex,
  onRemove,
  canRemove,
  preset,
  durationSec = 16,
  onDurationChange,
  shouldAutoRun = false,
  autoPlayEnabled = false,
  forcePlay = false,
  themeKey = "midnight",
  performanceMode = false,
  melodyVoice = "piano",
  onInstrumentChange,
  backgroundPad = true,
  backgroundRhythm = true,
}) {

const [canvasSize, setCanvasSize] = useState({ w: 520, h: 520 }); 
const canvasWrapRef = useRef(null);
const resizingRef = useRef(null); 
  useEffect(() => {
    needsRedrawRef.current = true;
  }, [canvasSize]);


  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const lastTRef = useRef(0);
  const pairsCooldown = useRef(new Map());

  const audioRef = useRef(null);

  const [flashAlpha, setFlashAlpha] = useState(0);

  const [isRunning, setIsRunning] = useState(false);
  const isRunningRef = useRef(isRunning);
  useEffect(() => {
    isRunningRef.current = isRunning;
    needsRedrawRef.current = true;
  }, [isRunning]);
  const [bpm, setBpm] = useState(preset?.bpm ?? 100);
  const [quant, setQuant] = useState(1 / 8);

  const palette = useMemo(() => getThemePalette(themeKey), [themeKey]);
  const [balls, setBalls] = useState(() =>
    preset?.balls
      ? applyThemeToBalls(preset.balls.map((ball, idx) => ({ ...ball, id: idx + 1 })), palette)
      : applyThemeToBalls(
          Array.from({ length: 5 }).map((_, i) => ({
            id: i + 1,
            name: `Bola ${i + 1}`,
            x: rnd(100, 500),
            y: rnd(80, 300),
          vx: rnd(-120, 120) * 1.3,
          vy: rnd(-120, 120) * 1.3,
            r: rnd(10, 16),
            color: `hsl(${Math.floor(rnd(0, 360))} 80% 60%)`,
            voice: VOICES[i % VOICES.length].value,
            type: "note",
            isNote: true,
            note: "A4",
            tempoQuant: 1 / 8,
            velocity: 1.0,
          })),
          palette
        )
  );
  const ballsRef = useRef([]);
  const needsRedrawRef = useRef(true);
  const timelineEventsRef = useRef(Array.isArray(preset?.timeline) ? preset.timeline : []);
  const timelineCursorRef = useRef(0);
  const timelineStartRef = useRef(0);
  const timelineRafRef = useRef(null);
  const backgroundEventsRef = useRef(
    Array.isArray(preset?.backgroundMelody) ? preset.backgroundMelody : []
  );
  const backgroundCursorRef = useRef(0);
  const backgroundStartRef = useRef(0);
  const backgroundRafRef = useRef(null);
  const backgroundLengthRef = useRef(Math.max(durationSec || 8, 1));
  const percussionPatternRef = useRef(preset?.percussion || null);
  const backgroundRhythmRef = useRef(backgroundRhythm);
  const percussionStateRef = useRef({ nextTime: 0, step: 0 });
  const percussionRafRef = useRef(null);
  const lastPadTriggerRef = useRef(-Infinity);
  useEffect(() => {
    ballsRef.current = balls.map((b) => ({ ...b }));
    needsRedrawRef.current = true;
  }, [balls]);

  const applyBallsUpdate = (updater) => {
    setBalls((prev) => {
      const base =
        typeof updater === "function"
          ? updater(prev.map((b) => ({ ...b })))
          : updater.map((b) => ({ ...b }));
      ballsRef.current = base.map((b) => ({ ...b }));
      needsRedrawRef.current = true;
      return base;
    });
  };
  const presetVersionRef = useRef(preset?.version ?? null);
  useEffect(() => {
    setBalls((prev) => applyThemeToBalls(prev, palette));
  }, [palette]);
  useEffect(() => {
    timelineEventsRef.current = Array.isArray(preset?.timeline) ? preset.timeline : [];
    markovMapRef.current = typeof preset?.transitions === "object" ? preset.transitions : {};
    const firstNote = timelineEventsRef.current[0]?.note || preset?.noteOrder?.[0] || null;
    setAllowedNotes(firstNote ? [firstNote] : []);
    timelineCursorRef.current = 0;
    backgroundEventsRef.current = Array.isArray(preset?.backgroundMelody)
      ? preset.backgroundMelody
      : [];
    backgroundCursorRef.current = 0;
    const maxEnd = backgroundEventsRef.current.reduce(
      (acc, ev) => Math.max(acc, (ev.start ?? 0) + (ev.duration ?? 0.4)),
      0
    );
    backgroundLengthRef.current = Math.max(durationSec || 8, maxEnd || 1);
    percussionPatternRef.current = preset?.percussion || null;
    backgroundRhythmRef.current = backgroundRhythm;
    lastPadTriggerRef.current = -Infinity;
    needsRedrawRef.current = true;
  }, [preset, backgroundRhythm]);
  useEffect(() => {
    timelineEventsRef.current = Array.isArray(preset?.timeline) ? preset.timeline : [];
    timelineCursorRef.current = 0;
  }, [preset]);
  useEffect(() => {
    if (!preset || !preset.version || presetVersionRef.current === preset.version) return;
    presetVersionRef.current = preset.version;
    if (Array.isArray(preset.balls)) {
      applyBallsUpdate(applyThemeToBalls(preset.balls.map((ball, idx) => ({ ...ball, id: idx + 1 })), palette));
    }
    if (preset.bpm) setBpm(preset.bpm);
    ensureAudio();
    const autoStart = (autoPlayEnabled ? shouldAutoRun : false) || forcePlay;
    setIsRunning(autoStart);
  }, [preset, autoPlayEnabled, shouldAutoRun, palette, forcePlay]);

  useEffect(() => {
    const shouldRun = (autoPlayEnabled && shouldAutoRun) || forcePlay;
    if (shouldRun) {
      const audio = getSharedAudio();
      if (audio.ctx.state !== "running") audio.ctx.resume();
    }
    setIsRunning(shouldRun);
  }, [shouldAutoRun, autoPlayEnabled, forcePlay]);

  useEffect(() => {
    if (!shouldAutoRun) return;
    setFlashAlpha(0.6);
  }, [shouldAutoRun]);
  useEffect(() => {
    if (melodyVoice !== "drums") return;
    applyBallsUpdate((prev) => {
      let drumIdx = 0;
      return prev.map((ball) => {
        if (ball.type !== "note") return ball;
        const drumNote = DRUM_NOTE_OPTIONS[drumIdx % DRUM_NOTE_OPTIONS.length]?.value || "C2";
        drumIdx += 1;
        return { ...ball, note: drumNote };
      });
    });
  }, [melodyVoice]);
  useEffect(() => {
    const currentMax = backgroundEventsRef.current.reduce(
      (acc, ev) => Math.max(acc, (ev.start ?? 0) + (ev.duration ?? 0.4)),
      0
    );
    backgroundLengthRef.current = Math.max(durationSec || 8, currentMax || 1);
    needsRedrawRef.current = true;
  }, [durationSec]);

  useEffect(() => {
    if (flashAlpha <= 0) return;
    const id = requestAnimationFrame(() =>
      setFlashAlpha((prev) => (prev <= 0.02 ? 0 : prev - 0.04))
    );
    return () => cancelAnimationFrame(id);
  }, [flashAlpha]);

  const noteOrder = useMemo(() => preset?.noteOrder || [], [preset]);
  const noteOrderRef = useRef(noteOrder);
  const noteIndexRef = useRef(0);
  const [allowedNotes, setAllowedNotes] = useState(noteOrder[0] ? [noteOrder[0]] : []);
  const markovMapRef = useRef(typeof preset?.transitions === "object" ? preset.transitions : {});
  const backgroundLayerCount = preset?.backgroundMelody?.length ?? 0;
  const percussionSignature = `${preset?.percussion?.pattern || "none"}-${
    Math.round((preset?.percussion?.intensity ?? 0) * 100)
  }`;
  useEffect(() => {
    noteOrderRef.current = noteOrder;
    noteIndexRef.current = 0;
    if (melodyVoice === "drums") {
      setAllowedNotes([]);
      return;
    }
    if (timelineEventsRef.current.length) {
      setAllowedNotes([timelineEventsRef.current[0].note]);
    } else if (noteOrder[0]) {
      setAllowedNotes([noteOrder[0]]);
    } else {
      setAllowedNotes([]);
    }
  }, [melodyVoice, noteOrder]);
  const resetNoteOrder = useCallback(() => {
    noteIndexRef.current = 0;
    const firstTimeline = timelineEventsRef.current[0]?.note;
    if (melodyVoice === "drums") {
      setAllowedNotes([]);
    } else if (firstTimeline) {
      setAllowedNotes([firstTimeline]);
    } else if (noteOrderRef.current[0]) {
      setAllowedNotes([noteOrderRef.current[0]]);
    } else {
      setAllowedNotes([]);
    }
  }, [melodyVoice]);
  const allowedNoteLabel = allowedNotes?.length ? allowedNotes.join(", ") : "—";

  const draggingIdRef = useRef(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const lastPtrRef = useRef({ x: 0, y: 0, t: 0 });
  const showArrowRef = useRef(null);
  const pointerHistoryRef = useRef([]);

  const MAX_SPEED = 260;
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

  const ensureAudio = useCallback(() => {
    if (!audioRef.current) audioRef.current = getSharedAudio();
    if (audioRef.current.ctx.state !== "running") audioRef.current.ctx.resume();
  }, []);

  const playInstrumentNote = useCallback((note, when, velocity = 1.0, durationSec = 0.6) => {
    if (!note) return;
    ensureAudio();
    const { playNoteByName, playSample, preloadSamples, voices } = audioRef.current;
    if (SAMPLE_LIBRARY[melodyVoice]) preloadSamples?.(melodyVoice);
    const midi = midiFromNoteName(note);
    const freq = freqFromMidi(midi);
    const playChord = (rootNote, baseVelocity) => {
      CHORD_INTERVALS.forEach((interval, idx) => {
        const chordMidi = midiFromNoteName(rootNote) + interval;
        const chordNote = nameFromMidi(chordMidi);
        const v = idx === 0 ? baseVelocity : baseVelocity * 0.55;
        const played = playSample?.(melodyVoice, chordNote, when, v, durationSec);
        if (!played) playNoteByName(chordNote, when, v);
      });
    };
    if (melodyVoice === "pad") {
      voices.pad?.(when, freq);
    } else if (melodyVoice === "bass") {
      voices.bass?.(when, freq);
    } else if (melodyVoice === "blip") {
      (voices.blip || playNoteByName)(when);
      playNoteByName(note, when, velocity * 0.7);
    } else if (melodyVoice === "drums") {
      const played = playSample?.("drums", note, when, velocity, durationSec);
      if (!played) {
        const midi = midiFromNoteName(note);
        if (midi < 50) voices.kick?.(when);
        else if (midi < 62) voices.snare?.(when);
        else voices.hat?.(when);
      }
    } else if (SAMPLE_LIBRARY[melodyVoice]) {
      if (CHORD_VOICES.has(melodyVoice)) {
        playChord(note, velocity);
      } else {
        const played = playSample?.(melodyVoice, note, when, velocity, durationSec);
        if (!played) playNoteByName(note, when, velocity);
      }
    } else {
      playNoteByName(note, when, velocity);
    }
    if (backgroundPad && melodyVoice !== "drums") {
      if (melodyVoice !== "pad") voices.pad?.(when + 0.01, freq);
      if (melodyVoice !== "bass") voices.bass?.(when + 0.02, freq / 2);
    }
  }, [backgroundPad, ensureAudio, melodyVoice]);

  const triggerCombo = useCallback((tempoBall, noteBall) => {
    if (!audioRef.current) return;
    const { ctx } = audioRef.current;
  
    if (melodyVoice === "drums") {
      const sub = tempoBall?.tempoQuant || quant;
      const t = ctx.currentTime + 0.03;
      const qt = nextQuantizedTime(t, bpm, sub * 4);
      const vel = Math.max(0.1, Math.min(1.5, tempoBall?.velocity ?? 1.0));
      playInstrumentNote(noteBall.note, qt, vel);
      return;
    }
    const sequence = noteOrderRef.current;
    const allowedSet = allowedNotes?.length ? allowedNotes : sequence;
    if (allowedSet.length && !allowedSet.includes(noteBall.note)) return;
 
    const sub = tempoBall?.tempoQuant || quant;
    const t = ctx.currentTime + 0.03;
    const qt = nextQuantizedTime(t, bpm, sub * 4);
 
    const vel = Math.max(0.1, Math.min(1.5, tempoBall?.velocity ?? 1.0));
    const dur = (60 / Math.max(40, bpm)) * ((sub || quant) * 4) * 0.9;
    playInstrumentNote(noteBall.note, qt, vel, dur);
    const transitions = markovMapRef.current[noteBall.note];
    if (transitions && Object.keys(transitions).length) {
      setAllowedNotes([weightedPick(transitions)]);
    } else if (sequence.length) {
      noteIndexRef.current = (noteIndexRef.current + 1) % sequence.length;
      const next = sequence[noteIndexRef.current % sequence.length] ?? sequence[0] ?? null;
      setAllowedNotes(next ? [next] : []);
    } else {
      setAllowedNotes([]);
    }
  }, [allowedNotes, bpm, melodyVoice, playInstrumentNote, quant]);
  const triggerComboRef = useRef(triggerCombo);
  useEffect(() => { triggerComboRef.current = triggerCombo; }, [triggerCombo]);

  const startTimelinePlayback = useCallback(() => {
    const events = timelineEventsRef.current;
    if (!events.length) return;
    ensureAudio();
    const { ctx } = audioRef.current;
    timelineCursorRef.current = 0;
    timelineStartRef.current = ctx.currentTime;
    const lookAhead = 0.25;

    const loop = () => {
      if (!isRunningRef.current) return;
      const list = timelineEventsRef.current;
      if (!list.length) return;
      const now = ctx.currentTime;
      const elapsed = now - timelineStartRef.current;
      while (
        timelineCursorRef.current < list.length &&
        (list[timelineCursorRef.current].start ?? 0) <= elapsed + lookAhead
      ) {
        const ev = list[timelineCursorRef.current];
        const when = timelineStartRef.current + (ev.start ?? 0);
        if (when >= now) playInstrumentNote(ev.note, when, ev.velocity ?? 0.9, ev.duration ?? 0.6);
        if (
          backgroundPad &&
          !backgroundEventsRef.current.length &&
          audioRef.current?.voices?.pad &&
          (ev.start ?? 0) - lastPadTriggerRef.current > 0.8
        ) {
          const freq = freqFromMidi(midiFromNoteName(ev.note));
          audioRef.current.voices.pad(when, freq * 0.5);
          lastPadTriggerRef.current = ev.start ?? 0;
        }
        timelineCursorRef.current++;
      }
      if (timelineCursorRef.current >= list.length) return;
      timelineRafRef.current = requestAnimationFrame(loop);
    };

    timelineRafRef.current = requestAnimationFrame(loop);
  }, [backgroundPad, ensureAudio, playInstrumentNote]);

  const startBackgroundLayer = useCallback(() => {
    const events = backgroundEventsRef.current;
    if (!events.length || !backgroundPad) return;
    ensureAudio();
    const { ctx, voices, playNoteByName } = audioRef.current;
    const lookAhead = 0.25;
    backgroundCursorRef.current = 0;
    backgroundStartRef.current = ctx.currentTime;

    const trigger = (ev, when) => {
      const voice = ev.voice || "pad";
      const velocity = ev.velocity ?? 0.7;
      if (!ev.note) return;
      const freq = freqFromMidi(midiFromNoteName(ev.note));
      if (voice === "pad" && voices.pad) voices.pad(when, freq);
      else if (voice === "bass" && voices.bass) voices.bass(when, freq);
      else if (voice === "blip" && voices.blip) {
        voices.blip(when);
        playNoteByName(ev.note, when, velocity);
      } else {
        playNoteByName(ev.note, when, velocity);
      }
    };

    const loop = () => {
      if (!isRunningRef.current) return;
      const list = backgroundEventsRef.current;
      if (!list.length) return;
      const now = ctx.currentTime;
      const elapsed = now - backgroundStartRef.current;
      while (
        backgroundCursorRef.current < list.length &&
        (list[backgroundCursorRef.current].start ?? 0) <= elapsed + lookAhead
      ) {
        const ev = list[backgroundCursorRef.current];
        const when = backgroundStartRef.current + (ev.start ?? 0);
        if (when >= now) trigger(ev, when);
        backgroundCursorRef.current++;
      }
      if (backgroundCursorRef.current >= list.length) return;
      backgroundRafRef.current = requestAnimationFrame(loop);
    };

    backgroundRafRef.current = requestAnimationFrame(loop);
  }, [backgroundPad, ensureAudio]);

  const startPercussionLoop = useCallback(() => {
    const settings = percussionPatternRef.current;
    if (!settings?.pattern) return;
    const pattern = PERCUSSION_PATTERNS[settings.pattern];
    if (!pattern?.steps?.length) return;
    ensureAudio();
    const { ctx, voices } = audioRef.current;
    const steps = pattern.steps.length;
    const stepDur = ((60 / bpm) * 4) / steps;
    const lookAhead = 0.25;
    const intensity = clampValue(settings.intensity ?? 1, 0.3, 1.6);
    percussionStateRef.current = { nextTime: ctx.currentTime + 0.04, step: 0 };

    const loop = () => {
      if (!isRunningRef.current) return;
      const now = ctx.currentTime;
      while (percussionStateRef.current.nextTime < now + lookAhead) {
        const stepIdx = percussionStateRef.current.step % steps;
        const events = pattern.steps[stepIdx] || [];
        events.forEach((voiceName) => {
          if (voiceName === "hat" && Math.random() > intensity) return;
          if (voiceName === "clap" && intensity < 0.6 && stepIdx % 4 !== 0) return;
          voices[voiceName]?.(percussionStateRef.current.nextTime);
        });
        percussionStateRef.current.nextTime += stepDur;
        percussionStateRef.current.step++;
      }
      percussionRafRef.current = requestAnimationFrame(loop);
    };

    percussionRafRef.current = requestAnimationFrame(loop);
  }, [bpm, ensureAudio]);

  useEffect(() => {
    if (timelineRafRef.current) {
      cancelAnimationFrame(timelineRafRef.current);
      timelineRafRef.current = null;
    }
    if (!isRunning) {
      timelineCursorRef.current = 0;
      lastPadTriggerRef.current = -Infinity;
      return;
    }
    if (!timelineEventsRef.current.length) return;
    startTimelinePlayback();
    return () => {
      if (timelineRafRef.current) {
        cancelAnimationFrame(timelineRafRef.current);
        timelineRafRef.current = null;
      }
    };
  }, [isRunning, startTimelinePlayback]);
  useEffect(() => {
    if (!backgroundPad) lastPadTriggerRef.current = -Infinity;
  }, [backgroundPad]);
  useEffect(() => {
    backgroundRhythmRef.current = backgroundRhythm;
  }, [backgroundRhythm]);

  useEffect(() => {
    if (backgroundRafRef.current) {
      cancelAnimationFrame(backgroundRafRef.current);
      backgroundRafRef.current = null;
    }
    if (!isRunning || !backgroundPad || !backgroundEventsRef.current.length) {
      backgroundCursorRef.current = 0;
      return;
    }
    startBackgroundLayer();
    return () => {
      if (backgroundRafRef.current) {
        cancelAnimationFrame(backgroundRafRef.current);
        backgroundRafRef.current = null;
      }
    };
  }, [backgroundPad, backgroundLayerCount, isRunning, startBackgroundLayer]);

  useEffect(() => {
    if (percussionRafRef.current) {
      cancelAnimationFrame(percussionRafRef.current);
      percussionRafRef.current = null;
    }
    percussionStateRef.current = { nextTime: 0, step: 0 };
    if (!isRunning || !backgroundRhythmRef.current || !percussionPatternRef.current?.pattern) return;
    startPercussionLoop();
    return () => {
      if (percussionRafRef.current) {
        cancelAnimationFrame(percussionRafRef.current);
        percussionRafRef.current = null;
      }
    };
  }, [bpm, isRunning, backgroundRhythm, percussionSignature, startPercussionLoop]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let width = 0;
    let height = 0;
    const dpr = window.devicePixelRatio || 1;
    const resizeBacking = () => {
      const cssW = canvas.clientWidth;
      const cssH = canvas.clientHeight;
      const targetW = Math.max(1, Math.floor(cssW * dpr));
      const targetH = Math.max(1, Math.floor(cssH * dpr));
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
      width = canvas.width;
      height = canvas.height;
      needsRedrawRef.current = true;
    };
    resizeBacking();
    let ro;
    if (canvasWrapRef.current) {
      ro = new ResizeObserver(() => resizeBacking());
      ro.observe(canvasWrapRef.current);
    }
    const onResize = () => resizeBacking();
    window.addEventListener("resize", onResize);
    const onDPRChange = () => resizeBacking();
    const mm = window.matchMedia?.(`(resolution: ${dpr}dppx)`);
    mm?.addEventListener?.("change", onDPRChange);

    const onPointerDown = (e) => {
      const p = getPointer(e, canvas);
      lastPtrRef.current = p;
      pointerHistoryRef.current = [p];
      let hit = null;
      applyBallsUpdate((prev) => {
        const arr = prev.map((b) => ({ ...b }));
        const [b, idx] = findBallAt(p.x, p.y, arr);
        hit = b;
        if (b && idx >= 0) {
          draggingIdRef.current = b.id;
          dragOffsetRef.current = { x: p.x - b.x, y: p.y - b.y };
          showArrowRef.current = { x: p.x, y: p.y };
          arr[idx].vx = 0;
          arr[idx].vy = 0;
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
      applyBallsUpdate((prev) => {
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
      const cutoff = p.t - 120;
      pointerHistoryRef.current = pointerHistoryRef.current.filter((pt) => pt.t >= cutoff);
      if (pointerHistoryRef.current.length > 12) pointerHistoryRef.current.shift();
    };

    const onPointerUp = (e) => {
      if (!draggingIdRef.current) return;
      const id = draggingIdRef.current;
      const hist = pointerHistoryRef.current;
      if (hist.length >= 2) {
        const pNow = hist[hist.length - 1];
        let pPast = hist[0];
        for (let i = hist.length - 1; i >= 0; i--) {
          if (pNow.t - hist[i].t >= 60) {
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
        applyBallsUpdate((prevBalls) => {
          const arr = prevBalls.map((b) => ({ ...b }));
          const i = arr.findIndex((b) => b.id === id);
          if (i >= 0) {
            arr[i].vx = vx;
            arr[i].vy = vy;
          }
          return arr;
        });
      } else {
        applyBallsUpdate((prevBalls) => {
          const arr = prevBalls.map((b) => ({ ...b }));
          const i = arr.findIndex((b) => b.id === id);
          if (i >= 0) {
            arr[i].vx = 0;
            arr[i].vy = 0;
          }
          return arr;
        });
      }
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
      if (!isFinite(dt) || dt < 0) dt = 0;
      if (dt > 0.05) dt = 0.05;
      lastTRef.current = t;
      const arr = ballsRef.current;
      const perfMode = performanceMode || true;
      const allowedSet = allowedNotes?.length ? new Set(allowedNotes) : null;
      const isActiveForCollision = (ball) =>
        !allowedSet || !ball.isNote || allowedSet.has(ball.note);
      const shouldSimulate = isRunningRef.current;
      if (shouldSimulate) {
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
            if (!isActiveForCollision(arr[i]) || !isActiveForCollision(arr[j])) continue;
            if (perfMode && ((i + j) % 2 === 1)) continue;
            const a = arr[i], b = arr[j];
            const dx = b.x - a.x, dy = b.y - a.y;
            const dist = Math.hypot(dx, dy);
            const minD = a.r + b.r;
            if (dist < minD) {
              const key = `${a.id}-${b.id}`;
              const now = t;
              const last = pairsCooldown.current.get(key) || 0;
              const cooldown = perfMode ? 60 : 30;
              if (now - last > cooldown) {
                pairsCooldown.current.set(key, now);
                const aIsTempo = a.type === "tempo";
                const bIsTempo = b.type === "tempo";
                const aIsNote = a.type === "note";
                const bIsNote = b.type === "note";
                const allowedNoteSet = allowedSet;
                const aNoteAllowed = !allowedNoteSet || !aIsNote || allowedNoteSet.has(a.note);
                const bNoteAllowed = !allowedNoteSet || !bIsNote || allowedNoteSet.has(b.note);
                const willTrigger =
                  (aIsTempo && bIsNote && bNoteAllowed) || (bIsTempo && aIsNote && aNoteAllowed);
                if (willTrigger) {
                  if (aIsTempo && bIsNote) triggerComboRef.current?.(a, b);
                  else if (bIsTempo && aIsNote) triggerComboRef.current?.(b, a);
                } else {
                  continue; 
                }
              }
              const overlap = (minD - dist || 0.01) * (perfMode ? 0.35 : 0.7);
              const nx = dx / (dist || 1);
              const ny = dy / (dist || 1);
              a.x -= nx * overlap * 0.35; a.y -= ny * overlap * 0.35;
              b.x += nx * overlap * 0.35; b.y += ny * overlap * 0.35;
              if (Math.random() < 0.15 && !perfMode) continue;
              const avn = a.vx * nx + a.vy * ny;
              const bvn = b.vx * nx + b.vy * ny;
              const swap = bvn - avn;
              a.vx += nx * swap; a.vy += ny * swap;
              b.vx -= nx * swap; b.vy -= ny * swap;
            }
          }
        }
        needsRedrawRef.current = true;
      }
      const shouldDraw = needsRedrawRef.current || shouldSimulate || draggingIdRef.current;
      if (shouldDraw) {
        needsRedrawRef.current = false;
        ctx.clearRect(0, 0, width, height);
        ctx.save();
        const bg = palette.bg || DEFAULT_BG;
        ctx.fillStyle = `hsl(${bg} / 0.12)`;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
        const allowedSet = allowedNotes?.length ? new Set(allowedNotes) : null;
        for (const b of arr) {
          const allowed = !allowedSet || !b.isNote || allowedSet.has(b.note);
          ctx.save();
          ctx.globalAlpha = allowed ? 1 : 0.28;
          ctx.beginPath();
          ctx.fillStyle = b.color;
          ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        if (showArrowRef.current && draggingIdRef.current && !(perfMode && !shouldSimulate)) {
          const id = draggingIdRef.current;
          const b = arr.find((bb) => bb.id === id);
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
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onResize);
      mm?.removeEventListener?.("change", onDPRChange);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      ro?.disconnect();
    };
  }, [performanceMode, palette, allowedNotes]);



  const addNoteBall = () => {
    const id = (balls.at(-1)?.id || 0) + 1;
    applyBallsUpdate((arr) => [...arr, {
      id,
      name: `Bola ${id}`,
      x: rnd(50, (canvasRef.current?.clientWidth || 640) - 50),
      y: rnd(50, (canvasRef.current?.clientHeight || 360) - 50),
      vx: rnd(-160, 160) * 1.4,
      vy: rnd(-160, 160) * 1.4,
      r: rnd(10, 16),
      color: palette.note(arr.length),
      voice: VOICES[Math.floor(rnd(0, VOICES.length))].value,
      type: "note",
      isNote: true,
      note: "A4",
      tempoQuant: 1/8,
      velocity: 1.0,
    }]);
  };
  const updateBallName = (id, name) =>
    applyBallsUpdate((arr) => arr.map((b) => (b.id === id ? { ...b, name } : b)));
  
  const updateBallNote = (id, note) =>
    applyBallsUpdate((arr) => arr.map((b) => (b.id === id ? { ...b, note } : b)));

  const updateBallType = (id, type) =>
    applyBallsUpdate((arr) => arr.map((b) => b.id === id
      ? {
          ...b,
          type,
          isNote: type === "note",
          color: type === "note"
            ? palette.note(id)
            : palette.tempo(id),
        }
      : b
    ));
  
  const updateBallTempoQuant = (id, q) =>
    applyBallsUpdate((arr) => arr.map((b) => b.id === id ? { ...b, tempoQuant: q } : b));
  
  const updateBallVelocity = (id, v) =>
    applyBallsUpdate((arr) => arr.map((b) => b.id === id ? { ...b, velocity: v } : b));

  const removeBallById = (id) =>
    applyBallsUpdate((arr) => (arr.length > 1 ? arr.filter((b) => b.id !== id) : arr));
  
  
  const nudgeEnergy = (scale = 1.1) =>
    applyBallsUpdate((arr) => arr.map((b) => ({ ...b, vx: b.vx * scale, vy: b.vy * scale })));

  
  const displayTitle = preset?.label || `Canvas #${instanceIndex + 1}`;

  return (
    <section className="rounded-3xl bg-slate-900/80 text-slate-100 p-4 ring-1 ring-slate-800 shadow-xl">
      <header className="flex flex-wrap gap-2 mb-4 items-center">
        <div className="flex items-center gap-2 pr-4 border-r border-slate-700 mb-2 sm:mb-0">
          <h2 className="text-lg font-semibold tracking-wide text-slate-100">
            {displayTitle}
          </h2>
          {canRemove && (
            <button
              onClick={onRemove}
              className="px-3 py-1 rounded-2xl bg-rose-600 hover:bg-rose-700 text-sm"
            >
              Cerrar
            </button>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          Duración (s)
          <input
            type="number"
            min={3}
            max={120}
            step={1}
            value={durationSec}
            onChange={(e) => onDurationChange?.(Number(e.target.value) || 8)}
            className="bg-slate-800 rounded-xl px-2 py-1 w-20 text-right"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          Instrumento
          <select
            value={melodyVoice}
            onChange={(e) => onInstrumentChange?.(e.target.value)}
            className="bg-slate-800 rounded-xl px-3 py-1"
          >
            {MELODY_VOICES.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
        {(timelineEventsRef.current.length || noteOrder.length) ? (
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <span>Notas permitidas: {allowedNoteLabel}</span>
            <button
              onClick={resetNoteOrder}
              className="px-2 py-1 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs"
              type="button"
            >
              Reiniciar orden
            </button>
          </div>
        ) : null}
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
          
        </label>

        <button
          onClick={() => { ensureAudio(); nudgeEnergy(1.1); }}
          className="px-4 py-2 rounded-2xl bg-sky-500 hover:bg-sky-600"
        >
          Velocidad +
        </button>
        <button
          onClick={() => { ensureAudio(); nudgeEnergy(0.9); }}
          className="px-4 py-2 rounded-2xl bg-purple-500 hover:bg-purple-600"
        >
          Velocidad –
        </button>

      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      <div className="lg:col-span-3">
  <div
    ref={canvasWrapRef}
    className="relative rounded-3xl ring-1 ring-slate-700 overflow-hidden select-none"
    style={{
      width: `${canvasSize.w}px`,
      height: `${canvasSize.h}px`,
      background: `hsl(${palette.bg || DEFAULT_BG} / 0.08)`,
    }}
  >
    <canvas ref={canvasRef} className="w-full h-full block" />
    {flashAlpha > 0 && (
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `rgba(255,255,255,${flashAlpha})`,
          mixBlendMode: "screen",
        }}
      />
    )}

    {/* Tirador esquina inferior-derecha */}
    <div
      onPointerDown={(e) => {
        e.preventDefault();
        const rect = canvasWrapRef.current.getBoundingClientRect();
        resizingRef.current = {
          startX: e.clientX,
          startY: e.clientY,
          startW: rect.width,
          startH: rect.height,
        };

        e.currentTarget.setPointerCapture?.(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!resizingRef.current) return;
        const { startX, startY, startW, startH } = resizingRef.current;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        const minW = 360, minH = 240;
        const maxW = 1600, maxH = 1000;

        const newW = Math.max(minW, Math.min(maxW, Math.round(startW + dx)));
        const newH = Math.max(minH, Math.min(maxH, Math.round(startH + dy)));

        setCanvasSize({ w: newW, h: newH });
      }}
      onPointerUp={(e) => {
        resizingRef.current = null;
        e.currentTarget.releasePointerCapture?.(e.pointerId);
      }}
      className="absolute bottom-1.5 right-1.5 h-4 w-4 cursor-nwse-resize rounded-md"
      style={{
        background:
          "linear-gradient(135deg, transparent 0 40%, rgba(255,255,255,.25) 40% 60%, transparent 60% 100%)",
      }}
      title="Arrastra para redimensionar"
    />
  </div>
</div>


        {/* Lista desplazable de bolas */}
        <aside className="lg:col-span-1">
          <div className="rounded-3xl bg-slate-800 ring-1 ring-slate-700 overflow-hidden">
            <div className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur px-4 py-2 text-xs text-slate-400">
              Bolas e instrumentos
            </div>
            <div className="space-y-2 overflow-y-auto pr-2 p-3" style={{ maxHeight: `${canvasSize.h}px` }} role="list" aria-label="Bolas e instrumentos">
              {balls.map((b) => {
                const noteLocked = Boolean(
                  allowedNotes?.length &&
                  b.isNote &&
                  !allowedNotes.includes(b.note)
                );
                return (
                  <div key={b.id} className="flex items-center gap-3 bg-slate-900/40 rounded-xl p-2" style={{ opacity: noteLocked ? 0.5 : 1 }}>
                    <span className="inline-block h-3 w-3 rounded-full" style={{ background: b.color }} />
                    <input
                      type="text"
                      value={b.name}
                      onChange={(e) => updateBallName(b.id, e.target.value)}
                      className="bg-slate-700 rounded px-2 py-1 text-sm text-slate-100 flex-1 min-w-0"
                      placeholder={`Bola ${b.id}`}
                    />
                    <select
                      value={b.type}
                      onChange={(e) => updateBallType(b.id, e.target.value)}
                      className="bg-slate-700 rounded-xl px-2 py-1 text-sm"
                    >
                      <option value="note">Nota</option>
                      <option value="tempo">Tempo</option>
                    </select>
                    {b.type === "note" ? (
                      <select
                        value={b.note}
                        onChange={(e) => updateBallNote(b.id, e.target.value)}
                        className="bg-slate-700 rounded-xl px-2 py-1 text-sm"
                      >
                        {(melodyVoice === "drums" ? DRUM_NOTE_OPTIONS : NOTE_NAMES_88).map((n) =>
                          melodyVoice === "drums" ? (
                            <option key={n.value} value={n.value}>{n.label}</option>
                          ) : (
                            <option key={n} value={n}>{n}</option>
                          )
                        )}
                      </select>
                    ) : (
                      <div className="flex items-center gap-2">
                        <select
                          value={b.tempoQuant}
                          onChange={(e) => updateBallTempoQuant(b.id, parseFloat(e.target.value))}
                          className="bg-slate-700 rounded-xl px-2 py-1 text-sm"
                          title="Subdivisión de cuantización para este tempo-ball"
                        >
                          {TEMPO_QUANT_OPTIONS.map((q) => (
                            <option key={q.value} value={q.value}>{q.label}</option>
                          ))}
                        </select>
                        <label className="flex items-center gap-2 text-xs text-slate-300">
                          Vel
                          <input
                            type="range" min={0.3} max={1.5} step={0.05}
                            value={b.velocity ?? 1}
                            onChange={(e) => updateBallVelocity(b.id, parseFloat(e.target.value))}
                          />
                          <span className="w-8 text-right">{(b.velocity ?? 1).toFixed(2)}</span>
                        </label>
                      </div>
                    )}
                    <button
                      onClick={() => removeBallById(b.id)}
                      className="ml-auto h-8 w-8 rounded-full bg-slate-700 text-slate-200 hover:bg-rose-600 hover:text-white transition"
                      type="button"
                      title={balls.length <= 1 ? "Debe quedar al menos 1 bola" : "Eliminar bola"}
                      disabled={balls.length <= 1}
                      aria-label={`Eliminar ${b.name}`}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
              <button
                onClick={addNoteBall}
                className="w-full rounded-2xl border border-dashed border-slate-600 text-slate-300 py-2 hover:border-emerald-400 hover:text-emerald-200 transition"
                type="button"
                aria-label="Añadir bola de nota"
              >
                +
              </button>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

export default function Rapsody() {
  const defaultInstrument = MELODY_VOICES[0].value;
  const [canvasInstances, setCanvasInstances] = useState([
    { id: Date.now(), preset: null, durationSec: 8, instrument: defaultInstrument, sectionIndex: 0 },
  ]);
  const [songFile, setSongFile] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const [currentSection, setCurrentSection] = useState(0);
  const autoTimerRef = useRef(null);
  const [theme, setTheme] = useState("midnight");
  const [performanceMode, setPerformanceMode] = useState(false);
  const [backgroundPad, setBackgroundPad] = useState(true);
  const [backgroundRhythm, setBackgroundRhythm] = useState(true);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingStartRef = useRef(null);
  const importProjectInputRef = useRef(null);
  const [playAll, setPlayAll] = useState(false);

  const addCanvas = () =>
    setCanvasInstances((prev) => [
      ...prev,
      { id: Date.now() + Math.random(), preset: null, durationSec: 8, instrument: defaultInstrument, sectionIndex: prev[prev.length - 1]?.sectionIndex ?? 0 },
    ]);

  const removeCanvas = (id) =>
    setCanvasInstances((prev) => {
      const next = prev.length > 1 ? prev.filter((c) => c.id !== id) : prev;
      const maxSection = next.reduce((max, inst) => Math.max(max, inst.sectionIndex ?? 0), 0);
      if (currentSection > maxSection) setCurrentSection(maxSection);
      return next;
    });

  const updateDuration = (id, value) => {
    setCanvasInstances((prev) =>
      prev.map((inst) => (inst.id === id ? { ...inst, durationSec: Math.max(3, value || 3) } : inst))
    );
  };

  const stopAutoPlay = () => {
    setAutoPlay(false);
    setCurrentSection(0);
    if (autoTimerRef.current) {
      clearTimeout(autoTimerRef.current);
      autoTimerRef.current = null;
    }
  };

  const startAutoPlay = () => {
    if (!canvasInstances.length) return;
    setCurrentSection(0);
    setAutoPlay(true);
  };

  const handleExportProject = () => {
    const payload = {
      version: 1,
      theme,
      performanceMode,
      canvasInstances,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rapsody_project_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleImportProject = async (file) => {
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (Array.isArray(data?.canvasInstances)) {
        const imported = data.canvasInstances.map((inst) => ({
          ...inst,
          instrument: inst.instrument || defaultInstrument,
          sectionIndex: inst.sectionIndex ?? 0,
        }));
        setCanvasInstances(imported.length ? imported : [{ id: Date.now(), preset: null, durationSec: 8, instrument: defaultInstrument, sectionIndex: 0 }]);
      }
      if (typeof data?.theme === "string") setTheme(data.theme);
      if (typeof data?.performanceMode === "boolean") setPerformanceMode(data.performanceMode);
    } catch (err) {
      alert("Archivo de proyecto inválido.");
      console.error(err);
    }
  };

  const updateInstrument = (id, instrument) => {
    setCanvasInstances((prev) =>
      prev.map((inst) => (inst.id === id ? { ...inst, instrument } : inst))
    );
  };

  const ensureGlobalRecorder = useCallback(() => {
    const audio = getSharedAudio();
    if (audio.ctx.state !== "running") audio.ctx.resume();
    if (!mediaRecorderRef.current) {
      try {
        const stream = audio.mediaDest.stream;
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
          setIsRecording(false);
        };
        mediaRecorderRef.current = mr;
      } catch (err) {
        console.warn("MediaRecorder no disponible:", err);
        return null;
      }
    }
    return mediaRecorderRef.current;
  }, []);

  const toggleGlobalRecording = useCallback(() => {
    const mr = ensureGlobalRecorder();
    if (!mr) return;
    if (isRecording) {
      mr.stop();
      setIsRecording(false);
    } else {
      recordedChunksRef.current = [];
      mr.start();
      recordingStartRef.current = Date.now();
      setRecordingSeconds(0);
      setIsRecording(true);
    }
  }, [ensureGlobalRecorder, isRecording]);

  useEffect(() => {
    if (!isRecording) {
      recordingStartRef.current = null;
      return;
    }
    const id = setInterval(() => {
      if (!recordingStartRef.current) return;
      const elapsed = (Date.now() - recordingStartRef.current) / 1000;
      setRecordingSeconds(Math.floor(elapsed));
    }, 250);
    return () => clearInterval(id);
  }, [isRecording]);

  const recordingLabel = useMemo(() => {
    const mins = Math.floor(recordingSeconds / 60);
    const secs = recordingSeconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }, [recordingSeconds]);

  useEffect(() => {
    if (!autoPlay) return;
    const sections = new Set(canvasInstances.map((c) => c.sectionIndex ?? 0));
    const totalSections = sections.size || 1;
    const currentGroup = canvasInstances.filter(
      (inst) => (inst.sectionIndex ?? 0) === currentSection
    );
    if (!currentGroup.length) {
      stopAutoPlay();
      return;
    }
    const durationMs =
      Math.max(...currentGroup.map((c) => Math.max(3, c.durationSec || 8))) * 1000;
    if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    autoTimerRef.current = setTimeout(() => {
      setCurrentSection((prev) => {
        const next = prev + 1;
        if (next >= totalSections) {
          stopAutoPlay();
          return prev;
        }
        return next;
      });
    }, durationMs);
    return () => {
      if (autoTimerRef.current) {
        clearTimeout(autoTimerRef.current);
        autoTimerRef.current = null;
      }
    };
  }, [autoPlay, currentSection, canvasInstances]);


  const handleAnalyzeSong = async () => {
    if (!songFile) {
      alert("Selecciona un archivo para analizar.");
      return;
    }
    setIsAnalyzing(true);
    try {
      const isMidi = /\.mid(i)?$/i.test(songFile.name);
      const basePreset = isMidi
        ? await extractPresetFromMidiFile(songFile)
        : await extractPresetFromAudioFile(songFile);
      if (!basePreset?.notes?.length) {
        alert("No pude extraer notas del archivo.");
        return;
      }
      const noteEvents =
        basePreset.noteEvents && basePreset.noteEvents.length
          ? basePreset.noteEvents
          : (basePreset.notes || []).map((name, idx) => ({
              name,
              start: idx * 0.5,
              duration: 0.5,
              velocity: 0.9,
            }));
      const sectionsEvents = splitNotesByMusicalAnalysis(noteEvents, {
        maxSections: 6,
        minPerSection: 6,
      });
      const fallbackSections = splitNotesIntoSections(basePreset.notes, {
        maxSections: 5,
        minPerSection: 6,
      });
      const summarySource = sectionsEvents.length
        ? sectionsEvents
        : fallbackSections.map((notes) =>
            notes.map((name, idx) => ({
              name,
              start: idx * 0.5,
              duration: 0.45,
              velocity: 0.85,
            }))
          );
      const sectionSummaries = summarySource.map((sec) => summarizeSectionEvents(sec));
      const sections = sectionsEvents.length
        ? sectionsEvents.map((sec) => sec.map((n) => n.name))
        : fallbackSections;
      const tempos = (basePreset.tempos && basePreset.tempos.length) ? basePreset.tempos : DEFAULT_TEMPOS;
      const paletteObj = getThemePalette(theme);
      const newInstances = [];
      sections.forEach((sectionNotes, idx) => {
        const tempoVariant = tempos.map((t, k) => ({
          ...t,
          angleDeg: (t.angleDeg ?? 0) + idx * 8 * (k % 2 === 0 ? 1 : -1),
        }));
        const doubledTempos = tempoVariant.flatMap((t, k) => ([
          { ...t, speed: (t.speed || 420) * 1.05 },
          { ...t, angleDeg: (t.angleDeg ?? 0) + 12 * (k % 2 === 0 ? 1 : -1), speed: (t.speed || 420) * 0.95 },
        ]));
        const sectionLabelBase = `${songFile.name} · Sección ${idx + 1}`;
        const sectionEventsRaw = sectionsEvents[idx] || [];
        const sectionProfile = getSectionProfileByIndex(idx);
        const sectionSummary =
          sectionSummaries[idx] ||
          summarizeSectionEvents(sectionsEvents[idx] || sectionEventsRaw || []);
        const baseTimeline = buildTimelineFromEvents(sectionEventsRaw, sectionNotes, basePreset.bpm);
        const backgroundLayer = buildSectionBackgroundLayer(baseTimeline, sectionProfile, sectionSummary);
        const percussionSettings = derivePercussionSettings(sectionProfile, sectionSummary);
        INSTRUMENT_PROFILES.forEach((profile, profIdx) => {
          const filteredTimeline = baseTimeline.filter((ev) =>
            (profile.filter?.(ev.note, midiFromNoteName(ev.note)) ?? true)
          );
          const effectiveTimeline = filteredTimeline.length ? filteredTimeline : baseTimeline;
          const notesForInstrument = effectiveTimeline.map((ev) => ev.note);
          if (!notesForInstrument.length) return;
          const { balls } = buildSequencePreset({
            notes: notesForInstrument,
            tempos: doubledTempos,
            bpm: basePreset.bpm,
            areaW: 900,
            areaH: 420,
          });
          const boosted = boostBallVelocities(balls, 2.0);
          const kicked = kickstartBallMotion(boosted, 140);
          const themedBalls = applyThemeToBalls(kicked, paletteObj);
          const durationEstimate =
            effectiveTimeline.reduce((acc, ev) => Math.max(acc, (ev.start ?? 0) + (ev.duration ?? 0.4)), 0) ||
            Math.max(6, notesForInstrument.length * 0.5);
          const paddedDuration = Math.max(10, Math.round(durationEstimate * 2));
          const transitions = buildTransitionMap(effectiveTimeline);
          newInstances.push({
            id: Date.now() + idx + profIdx + Math.random(),
            preset: {
              balls: themedBalls,
              bpm: basePreset.bpm,
              label: `${sectionLabelBase} · ${profile.label}`,
              version: `${songFile.name}-${Date.now()}-${idx}-${profile.voice}`,
              noteOrder: notesForInstrument,
              timeline: effectiveTimeline,
              transitions,
               sectionKind: sectionProfile.key,
               sectionProfile,
               sectionSummary,
               backgroundMelody: backgroundLayer,
               percussion: percussionSettings,
            },
            durationSec: paddedDuration,
            instrument: profile.voice,
            sectionIndex: idx,
          });
        });
      });
      setCanvasInstances(
        newInstances.length
          ? newInstances
          : [{ id: Date.now(), preset: null, durationSec: 16, instrument: defaultInstrument, sectionIndex: 0 }]
      );
      setCurrentSection(0);
    } catch (err) {
      console.error("Error al analizar archivo:", err);
      alert(err?.message ?? "No pude analizar el archivo.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 space-y-6">
      <section className="rounded-3xl bg-slate-900/80 ring-1 ring-slate-800 p-4 flex flex-wrap gap-3 items-center">
        <label className="flex flex-col text-sm text-slate-300">
          Archivo
          <input
            type="file"
            accept=".wav,.mp3,.ogg,.m4a,.flac,.mid,.midi"
            onChange={(e) => setSongFile(e.target.files?.[0] || null)}
            className="bg-slate-800 rounded-xl px-3 py-2 mt-1"
          />
        </label>
        <button
          onClick={handleAnalyzeSong}
          disabled={!songFile || isAnalyzing}
          className={`px-4 py-2 rounded-2xl ${isAnalyzing ? "bg-emerald-900 text-slate-400" : "bg-emerald-500 hover:bg-emerald-600"}`}
        >
          {isAnalyzing ? "Analizando…" : "Analizar archivo"}
        </button>
        <label className="flex flex-col text-sm text-slate-300">
          Tema
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="bg-slate-800 rounded-xl px-3 py-2 mt-1"
          >
            {Object.entries(THEME_OPTIONS).map(([key, value]) => (
              <option key={key} value={key}>{value.label}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={backgroundPad}
            onChange={(e) => setBackgroundPad(e.target.checked)}
            className="accent-emerald-500"
          />
          Melodía de fondo
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={backgroundRhythm}
            onChange={(e) => setBackgroundRhythm(e.target.checked)}
            className="accent-indigo-500"
          />
          Ritmo de fondo
        </label>
        <button
          onClick={handleExportProject}
          className="px-4 py-2 rounded-2xl bg-amber-500 hover:bg-amber-600"
        >
          Exportar proyecto
        </button>
        <button
          onClick={() => importProjectInputRef.current?.click()}
          className="px-4 py-2 rounded-2xl bg-slate-700 hover:bg-slate-600"
        >
          Importar proyecto
        </button>
        <button
          onClick={toggleGlobalRecording}
          className={`px-4 py-2 rounded-2xl ${
            isRecording ? "bg-yellow-500 text-slate-900" : "bg-indigo-500 hover:bg-indigo-600"
          }`}
          title="Graba la mezcla general y descarga .webm"
        >
          {isRecording ? "Grabando…" : "Grabar"}
        </button>
        <input
          ref={importProjectInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImportProject(file);
            e.target.value = "";
          }}
        />
        <button
          onClick={autoPlay ? stopAutoPlay : startAutoPlay}
          disabled={!canvasInstances.length}
          className={`px-4 py-2 rounded-2xl ${
            autoPlay ? "bg-rose-600 hover:bg-rose-700" : "bg-cyan-500 hover:bg-cyan-600"
          }`}
        >
          {autoPlay ? "Detener secuencia" : "Reproducir secuencial"}
        </button>
        <button
          onClick={() => setPlayAll((v) => !v)}
          disabled={!canvasInstances.length}
          className={`px-4 py-2 rounded-2xl ${
            playAll ? "bg-rose-500 hover:bg-rose-600" : "bg-emerald-500 hover:bg-emerald-600"
          }`}
        >
          {playAll ? "Detener todos" : "Reproducir todos"}
        </button>
      </section>
      <div className="space-y-6">
        {canvasInstances.map((inst, idx) => {
          const section = inst.sectionIndex ?? 0;
          const shouldPlaySection = autoPlay && section === currentSection;
          const shouldForcePlay = playAll || shouldPlaySection;
          return (
          <CanvasRig
            key={inst.id}
            instanceIndex={idx}
            canRemove={canvasInstances.length > 1}
            onRemove={() => removeCanvas(inst.id)}
            preset={inst.preset}
            durationSec={inst.durationSec}
            onDurationChange={(val) => updateDuration(inst.id, val)}
            shouldAutoRun={shouldPlaySection && !playAll}
            autoPlayEnabled={autoPlay}
            themeKey={theme}
            performanceMode={performanceMode}
            melodyVoice={inst.instrument || defaultInstrument}
            onInstrumentChange={(val) => updateInstrument(inst.id, val)}
            forcePlay={shouldForcePlay}
            backgroundPad={backgroundPad}
            backgroundRhythm={backgroundRhythm}
          />
        );})}
        <button
          onClick={addCanvas}
          className="w-full rounded-2xl border border-dashed border-slate-700 text-slate-300 py-3 hover:border-emerald-400 hover:text-emerald-200 transition"
          type="button"
        >
          + Añadir canvas
        </button>
      </div>
      {isRecording && (
        <div className="fixed bottom-4 left-4 z-50 rounded-2xl bg-slate-900/90 text-slate-100 px-4 py-3 shadow-lg ring-1 ring-slate-700 flex items-center gap-3">
          <span className="h-3 w-3 rounded-full bg-rose-500 animate-pulse" aria-hidden="true" />
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-widest text-slate-400">Grabando</span>
            <div className="text-lg font-semibold tabular-nums">{recordingLabel}</div>
          </div>
          <button
            onClick={toggleGlobalRecording}
            className="ml-2 rounded-xl bg-rose-600 px-3 py-1 text-sm font-medium hover:bg-rose-500"
            type="button"
          >
            Detener grabación
          </button>
        </div>
      )}
    </div>
  );
}
