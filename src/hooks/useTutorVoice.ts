"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SubtitleWord, TutorVoiceControls } from "@/types/quiz";

/* ============================================================================
 * Utilidades
 * ========================================================================== */

/** Convierte texto con LaTeX ligero ($...$) en una versión legible en voz alta. */
export function textoParaVoz(texto: string): string {
  const leerMath = (m: string): string =>
    m
      .replace(/\\\\(?=[a-zA-Z])/g, "\\")
      .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, "$1 sobre $2")
      .replace(/\\sqrt\{([^{}]*)\}/g, "raíz de $1")
      .replace(/\\(?:text|mathrm|mathbf|operatorname)\{([^{}]*)\}/g, "$1")
      .replace(/\^\{?2\}?/g, " al cuadrado")
      .replace(/\^\{?3\}?/g, " al cubo")
      .replace(/\^\{([^{}]*)\}/g, " elevado a $1")
      .replace(/\^(\S)/g, " elevado a $1")
      .replace(/_\{([^{}]*)\}/g, "$1")
      .replace(/_(\S)/g, "$1")
      .replace(/\\(?:cdot|times)/g, " por ")
      .replace(/\\div/g, " entre ")
      .replace(/\\pm/g, " más o menos ")
      .replace(/\\(?:leq|le)\b/g, " menor o igual que ")
      .replace(/\\(?:geq|ge)\b/g, " mayor o igual que ")
      .replace(/\\neq/g, " distinto de ")
      .replace(/\\approx/g, " aproximadamente ")
      .replace(/\\(?:rightarrow|to)\b/g, " produce ")
      .replace(/\\infty/g, " infinito ")
      .replace(/\\pi/g, " pi ")
      .replace(/\\Delta/g, " delta ")
      .replace(/\\(?:alpha|beta|gamma|theta|lambda|mu|sigma|omega)/g, (g) => ` ${g.slice(1)} `)
      .replace(/\\[a-zA-Z]+/g, " ")
      .replace(/[{}]/g, "")
      .replace(/=/g, " igual a ")
      .replace(/\s*-\s*/g, " menos ")
      .replace(/\s*\+\s*/g, " más ");

  return texto
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, m: string) => leerMath(m))
    .replace(/\$([^$]+?)\$/g, (_, m: string) => leerMath(m))
    .replace(/[*_#`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizar(texto: string): SubtitleWord[] {
  const palabras: SubtitleWord[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto)) !== null) {
    palabras.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  }
  return palabras;
}

/** Puntúa las voces disponibles para elegir la más natural en español. */
function puntuarVoz(v: SpeechSynthesisVoice): number {
  const lang = v.lang.toLowerCase().replace("_", "-");
  if (!lang.startsWith("es")) return -1;
  const nombre = v.name.toLowerCase();
  let score = 10;
  if (lang === "es-mx" || lang === "es-us" || lang === "es-419") score += 25;
  else if (lang === "es-es") score += 20;
  else if (lang.startsWith("es-")) score += 15;
  if (/natural|neural|online|premium|enhanced/.test(nombre)) score += 40;
  if (nombre.includes("google")) score += 30;
  if (nombre.includes("microsoft")) score += 12;
  if (/(paulina|dalia|jorge|elvira|alvaro|álvaro|helena|sabina|mónica|monica|elena|lucía|lucia|andrea)/.test(nombre))
    score += 6;
  if (/(compact|eloquence|espeak)/.test(nombre)) score -= 20;
  if (v.default) score += 2;
  return score;
}

function elegirMejorVoz(voces: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  let mejor: SpeechSynthesisVoice | null = null;
  let mejorScore = -1;
  for (const v of voces) {
    const s = puntuarVoz(v);
    if (s > mejorScore) {
      mejor = v;
      mejorScore = s;
    }
  }
  return mejorScore >= 0 ? mejor : null;
}

/** Duración estimada (ms) para pronunciar una palabra a la velocidad dada. */
function duracionPalabra(palabra: string, rate: number): number {
  const base = 150 + palabra.replace(/[^\p{L}\p{N}]/gu, "").length * 58;
  const pausa = /[.,;:!?…]$/.test(palabra) ? 220 : 0;
  return (base + pausa) / rate;
}

/* ============================================================================
 * Hook
 * ========================================================================== */

interface Opciones {
  enabled: boolean;
  rate?: number;
  pitch?: number;
  /** Tiempo que el subtítulo permanece visible tras terminar la locución. */
  holdMs?: number;
}

