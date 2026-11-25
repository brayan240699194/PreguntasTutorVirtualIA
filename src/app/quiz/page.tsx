"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CircleAlert,
  CircleCheck,
  CircleX,
  Clock,
  FileDown,
  Flag,
  Flame,
  House,
  Printer,
  RefreshCw,
  Repeat,
  Target,
  Trophy,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import LessonLoader from "@/components/LessonLoader";
import MathText from "@/components/MathText";
import QuestionCard from "@/components/quiz/QuestionCard";
import ReporteImprimible from "@/components/quiz/ReporteImprimible";
import ThemeToggle from "@/components/ThemeToggle";
import FloatingTutorPiP from "@/components/tutor/FloatingTutorPiP";
import LiveSubtitles from "@/components/tutor/LiveSubtitles";
import { BarraSuperior, Panel } from "@/components/ui/AppChrome";
import { useTutorVoice } from "@/hooks/useTutorVoice";
import { QuizApiError, solicitarLeccion } from "@/lib/api";
import { ETAPAS_INFO, obtenerArea, obtenerGrado } from "@/lib/catalogo";
import { useQuizStore, useStoreHydrated } from "@/store/useQuizStore";
import {
  LETRAS,
  type DatosEstudiante,
  type Letra,
  type Opcion,
  type Pregunta,
  type ResultadoSesion,
} from "@/types/quiz";

/* ============================================================================
 * Utilidades
 * ========================================================================== */

const PREFIJOS_ERROR = ["No exactamente.", "Casi, pero no.", "Mmm, no del todo.", "Buen intento, pero no."];

