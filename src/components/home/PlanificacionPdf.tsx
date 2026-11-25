"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CircleAlert, FileText, FileUp, ListChecks, LoaderCircle, RefreshCw, X } from "lucide-react";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { QuizApiError, analizarPlanificacionPdf } from "@/lib/api";
import { PDF_MAX_MB } from "@/lib/funciones";
import type { AnalizarPlanificacionResponse, AreaId, GradoId, NivelId } from "@/types/quiz";

const MAX_MB = PDF_MAX_MB;

const PASOS_ANALISIS = [
  "Subiendo el documento...",
  "Leyendo el texto del PDF...",
  "Identificando unidades y contenidos...",
  "Proponiendo temas evaluables...",
];

interface PlanificacionPdfProps {
  nivel: NivelId;
  grado: GradoId;
  area: AreaId;
  analisis: AnalizarPlanificacionResponse | null;
  onAnalisis: (a: AnalizarPlanificacionResponse | null) => void;
  temaSeleccionado: string;
  onSeleccionarTema: (tema: string) => void;
}

function formatearTamano(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function PlanificacionPdf({
  nivel,
  grado,
  area,
  analisis,
  onAnalisis,
  temaSeleccionado,
  onSeleccionarTema,
}: PlanificacionPdfProps) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [analizando, setAnalizando] = useState(false);
  const [paso, setPaso] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (!analizando) return;
    setPaso(0);
    const id = window.setInterval(() => setPaso((p) => Math.min(p + 1, PASOS_ANALISIS.length - 1)), 4000);
    return () => window.clearInterval(id);
  }, [analizando]);

  function elegirArchivo(f: File | undefined | null) {
    setError(null);
    if (!f) return;
    const esPdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
    if (!esPdf) {
      setError("Solo se aceptan archivos PDF.");
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setError(`El PDF supera el máximo de ${MAX_MB} MB.`);
      return;
    }
    setArchivo(f);
    onAnalisis(null);
  }

  function quitarArchivo() {
    abortRef.current?.abort();
    setAnalizando(false);
    setArchivo(null);
    setError(null);
    onAnalisis(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function analizar() {
    if (!archivo || analizando) return;
    setError(null);
    setAnalizando(true);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const r = await analizarPlanificacionPdf(archivo, { nivel, grado, area }, controller.signal);
      onAnalisis(r);
      const primero = r.temas[0];
      if (primero) onSeleccionarTema(primero.titulo);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof QuizApiError ? e.message : "No se pudo analizar la planificación. Intenta de nuevo.");
    } finally {
      setAnalizando(false);
    }
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setArrastrando(false);
    elegirArchivo(e.dataTransfer.files?.[0]);
  }

  const opcionesTema = analisis
    ? [
        ...analisis.temas.map((t) => ({ titulo: t.titulo, descripcion: t.descripcion, todo: false })),
        { titulo: analisis.titulo, descripcion: "Preguntas variadas de todo el documento.", todo: true },
      ]
    : [];

  return (
    <div className="space-y-3">
      {!archivo ? (
        <label
          htmlFor="planificacion-pdf"
          onDragOver={(e) => {
            e.preventDefault();
            setArrastrando(true);
          }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={onDrop}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-7 text-center transition focus-within:ring-2 focus-within:ring-primario ${
            arrastrando ? "border-primario bg-primario-suave" : "border-borde-fuerte bg-superficie-2 hover:border-primario"
          }`}
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primario-suave text-primario">
            <FileUp className="h-6 w-6" aria-hidden />
          </span>
          <span className="text-sm font-bold">Sube tu planificación, guía o libro en PDF</span>
          <span className="text-xs font-medium text-texto/60">
            Toca para elegir el archivo o arrástralo aquí · máximo {MAX_MB} MB
          </span>
          <input
            ref={inputRef}
            id="planificacion-pdf"
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            onChange={(e) => elegirArchivo(e.target.files?.[0])}
          />
        </label>
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border-2 border-borde bg-superficie-2 p-3 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-error/10 text-error">
              <FileText className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold" title={archivo.name}>
                {archivo.name}
              </p>
              <p className="text-xs font-medium text-texto/55">{formatearTamano(archivo.size)}</p>
            </div>
            <button
              type="button"
              onClick={quitarArchivo}
              className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-texto/60 transition hover:bg-error/10 hover:text-error focus:outline-none focus-visible:ring-2 focus-visible:ring-primario"
              aria-label="Quitar el archivo"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {!analisis && (
            <button
              type="button"
              onClick={analizar}
              disabled={analizando}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-primario px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-primario/50 disabled:opacity-70"
            >
              {analizando ? (
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <ListChecks className="h-4 w-4" aria-hidden />
              )}
              {analizando ? "Analizando..." : "Detectar temas"}
            </button>
          )}
        </div>
      )}

      <AnimatePresence>
        {analizando && (
          <motion.p
            key={paso}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-center text-xs font-semibold text-primario"
            aria-live="polite"
          >
            {PASOS_ANALISIS[paso]}
          </motion.p>
        )}
      </AnimatePresence>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-error-borde bg-error/10 px-3 py-2.5 text-sm font-semibold text-error-texto"
        >
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">{error}</span>
          {archivo && !analizando && (
            <button type="button" onClick={analizar} className="shrink-0 font-bold underline">
              Reintentar
            </button>
          )}
        </div>
      )}

      {analisis && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <div className="rounded-xl border border-lila-borde bg-lila/60 p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="min-w-0 break-words text-sm font-bold">{analisis.titulo}</p>
              <span className="shrink-0 text-[11px] font-semibold text-texto/55">
                {analisis.paginas === 1 ? "1 página" : `${analisis.paginas} páginas`}
              </span>
            </div>
            <p className="mt-1 text-xs font-medium leading-relaxed text-texto/70">{analisis.resumen}</p>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-texto/60">Elige el tema de la lección:</span>
            <button
              type="button"
              onClick={() => {
                onAnalisis(null);
                void analizar();
              }}
              className="inline-flex items-center gap-1 text-xs font-bold text-primario hover:underline"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Volver a analizar
            </button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Temas de la planificación">
            {opcionesTema.map((t) => {
              const activo = temaSeleccionado === t.titulo;
              return (
                <button
                  key={`${t.todo ? "todo" : "tema"}-${t.titulo}`}
                  type="button"
                  role="radio"
                  aria-checked={activo}
                  onClick={() => onSeleccionarTema(t.titulo)}
                  className={`flex min-w-0 items-start gap-2.5 rounded-lg border-2 p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primario ${
                    activo ? "border-primario bg-primario-suave" : "border-borde bg-superficie-2 hover:border-borde-fuerte"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                      activo ? "border-primario" : "border-borde-fuerte"
                    }`}
                    aria-hidden
                  >
                    {activo && <span className="h-2 w-2 rounded-full bg-primario" />}
                  </span>
                  <span className="min-w-0">
                    <span className={`block break-words text-sm font-bold ${activo ? "text-primario" : ""}`}>
                      {t.todo ? "Todo el documento" : t.titulo}
                    </span>
                    <span className="mt-0.5 block break-words text-xs font-medium text-texto/60">{t.descripcion}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
}
