"use client";

import { create } from "zustand";
import type { EstadoIAResponse } from "@/types/quiz";

/**
 * Estado de la conexión con la IA, compartido por todos los avatares del tutor:
 * "conectada" → credencial verde, "sin-ia" → credencial naranja (la IA no responde).
 */
export type EstadoIA = "verificando" | "conectada" | "sin-ia";

interface EstadoIAStore {
  estado: EstadoIA;
  setEstado: (estado: EstadoIA) => void;
}

export const useEstadoIA = create<EstadoIAStore>()((set) => ({
  estado: "verificando",
  setEstado: (estado) => set({ estado }),
}));

/** Actualiza el indicador con el resultado real de una solicitud a la IA. */
export function marcarIA(conectada: boolean): void {
  useEstadoIA.getState().setEstado(conectada ? "conectada" : "sin-ia");
}

const INTERVALO_MS = 60_000;
let suscriptores = 0;
let temporizador: number | null = null;
let enCurso = false;

async function verificar(): Promise<void> {
  if (enCurso) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    useEstadoIA.getState().setEstado("sin-ia");
    return;
  }
  enCurso = true;
  try {
    const res = await fetch("/api/ia/estado", { cache: "no-store", signal: AbortSignal.timeout(12_000) });
    const data = (await res.json()) as Partial<EstadoIAResponse>;
    useEstadoIA.getState().setEstado(res.ok && data.disponible === true ? "conectada" : "sin-ia");
  } catch {
    useEstadoIA.getState().setEstado("sin-ia");
  } finally {
    enCurso = false;
  }
}

function alCambiarVisibilidad() {
  if (document.visibilityState === "visible") void verificar();
}

/**
 * Inicia la verificación periódica (una sola para toda la app, aunque haya
 * varios avatares montados). Devuelve la función para detenerla.
 */
export function iniciarMonitorIA(): () => void {
  suscriptores++;
  if (suscriptores === 1) {
    void verificar();
    temporizador = window.setInterval(() => void verificar(), INTERVALO_MS);
    window.addEventListener("online", verificar);
    window.addEventListener("offline", verificar);
    document.addEventListener("visibilitychange", alCambiarVisibilidad);
  }
  return () => {
    suscriptores--;
    if (suscriptores === 0) {
      if (temporizador !== null) window.clearInterval(temporizador);
      temporizador = null;
      window.removeEventListener("online", verificar);
      window.removeEventListener("offline", verificar);
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
    }
  };
}