function contarPalabras(t: string): number {
  return t.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Guion de voz al fallar: si el feedback de la opción elegida es breve, el tutor
 * corrige exactamente ESE error; si no, usa el guion general de la pregunta.
 */
function construirGuionError(pregunta: Pregunta, elegida: Opcion | undefined, semilla: number): string {
  if (elegida && contarPalabras(elegida.feedbackEspecifico) <= 32) {
    const prefijo = PREFIJOS_ERROR[semilla % PREFIJOS_ERROR.length] ?? PREFIJOS_ERROR[0];
    return `${prefijo} ${elegida.feedbackEspecifico}`;
  }
  return pregunta.guionVozError;
}

/** Texto que el tutor lee para presentar la pregunta y sus opciones. */
function guionPregunta(p: Pregunta): string {
  const opciones = p.opciones.map((o) => `Opción ${o.letra}: ${o.texto}.`).join(" ");
  const enunciado = /[.?!¿¡:]$/.test(p.enunciado.trim()) ? p.enunciado.trim() : `${p.enunciado.trim()}.`;
  return `${enunciado} ${opciones}`;
}

function formatearDuracion(ms: number): string {
  const totalSeg = Math.round(ms / 1000);
  const h = Math.floor(totalSeg / 3600);
  const m = Math.floor((totalSeg % 3600) / 60);
  const s = totalSeg % 60;
  if (h > 0) return `${h} h ${m} min`;
  return `${m}:${s.toString().padStart(2, "0")} min`;
}

function nivelDominio(p: number): { etiqueta: string; color: string; mensaje: string } {
  if (p >= 90) return { etiqueta: "Dominio experto", color: "#2ECC71", mensaje: "¡Excelente! Dominas este tema." };
  if (p >= 70) return { etiqueta: "Buen dominio", color: "#3A8BEA", mensaje: "¡Muy bien! Vas por buen camino." };
  if (p >= 40)
    return { etiqueta: "En progreso", color: "#F5B400", mensaje: "Buen esfuerzo. Repasa las preguntas falladas." };
  return { etiqueta: "Necesita repaso", color: "#D94336", mensaje: "No te rindas, practica de nuevo y mejorarás." };
}

function guionResultado(r: ResultadoSesion): string {
  const base = `Terminaste la lección. Acertaste ${r.aciertos} de ${r.total} preguntas, un ${r.porcentaje} por ciento.`;
  if (r.porcentaje >= 90) return `${base} ¡Dominas este tema!`;
  if (r.porcentaje >= 70) return `${base} ¡Muy buen trabajo, sigue así!`;
  if (r.porcentaje >= 40) return `${base} Vamos a repasar las que fallaste para reforzarlas.`;
  return `${base} No pasa nada, equivocarse es parte de aprender. Practiquemos de nuevo.`;
}

/* ============================================================================
 * Página
 * ========================================================================== */

export default function QuizPage() {
  const router = useRouter();
  const hidratado = useStoreHydrated();

  const config = useQuizStore((s) => s.config);
  const preguntas = useQuizStore((s) => s.preguntas);
  const respuestas = useQuizStore((s) => s.respuestas);
  const calificaciones = useQuizStore((s) => s.calificaciones);
  const indiceActual = useQuizStore((s) => s.indiceActual);
  const finalizadoEn = useQuizStore((s) => s.finalizadoEn);
  const ultimoResultado = useQuizStore((s) => s.ultimoResultado);
  const rachaActual = useQuizStore((s) => s.rachaActual);
  const modo = useQuizStore((s) => s.modo);
  const sonidoActivado = useQuizStore((s) => s.sonidoActivado);
  const tutorExpandido = useQuizStore((s) => s.tutorExpandido);
  const datosEstudiante = useQuizStore((s) => s.datosEstudiante);

  const responder = useQuizStore((s) => s.responder);
  const siguiente = useQuizStore((s) => s.siguiente);
  const anterior = useQuizStore((s) => s.anterior);
  const calificar = useQuizStore((s) => s.calificar);
  const finalizar = useQuizStore((s) => s.finalizar);
  const toggleSonido = useQuizStore((s) => s.toggleSonido);
  const toggleTutorExpandido = useQuizStore((s) => s.toggleTutorExpandido);
  const salirSesion = useQuizStore((s) => s.salirSesion);
  const practicarFalladas = useQuizStore((s) => s.practicarFalladas);
  const iniciarSesion = useQuizStore((s) => s.iniciarSesion);
  const setDatosEstudiante = useQuizStore((s) => s.setDatosEstudiante);

  const voz = useTutorVoice({ enabled: sonidoActivado });
  const { speak, stop } = voz;

  const [generando, setGenerando] = useState(false);
  const [errorGeneracion, setErrorGeneracion] = useState<string | null>(null);
  const contadorErroresRef = useRef(0);

  const pregunta: Pregunta | undefined = preguntas[indiceActual];
  const total = preguntas.length;
  const respondidas = Object.keys(respuestas).length;
  const aciertos = useMemo(() => Object.values(respuestas).filter((r) => r.esCorrecta).length, [respuestas]);
  const respuestaActual = pregunta ? respuestas[pregunta.id] : undefined;
  const esUltima = indiceActual === total - 1;
  const todasRespondidas = total > 0 && respondidas >= total;
  const terminado = finalizadoEn !== null;
  const lecturaAutomatica = config ? ETAPAS_INFO[obtenerGrado(config.grado).etapa].lecturaAutomatica : false;

  /* --------------------- Redirección sin sesión --------------------------- */
  useEffect(() => {
    if (hidratado && preguntas.length === 0) router.replace("/");
  }, [hidratado, preguntas.length, router]);

  /* --------------------- Al cambiar de pregunta --------------------------- */
  // Corta la voz anterior y, en Inicial / Preparatoria / Elemental, lee la
  // pregunta y sus opciones en voz alta para quienes aún no leen con fluidez.
  const preguntaId = pregunta?.id;
  useEffect(() => {
    stop();
    if (!lecturaAutomatica || terminado || !preguntaId) return;
    const estado = useQuizStore.getState();
    if (estado.respuestas[preguntaId]) return;
    const actual = estado.preguntas.find((p) => p.id === preguntaId);
    if (!actual) return;
    const t = window.setTimeout(() => speak(guionPregunta(actual)), 450);
    return () => window.clearTimeout(t);
  }, [preguntaId, lecturaAutomatica, terminado, speak, stop]);

  const handleEscuchar = useCallback(() => {
    if (pregunta) speak(guionPregunta(pregunta));
  }, [pregunta, speak]);

  /* --------------------- Acciones ----------------------------------------- */
  const handleResponder = useCallback(
    (letra: Letra) => {
      if (!pregunta || terminado) return;
      const r = responder(pregunta.id, letra);
      if (!r) return;
      if (r.esCorrecta) {
        speak(pregunta.guionVozAcierto);
      } else {
        const elegida = pregunta.opciones.find((o) => o.letra === letra);
        speak(construirGuionError(pregunta, elegida, contadorErroresRef.current++));
      }
    },
    [pregunta, responder, speak, terminado],
  );

  const handleSiguiente = useCallback(() => {
    if (!respuestaActual) return;
    if (esUltima) {
      if (!todasRespondidas) return;
      stop();
      const resultado = finalizar();
      if (resultado) {
        window.scrollTo({ top: 0, behavior: "smooth" });
        window.setTimeout(() => speak(guionResultado(resultado)), 450);
      }
      return;
    }
    siguiente();
  }, [esUltima, finalizar, respuestaActual, siguiente, speak, stop, todasRespondidas]);

  const handleAnterior = useCallback(() => {
    anterior();
  }, [anterior]);

  const handleCerrar = useCallback(() => {
    if (!terminado && respondidas > 0 && respondidas < total) {
      const ok = window.confirm("¿Salir de la lección? Tu progreso quedará guardado para continuar luego.");
      if (!ok) return;
    }
    stop();
    if (terminado) salirSesion();
    router.push("/");
  }, [respondidas, router, salirSesion, stop, terminado, total]);

  const handleToggleSonido = useCallback(() => {
    if (sonidoActivado) stop();
    toggleSonido();
  }, [sonidoActivado, stop, toggleSonido]);

  const handlePracticarFalladas = useCallback(() => {
    stop();
    if (practicarFalladas()) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      window.setTimeout(() => speak("Vamos a repasar las preguntas que fallaste. ¡Tú puedes!"), 400);
    }
  }, [practicarFalladas, speak, stop]);

  const handleNuevoBanco = useCallback(async () => {
    if (!config || generando) return;
    stop();
    setErrorGeneracion(null);
    setGenerando(true);
    try {
      const data = await solicitarLeccion(config);
      iniciarSesion(data.config, data.preguntas, "normal");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setErrorGeneracion(
        err instanceof QuizApiError ? err.message : "No se pudo generar un nuevo banco. Intenta de nuevo.",
      );
    } finally {
      setGenerando(false);
    }
  }, [config, generando, iniciarSesion, stop]);

  /* --------------------- Atajos de teclado -------------------------------- */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (terminado || generando) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const tecla = e.key.toUpperCase();
      const porNumero: Record<string, Letra> = { "1": "A", "2": "B", "3": "C", "4": "D" };
      const letra = (LETRAS as readonly string[]).includes(tecla) ? (tecla as Letra) : porNumero[tecla];

      if (letra && !respuestaActual) {
        e.preventDefault();
        handleResponder(letra);
      } else if ((e.key === "ArrowRight" || e.key === "Enter") && respuestaActual) {
        e.preventDefault();
        handleSiguiente();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handleAnterior();
      } else if (e.key === "Escape") {
        stop();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [generando, handleAnterior, handleResponder, handleSiguiente, respuestaActual, stop, terminado]);

  /* --------------------- Render ------------------------------------------- */
  if (!hidratado || !config || preguntas.length === 0) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <motion.span
          className="h-10 w-10 rounded-full border-4 border-borde border-t-primario"
          animate={{ rotate: 360 }}
          transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
          aria-label="Cargando"
        />
      </main>
    );
  }

  const areaInfo = obtenerArea(config.area);

  return (
    <>
      <main className="flex min-h-dvh w-full flex-col px-3 pb-[190px] pt-3 sm:px-6 lg:px-8 lg:pb-[110px] print:hidden">
        <LessonLoader visible={generando} tema={config.tema} />

        {/* Header */}
        <div className="sticky top-0 z-30 -mx-3 bg-fondo/90 px-3 pb-2 pt-1 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <BarraSuperior
            izquierda={
              <>
                <button
                  type="button"
                  onClick={handleCerrar}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  aria-label="Cerrar lección"
                >
                  <X className="h-6 w-6" />
                </button>
                <motion.span
                  key={terminado ? "fin" : indiceActual}
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="shrink-0 whitespace-nowrap rounded-full bg-white px-2.5 py-1 text-xs font-extrabold text-primario shadow sm:px-3.5 sm:py-1.5 sm:text-sm"
                >
                  {terminado ? "Resultados" : `${indiceActual + 1} de ${total}`}
                </motion.span>
                <span
                  className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-white/15 px-2.5 py-1 text-xs font-extrabold sm:px-3 sm:py-1.5 sm:text-sm"
                  title={`Aciertos / respondidas · racha actual: ${rachaActual}`}
                  aria-label={`${aciertos} aciertos de ${respondidas} respondidas`}
                >
                  <Flame className={`h-4 w-4 ${rachaActual > 0 ? "text-dorado" : "text-white/60"}`} aria-hidden />
                  {aciertos}/{respondidas}
                </span>
              </>
            }
            derecha={
              <>
                <ThemeToggle compacto />
                <button
                  type="button"
                  onClick={handleToggleSonido}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                    sonidoActivado ? "text-white hover:bg-white/15" : "bg-white text-error"
                  }`}
                  aria-label={sonidoActivado ? "Silenciar tutor" : "Activar voz del tutor"}
                  aria-pressed={!sonidoActivado}
                >
                  {sonidoActivado ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
                </button>
              </>
            }
          />

          {/* Barra de progreso */}
          <div className="mt-2.5 flex gap-1" aria-hidden>
            {preguntas.map((p, i) => {
              const r = respuestas[p.id];
              const color = r
                ? r.esCorrecta
                  ? "bg-exito"
                  : "bg-error"
                : i === indiceActual
                  ? "bg-primario"
                  : "bg-borde";
              return <span key={p.id} className={`h-1.5 flex-1 rounded-full transition-colors ${color}`} />;
            })}
          </div>

          <p className="mt-1.5 truncate text-center text-xs font-semibold text-texto/55">
            {areaInfo.nombre} · {obtenerGrado(config.grado).nombre} · {config.tema}
            {config.planificacion && <span className="ml-1 text-primario">· Planificación</span>}
            {modo === "repaso" && <span className="ml-1 text-primario">· Repaso</span>}
          </p>
        </div>

        {/* En escritorio se reserva una columna derecha para la ventana del tutor */}
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-6">
        <div className="min-w-0">
        {terminado && ultimoResultado ? (
          <ResultadosView
            resultado={ultimoResultado}
            preguntas={preguntas}
            respuestas={respuestas}
            datos={datosEstudiante}
            onDatosChange={setDatosEstudiante}
            generando={generando}
            errorGeneracion={errorGeneracion}
            onPracticarFalladas={handlePracticarFalladas}
            onNuevoBanco={handleNuevoBanco}
            onInicio={() => {
              stop();
              salirSesion();
              router.push("/");
            }}
          />
        ) : (
          pregunta && (
            <>
              <div className="mt-3">
                <AnimatePresence mode="wait">
                  <QuestionCard
                    key={pregunta.id}
                    pregunta={pregunta}
                    numero={indiceActual + 1}
                    total={total}
                    respuesta={respuestaActual}
                    calificacion={calificaciones[pregunta.id]}
                    onResponder={handleResponder}
                    onCalificar={(v) => calificar(pregunta.id, v)}
                    onEscuchar={handleEscuchar}
                  />
                </AnimatePresence>
              </div>

              {/* Navegación inferior */}
              <nav className="mt-4 flex items-center justify-between gap-3" aria-label="Navegación de preguntas">
                <button
                  type="button"
                  onClick={handleAnterior}
                  disabled={indiceActual === 0}
                  className="inline-flex items-center gap-1.5 rounded-xl border-2 border-borde bg-superficie px-3 py-3 text-sm font-bold sm:gap-2 sm:px-4 sm:text-base text-texto/80 transition hover:border-borde-fuerte hover:text-texto focus:outline-none focus-visible:ring-2 focus-visible:ring-primario disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ArrowLeft className="h-5 w-5" aria-hidden /> Anterior
                </button>
                <motion.button
                  type="button"
                  onClick={handleSiguiente}
                  disabled={!respuestaActual || (esUltima && !todasRespondidas)}
                  whileTap={{ scale: 0.97 }}
                  animate={respuestaActual ? { scale: [1, 1.04, 1] } : { scale: 1 }}
                  transition={{ duration: 0.35 }}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-3 text-sm font-extrabold transition sm:gap-2 sm:px-5 sm:text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-primario disabled:cursor-not-allowed disabled:opacity-40 ${
                    esUltima ? "bg-exito text-[#0E2A1B]" : "bg-primario text-white"
                  }`}
                >
                  {esUltima ? (
                    <>
                      <Flag className="h-5 w-5" aria-hidden /> Finalizar Lección
                    </>
                  ) : (
                    <>
                      Siguiente <ArrowRight className="h-5 w-5" aria-hidden />
                    </>
                  )}
                </motion.button>
              </nav>
              {esUltima && respuestaActual && !todasRespondidas && (
                <p className="mt-3 text-center text-sm font-semibold text-[#9A6B00] dark:text-dorado">
                  Te faltan preguntas por responder. Usa “Anterior” para completarlas.
                </p>
              )}
            </>
          )
        )}
        </div>
        <div className="hidden lg:block" aria-hidden />
        </div>

        <FloatingTutorPiP
          isSpeaking={voz.isSpeaking}
          wordIndex={voz.currentWordIndex}
          expanded={tutorExpandido}
          soundEnabled={sonidoActivado}
          voiceSupported={voz.isSupported}
          voiceName={voz.voiceName}
          onStop={stop}
          onToggleExpand={toggleTutorExpandido}
        />
        <LiveSubtitles words={voz.words} currentWordIndex={voz.currentWordIndex} visible={voz.subtitleVisible} />
      </main>

      {/* Solo visible al imprimir / guardar como PDF */}
      {terminado && ultimoResultado && (
        <ReporteImprimible
          resultado={ultimoResultado}
          preguntas={preguntas}
          respuestas={respuestas}
          datos={datosEstudiante}
        />
      )}
    </>
  );
}