export function useTutorVoice({ enabled, rate = 1.02, pitch = 1.05, holdMs = 2600 }: Opciones): TutorVoiceControls {
  const [isSupported, setIsSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [words, setWords] = useState<SubtitleWord[]>([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [subtitleVisible, setSubtitleVisible] = useState(false);
  const [voiceName, setVoiceName] = useState<string | null>(null);

  const vozRef = useRef<SpeechSynthesisVoice | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const turnoRef = useRef(0);
  const boundaryVistoRef = useRef(false);
  const timersRef = useRef<number[]>([]);
  const enabledRef = useRef(enabled);

  enabledRef.current = enabled;

  const limpiarTimers = useCallback(() => {
    for (const t of timersRef.current) window.clearTimeout(t);
    timersRef.current = [];
  }, []);

  const programar = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
  }, []);

  /* --------------------- Carga de voces (SSR-safe) ----------------------- */
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setIsSupported(false);
      return;
    }
    setIsSupported(true);
    const synth = window.speechSynthesis;

    const cargar = () => {
      const voz = elegirMejorVoz(synth.getVoices());
      vozRef.current = voz;
      setVoiceName(voz ? `${voz.name} (${voz.lang})` : null);
    };
    cargar();
    synth.addEventListener("voiceschanged", cargar);
    return () => {
      synth.removeEventListener("voiceschanged", cargar);
    };
  }, []);

  /* --------------------- Detener ------------------------------------------ */
  const stop = useCallback(() => {
    turnoRef.current += 1;
    limpiarTimers();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    utteranceRef.current = null;
    setIsSpeaking(false);
    setSubtitleVisible(false);
    setCurrentWordIndex(-1);
  }, [limpiarTimers]);

  /* --------------------- Hablar ------------------------------------------- */
  const speak = useCallback(
    (textoOriginal: string) => {
      const texto = textoParaVoz(textoOriginal);
      if (!texto) return;

      turnoRef.current += 1;
      const turno = turnoRef.current;
      limpiarTimers();

      const tokens = tokenizar(texto);
      setWords(tokens);
      setSubtitleVisible(true);

      const soportado = typeof window !== "undefined" && "speechSynthesis" in window;

      // Modo silencioso: solo subtítulos revelados progresivamente.
      if (!enabledRef.current || !soportado) {
        if (soportado) window.speechSynthesis.cancel();
        setIsSpeaking(false);
        setCurrentWordIndex(-1);
        let acumulado = 0;
        tokens.forEach((tok, i) => {
          acumulado += duracionPalabra(tok.text, rate) * 0.8;
          programar(() => {
            if (turnoRef.current === turno) setCurrentWordIndex(i);
          }, acumulado);
        });
        programar(() => {
          if (turnoRef.current === turno) setSubtitleVisible(false);
        }, acumulado + holdMs);
        return;
      }

      const synth = window.speechSynthesis;
      synth.cancel();
      setCurrentWordIndex(-1);
      setIsSpeaking(true);
      boundaryVistoRef.current = false;

      const finalizar = () => {
        if (turnoRef.current !== turno) return;
        limpiarTimers();
        utteranceRef.current = null;
        setIsSpeaking(false);
        setCurrentWordIndex(tokens.length - 1);
        programar(() => {
          if (turnoRef.current === turno) setSubtitleVisible(false);
        }, holdMs);
      };

      // Temporizador calibrado por palabra: respaldo cuando el motor no emite
      // eventos `boundary` (p. ej. voces remotas de Google en Chrome).
      const iniciarRespaldo = () => {
        let acumulado = 0;
        tokens.forEach((tok, i) => {
          programar(() => {
            if (turnoRef.current === turno && !boundaryVistoRef.current) {
              setCurrentWordIndex((prev) => Math.max(prev, i));
            }
          }, acumulado);
          acumulado += duracionPalabra(tok.text, rate);
        });
      };

      const lanzar = () => {
        if (turnoRef.current !== turno) return;
        const u = new SpeechSynthesisUtterance(texto);
        const voz = vozRef.current;
        if (voz) {
          u.voice = voz;
          u.lang = voz.lang;
        } else {
          u.lang = "es-MX";
        }
        u.rate = rate;
        u.pitch = pitch;
        u.volume = 1;

        u.onstart = () => {
          if (turnoRef.current !== turno) return;
          setIsSpeaking(true);
          iniciarRespaldo();
        };
        u.onboundary = (e: SpeechSynthesisEvent) => {
          if (turnoRef.current !== turno) return;
          if (e.name && e.name !== "word") return;
          boundaryVistoRef.current = true;
          let idx = -1;
          for (let i = 0; i < tokens.length; i++) {
            const tok = tokens[i];
            if (tok && tok.start <= e.charIndex) idx = i;
            else break;
          }
          if (idx >= 0) setCurrentWordIndex(idx);
        };
        u.onend = finalizar;
        u.onerror = (e: SpeechSynthesisErrorEvent) => {
          if (e.error === "interrupted" || e.error === "canceled") return;
          finalizar();
        };

        utteranceRef.current = u; // evita que el GC elimine la locución en Chrome
        synth.speak(u);

        // Algunos navegadores quedan en pausa tras cancel(); forzamos reanudación.
        if (synth.paused) synth.resume();
      };

      // Pequeña espera tras cancel() para que Chrome no descarte la nueva locución.
      programar(lanzar, 60);
    },
    [holdMs, limpiarTimers, pitch, programar, rate],
  );

  /* --------------------- Silenciar en caliente ---------------------------- */
  useEffect(() => {
    if (!enabled && typeof window !== "undefined" && "speechSynthesis" in window) {
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) stop();
    }
  }, [enabled, stop]);

  /* --------------------- Limpieza al desmontar ---------------------------- */
  useEffect(() => {
    return () => {
      turnoRef.current += 1;
      for (const t of timersRef.current) window.clearTimeout(t);
      timersRef.current = [];
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  return {
    isSupported,
    isSpeaking,
    status: isSpeaking ? "speaking" : "idle",
    words,
    currentWordIndex,
    subtitleVisible,
    voiceName,
    speak,
    stop,
  };
}
