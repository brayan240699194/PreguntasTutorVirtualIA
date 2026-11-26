"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  AREAS,
  type AnaliticaArea,
  type AnaliticaPorArea,
  type Calificacion,
  type DatosEstudiante,
  type Letra,
  type ModoSesion,
  type Pregunta,
  type PreguntaFallada,
  type QuizConfig,
  type RespuestaUsuario,
  type ResultadoSesion,
} from "@/types/quiz";

const MAX_HISTORIAL = 50;

function analiticaVacia(): AnaliticaPorArea {
  return AREAS.reduce((acc, area) => {
    acc[area] = { sesiones: 0, preguntasRespondidas: 0, aciertos: 0, ultimaSesion: null };
    return acc;
  }, {} as AnaliticaPorArea);
}

function generarId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

interface SesionState {
  sesionId: string | null;
  config: QuizConfig | null;
  modo: ModoSesion;
  preguntas: Pregunta[];
  respuestas: Record<string, RespuestaUsuario>;
  calificaciones: Record<string, Calificacion>;
  indiceActual: number;
  inicioEn: number | null;
  finalizadoEn: number | null;
  rachaActual: number;
  mejorRachaSesion: number;
  ultimoResultado: ResultadoSesion | null;
}

interface PersistenteState {
  historial: ResultadoSesion[];
  analitica: AnaliticaPorArea;
  mejorRachaGlobal: number;
  sonidoActivado: boolean;
  tutorExpandido: boolean;
  datosEstudiante: DatosEstudiante;
}

interface Acciones {
  iniciarSesion: (config: QuizConfig, preguntas: Pregunta[], modo?: ModoSesion) => void;
  responder: (preguntaId: string, letra: Letra) => RespuestaUsuario | null;
  irA: (indice: number) => void;
  siguiente: () => void;
  anterior: () => void;
  calificar: (preguntaId: string, valor: Calificacion) => void;
  finalizar: () => ResultadoSesion | null;
  practicarFalladas: () => boolean;
  salirSesion: () => void;
  toggleSonido: () => void;
  setSonido: (activo: boolean) => void;
  toggleTutorExpandido: () => void;
  borrarHistorial: () => void;
  setDatosEstudiante: (datos: Partial<DatosEstudiante>) => void;
}

export type QuizStore = SesionState & PersistenteState & Acciones;

const sesionInicial: SesionState = {
  sesionId: null,
  config: null,
  modo: "normal",
  preguntas: [],
  respuestas: {},
  calificaciones: {},
  indiceActual: 0,
  inicioEn: null,
  finalizadoEn: null,
  rachaActual: 0,
  mejorRachaSesion: 0,
  ultimoResultado: null,
};