/* ============================================================================
 * Resultados
 * ========================================================================== */

interface ResultadosViewProps {
  resultado: ResultadoSesion;
  preguntas: Pregunta[];
  respuestas: Record<string, { letraElegida: Letra; esCorrecta: boolean }>;
  datos: DatosEstudiante;
  onDatosChange: (datos: Partial<DatosEstudiante>) => void;
  generando: boolean;
  errorGeneracion: string | null;
  onPracticarFalladas: () => void;
  onNuevoBanco: () => void;
  onInicio: () => void;
}

const CAMPOS: { clave: keyof DatosEstudiante; etiqueta: string; placeholder: string; requerido: boolean }[] = [
  { clave: "nombre", etiqueta: "Nombre del estudiante", placeholder: "Ej. María José Pérez", requerido: true },
  { clave: "institucion", etiqueta: "Unidad educativa", placeholder: "Ej. Unidad Educativa San José", requerido: true },
  { clave: "curso", etiqueta: "Curso / Paralelo", placeholder: "Ej. 2.º BGU «A»", requerido: false },
  { clave: "docente", etiqueta: "Docente", placeholder: "Ej. Lcdo. Juan Andrade", requerido: false },
];

function ResultadosView({
  resultado,
  preguntas,
  respuestas,
  datos,
  onDatosChange,
  generando,
  errorGeneracion,
  onPracticarFalladas,
  onNuevoBanco,
  onInicio,
}: ResultadosViewProps) {
  const dominio = nivelDominio(resultado.porcentaje);
  const falladas = preguntas.filter((p) => !respuestas[p.id]?.esCorrecta);
  const radio = 54;
  const circunferencia = 2 * Math.PI * radio;

  const [faltantes, setFaltantes] = useState<(keyof DatosEstudiante)[]>([]);
  const inputsRef = useRef<Partial<Record<keyof DatosEstudiante, HTMLInputElement | null>>>({});

  function imprimir() {
    const vacios = CAMPOS.filter((c) => c.requerido && datos[c.clave].trim() === "").map((c) => c.clave);
    setFaltantes(vacios);
    if (vacios.length > 0) {
      const primero = vacios[0];
      if (primero) inputsRef.current[primero]?.focus();
      return;
    }
    // El título del documento se usa como nombre sugerido del PDF.
    const tituloOriginal = document.title;
    const limpio = (t: string) => t.replace(/[\\/:*?"<>|]/g, "").trim();
    document.title = limpio(`Informe ${datos.nombre} - ${resultado.config.tema}`);
    const restaurar = () => {
      document.title = tituloOriginal;
      window.removeEventListener("afterprint", restaurar);
    };
    window.addEventListener("afterprint", restaurar);
    window.print();
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="mt-3 space-y-4"
      aria-labelledby="resultados-titulo"
    >
      <div className="rounded-xl bg-superficie p-5 text-center shadow-[0_4px_20px_var(--c-sombra)] sm:p-8">
        <Trophy className="mx-auto h-10 w-10 text-dorado" aria-hidden />
        <h1 id="resultados-titulo" className="mt-2 text-2xl font-extrabold sm:text-3xl">
          ¡Lección completada!
        </h1>
        <p className="mt-1 font-medium text-texto/65">{dominio.mensaje}</p>

        <div className="relative mx-auto mt-6 h-40 w-40">
          <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90" aria-hidden>
            <circle cx="64" cy="64" r={radio} fill="none" stroke="var(--c-superficie-3)" strokeWidth="12" />
            <motion.circle
              cx="64"
              cy="64"
              r={radio}
              fill="none"
              stroke={dominio.color}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={circunferencia}
              initial={{ strokeDashoffset: circunferencia }}
              animate={{ strokeDashoffset: circunferencia * (1 - resultado.porcentaje / 100) }}
              transition={{ duration: 1.2, ease: "easeOut", delay: 0.2 }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-extrabold">{resultado.porcentaje}%</span>
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: dominio.color }}>
              {dominio.etiqueta}
            </span>
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-3 gap-3">
          {[
            { icono: Target, etiqueta: "Puntaje", valor: `${resultado.aciertos}/${resultado.total}` },
            { icono: Clock, etiqueta: "Tiempo", valor: formatearDuracion(resultado.duracionMs) },
            { icono: Flame, etiqueta: "Racha", valor: String(resultado.mejorRachaSesion) },
          ].map(({ icono: Icono, etiqueta, valor }) => (
            <div key={etiqueta} className="overflow-hidden rounded-lg border border-lila-borde">
              <dt className="flex items-center justify-center gap-1 bg-lila py-1.5 text-[11px] font-bold uppercase">
                <Icono className="h-3.5 w-3.5" aria-hidden /> {etiqueta}
              </dt>
              <dd className="py-2.5 text-lg font-extrabold text-primario sm:text-xl">{valor}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onPracticarFalladas}
            disabled={falladas.length === 0 || generando}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primario px-4 py-3.5 font-bold text-white transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-primario/50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Repeat className="h-5 w-5" aria-hidden />
            Practicar solo las falladas{falladas.length > 0 ? ` (${falladas.length})` : ""}
          </button>
          <button
            type="button"
            onClick={onNuevoBanco}
            disabled={generando}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-primario bg-primario-suave px-4 py-3.5 font-bold text-primario transition hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-primario/50 disabled:opacity-40"
          >
            <RefreshCw className={`h-5 w-5 ${generando ? "animate-spin" : ""}`} aria-hidden />
            Generar nuevo banco sobre este tema
          </button>
        </div>
        <button
          type="button"
          onClick={onInicio}
          className="mt-3 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-texto/60 transition hover:bg-superficie-3 hover:text-texto"
        >
          <House className="h-4 w-4" aria-hidden /> Volver al inicio
        </button>

        {errorGeneracion && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-lg border border-error-borde bg-error/10 px-4 py-3 text-left text-sm font-semibold text-error-texto"
          >
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {errorGeneracion}
          </div>
        )}
      </div>

      {/* Datos para el informe imprimible */}
      <Panel titulo="Informe de resultados" id="informe">
        <p className="mb-4 text-sm font-medium text-texto/65">
          Completa tus datos para imprimir el informe o guardarlo como PDF. Se recordarán en este navegador para tus
          próximas lecciones.
        </p>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            imprimir();
          }}
          noValidate
        >
          {CAMPOS.map((c) => {
            const invalido = faltantes.includes(c.clave) && datos[c.clave].trim() === "";
            return (
              <div key={c.clave}>
                <label htmlFor={`campo-${c.clave}`} className="mb-1 block text-xs font-bold text-texto/75">
                  {c.etiqueta}
                  {c.requerido && <span className="text-error"> *</span>}
                </label>
                <input
                  id={`campo-${c.clave}`}
                  ref={(el) => {
                    inputsRef.current[c.clave] = el;
                  }}
                  type="text"
                  value={datos[c.clave]}
                  maxLength={90}
                  placeholder={c.placeholder}
                  autoComplete={c.clave === "nombre" ? "name" : c.clave === "institucion" ? "organization" : "off"}
                  onChange={(e) => onDatosChange({ [c.clave]: e.target.value })}
                  aria-invalid={invalido}
                  aria-describedby={invalido ? `error-${c.clave}` : undefined}
                  className={`w-full rounded-lg border-2 bg-superficie-2 px-3 py-2.5 text-sm font-semibold placeholder:font-medium placeholder:text-texto/40 focus:outline-none ${
                    invalido ? "border-error-borde" : "border-borde focus:border-primario"
                  }`}
                />
                {invalido && (
                  <p id={`error-${c.clave}`} className="mt-1 text-xs font-semibold text-error-texto">
                    Este dato es obligatorio para el informe.
                  </p>
                )}
              </div>
            );
          })}

          <div className="flex flex-col gap-3 pt-1 sm:col-span-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={imprimir}
              className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-primario px-5 py-2.5 font-bold text-primario transition hover:bg-primario-suave focus:outline-none focus-visible:ring-2 focus-visible:ring-primario/50"
              title="Guardar como PDF: en el cuadro de impresión elige «Guardar como PDF»"
            >
              <FileDown className="h-5 w-5" aria-hidden /> Guardar PDF
            </button>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primario px-5 py-2.5 font-bold text-white transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-primario/50"
            >
              <Printer className="h-5 w-5" aria-hidden /> Imprimir
            </button>
          </div>
        </form>
        <p className="mt-3 text-xs font-medium text-texto/50">
          Para guardar en PDF, en el cuadro de impresión selecciona el destino «Guardar como PDF».
        </p>
      </Panel>

      {/* Repaso de preguntas falladas */}
      <h2 className="pt-2 text-sm font-bold uppercase tracking-wide text-texto/60">
        {falladas.length > 0 ? `Preguntas falladas (${falladas.length})` : "Preguntas"}
      </h2>
      {falladas.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-exito/50 bg-exito/10 p-4 font-bold text-exito-texto">
          <CircleCheck className="h-6 w-6 shrink-0 text-exito" aria-hidden />
          ¡Perfecto! Respondiste todas las preguntas correctamente.
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {falladas.map((p, i) => {
            const r = respuestas[p.id];
            const elegida = r ? p.opciones.find((o) => o.letra === r.letraElegida) : undefined;
            const correcta = p.opciones.find((o) => o.letra === p.letraCorrecta);
            return (
              <motion.li
                key={p.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                className="overflow-hidden rounded-xl bg-superficie shadow-[0_2px_12px_var(--c-sombra)]"
              >
                <div className="bg-error px-4 py-2.5 text-sm font-semibold text-white">
                  <MathText text={p.bannerExplicacion} />
                </div>
                <div className="space-y-3 p-4">
                  <div className="font-bold leading-snug">
                    <MathText text={p.enunciado} />
                  </div>
                  <div className="flex items-start gap-2 rounded-lg border-2 border-error-borde bg-error/10 p-3 text-sm">
                    <CircleX className="mt-0.5 h-4 w-4 shrink-0 text-error" aria-hidden />
                    <div>
                      <span className="block text-[11px] font-bold uppercase text-error-texto">Tu respuesta</span>
                      <span className="font-semibold">
                        {elegida ? <MathText text={`${elegida.letra}. ${elegida.texto}`} /> : "Sin responder"}
                      </span>
                      {elegida && (
                        <span className="mt-1 block text-texto/70">
                          <MathText text={elegida.feedbackEspecifico} />
                        </span>
                      )}
                    </div>
                  </div>
                  {correcta && (
                    <div className="flex items-start gap-2 rounded-lg border-2 border-exito bg-exito/10 p-3 text-sm">
                      <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-exito" aria-hidden />
                      <div>
                        <span className="block text-[11px] font-bold uppercase text-exito-texto">Respuesta correcta</span>
                        <span className="font-semibold">
                          <MathText text={`${correcta.letra}. ${correcta.texto}`} />
                        </span>
                        <span className="mt-1 block text-texto/70">
                          <MathText text={correcta.feedbackEspecifico} />
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </motion.li>
            );
          })}
        </ul>
      )}
    </motion.section>
  );
}