export const useQuizStore = create<QuizStore>()(
  persist(
    (set, get) => ({
      ...sesionInicial,
      historial: [],
      analitica: analiticaVacia(),
      mejorRachaGlobal: 0,
      sonidoActivado: true,
      tutorExpandido: false,
      datosEstudiante: { nombre: "", institucion: "", curso: "", docente: "" },

      iniciarSesion: (config, preguntas, modo = "normal") => {
        set({
          ...sesionInicial,
          sesionId: generarId(),
          config,
          modo,
          preguntas,
          inicioEn: Date.now(),
        });
      },

      responder: (preguntaId, letra) => {
        const { preguntas, respuestas, finalizadoEn, rachaActual, mejorRachaSesion, mejorRachaGlobal } = get();
        if (finalizadoEn !== null || respuestas[preguntaId]) return null;
        const pregunta = preguntas.find((p) => p.id === preguntaId);
        if (!pregunta) return null;

        const esCorrecta = pregunta.letraCorrecta === letra;
        const respuesta: RespuestaUsuario = {
          preguntaId,
          letraElegida: letra,
          esCorrecta,
          respondidaEn: Date.now(),
        };
        const nuevaRacha = esCorrecta ? rachaActual + 1 : 0;
        set({
          respuestas: { ...respuestas, [preguntaId]: respuesta },
          rachaActual: nuevaRacha,
          mejorRachaSesion: Math.max(mejorRachaSesion, nuevaRacha),
          mejorRachaGlobal: Math.max(mejorRachaGlobal, nuevaRacha),
        });
        return respuesta;
      },

      irA: (indice) => {
        const { preguntas } = get();
        if (indice < 0 || indice >= preguntas.length) return;
        set({ indiceActual: indice });
      },

      siguiente: () => {
        const { indiceActual, preguntas } = get();
        if (indiceActual < preguntas.length - 1) set({ indiceActual: indiceActual + 1 });
      },

      anterior: () => {
        const { indiceActual } = get();
        if (indiceActual > 0) set({ indiceActual: indiceActual - 1 });
      },

      calificar: (preguntaId, valor) => {
        const { calificaciones } = get();
        const siguientes = { ...calificaciones };
        if (siguientes[preguntaId] === valor) delete siguientes[preguntaId];
        else siguientes[preguntaId] = valor;
        set({ calificaciones: siguientes });
      },

      finalizar: () => {
        const state = get();
        if (!state.config || state.preguntas.length === 0) return null;
        if (state.finalizadoEn !== null) return state.ultimoResultado;

        const ahora = Date.now();
        const total = state.preguntas.length;
        let aciertos = 0;
        const falladas: PreguntaFallada[] = [];

        for (const p of state.preguntas) {
          const r = state.respuestas[p.id];
          if (r?.esCorrecta) {
            aciertos++;
            continue;
          }
          const textoDe = (letra: Letra | undefined) =>
            letra ? (p.opciones.find((o) => o.letra === letra)?.texto ?? "") : "Sin responder";
          falladas.push({
            enunciado: p.enunciado,
            respuestaElegida: textoDe(r?.letraElegida),
            respuestaCorrecta: textoDe(p.letraCorrecta),
          });
        }

        const resultado: ResultadoSesion = {
          id: state.sesionId ?? generarId(),
          config: state.config,
          modo: state.modo,
          total,
          aciertos,
          porcentaje: Math.round((aciertos / total) * 100),
          duracionMs: Math.max(0, ahora - (state.inicioEn ?? ahora)),
          fecha: new Date(ahora).toISOString(),
          mejorRachaSesion: state.mejorRachaSesion,
          falladas,
        };

        const areaPrev: AnaliticaArea = state.analitica[state.config.area];
        const respondidas = Object.keys(state.respuestas).length;

        set({
          finalizadoEn: ahora,
          ultimoResultado: resultado,
          historial: [resultado, ...state.historial].slice(0, MAX_HISTORIAL),
          // El repaso repite preguntas ya vistas con su solución: no suma al dominio del área.
          analitica:
            state.modo === "repaso"
              ? state.analitica
              : {
                  ...state.analitica,
                  [state.config.area]: {
                    sesiones: areaPrev.sesiones + 1,
                    preguntasRespondidas: areaPrev.preguntasRespondidas + respondidas,
                    aciertos: areaPrev.aciertos + aciertos,
                    ultimaSesion: resultado.fecha,
                  },
                },
        });
        return resultado;
      },

      practicarFalladas: () => {
        const { preguntas, respuestas, config } = get();
        if (!config) return false;
        const falladas = preguntas.filter((p) => !respuestas[p.id]?.esCorrecta);
        if (falladas.length === 0) return false;
        // Nuevos ids para que la sesión de repaso tenga respuestas limpias.
        const copia = falladas.map((p) => ({ ...p, id: generarId() }));
        get().iniciarSesion(config, copia, "repaso");
        return true;
      },

      salirSesion: () => set({ ...sesionInicial }),

      toggleSonido: () => set((s) => ({ sonidoActivado: !s.sonidoActivado })),
      setSonido: (activo) => set({ sonidoActivado: activo }),
      toggleTutorExpandido: () => set((s) => ({ tutorExpandido: !s.tutorExpandido })),
      borrarHistorial: () => set({ historial: [], analitica: analiticaVacia(), mejorRachaGlobal: 0 }),
      setDatosEstudiante: (datos) => set((s) => ({ datosEstudiante: { ...s.datosEstudiante, ...datos } })),
    }),
    {
      name: "tutor-ia-quiz-store",
      version: 2,
      storage: createJSONStorage(() => localStorage),
      // v2: niveles MINEDUC (inicial/egb/bgu) + grado y nuevas asignaturas.
      // Las sesiones e historial de v1 usan otra estructura, así que solo se
      // conservan las preferencias y los datos del estudiante.
      migrate: (persisted, version) => {
        const p = (persisted ?? {}) as Partial<QuizStore>;
        if (version < 2) {
          return {
            sonidoActivado: p.sonidoActivado ?? true,
            tutorExpandido: p.tutorExpandido ?? false,
            ...(p.datosEstudiante ? { datosEstudiante: p.datosEstudiante } : {}),
          } as Partial<QuizStore>;
        }
        return p;
      },
      partialize: (s) => ({
        sesionId: s.sesionId,
        config: s.config,
        modo: s.modo,
        preguntas: s.preguntas,
        respuestas: s.respuestas,
        calificaciones: s.calificaciones,
        indiceActual: s.indiceActual,
        inicioEn: s.inicioEn,
        finalizadoEn: s.finalizadoEn,
        rachaActual: s.rachaActual,
        mejorRachaSesion: s.mejorRachaSesion,
        ultimoResultado: s.ultimoResultado,
        historial: s.historial,
        analitica: s.analitica,
        mejorRachaGlobal: s.mejorRachaGlobal,
        sonidoActivado: s.sonidoActivado,
        tutorExpandido: s.tutorExpandido,
        datosEstudiante: s.datosEstudiante,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<QuizStore>;
        return {
          ...current,
          ...p,
          analitica: { ...analiticaVacia(), ...(p.analitica ?? {}) },
          datosEstudiante: { ...current.datosEstudiante, ...(p.datosEstudiante ?? {}) },
        };
      },
    },
  ),
);

/** Devuelve true cuando el estado persistido ya se cargó desde localStorage. */
export function useStoreHydrated(): boolean {
  const [hidratado, setHidratado] = useState(false);
  useEffect(() => {
    const unsub = useQuizStore.persist.onFinishHydration(() => setHidratado(true));
    setHidratado(useQuizStore.persist.hasHydrated());
    return unsub;
  }, []);
  return hidratado;
}
