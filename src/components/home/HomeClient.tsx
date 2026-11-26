"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CircleAlert, Ear, FileText, Flame, Lock, PenLine, Play, Search, Trash2, TriangleAlert, Trophy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import AreaIcon from "@/components/AreaIcon";
import PlanificacionPdf from "@/components/home/PlanificacionPdf";
import LessonLoader from "@/components/LessonLoader";
import ThemeToggle from "@/components/ThemeToggle";
import TutorAvatar from "@/components/tutor/TutorAvatar";
import { BandaTitulo, BarraSuperior, MarcaApp, Panel } from "@/components/ui/AppChrome";
import { QuizApiError, solicitarLeccion } from "@/lib/api";
import { areasCompatibles, nombreArea } from "@/lib/asignaturaPdf";
import {
  AREAS_INFO,
  ETAPAS_INFO,
  NIVELES_INFO,
  areasDeGrado,
  buscarArea,
  gradosDeNivel,
  obtenerGrado,
  temasSugeridos,
} from "@/lib/catalogo";
import { sanitizarTema, TEMA_MAX, TEMA_MIN } from "@/lib/validators";
import { useQuizStore, useStoreHydrated } from "@/store/useQuizStore";
import {
  CANTIDADES,
  GRADOS,
  type AnalizarPlanificacionResponse,
  type AreaId,
  type CantidadPreguntas,
  type EtapaId,
  type GradoId,
  type NivelId,
} from "@/types/quiz";

const ETIQUETA_SUBNIVEL: Partial<Record<EtapaId, string>> = {
  "egb-preparatoria": "Preparatoria",
  "egb-elemental": "Elemental",
  "egb-media": "Media",
  "egb-superior": "Superior",
};

/** Nota bajo los paneles bloqueados mientras hay una planificación cargada. */
function AvisoBloqueo() {
  return (
    <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-texto/60">
      <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
      Fijado por la planificación cargada. Quita el PDF para cambiarlo.
    </p>
  );
}

/** Dibujo de cada nivel educativo. */
const EMOJI_NIVEL: Record<NivelId, string> = { inicial: "🧸", egb: "✏️", bgu: "🎓" };

function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-EC", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

const esGrado = (x: unknown): x is GradoId => typeof x === "string" && (GRADOS as readonly string[]).includes(x);

export default function HomeClient({ pdfHabilitado }: { pdfHabilitado: boolean }) {
  const router = useRouter();
  const hidratado = useStoreHydrated();

  const iniciarSesion = useQuizStore((s) => s.iniciarSesion);
  const sesionActiva = useQuizStore((s) => s.preguntas.length > 0 && s.finalizadoEn === null);
  const configActiva = useQuizStore((s) => s.config);
  const progresoActivo = useQuizStore((s) => Object.keys(s.respuestas).length);
  const totalActivo = useQuizStore((s) => s.preguntas.length);
  const historial = useQuizStore((s) => s.historial);
  const analitica = useQuizStore((s) => s.analitica);
  const mejorRacha = useQuizStore((s) => s.mejorRachaGlobal);
  const borrarHistorial = useQuizStore((s) => s.borrarHistorial);

  // El formulario empieza vacío: cada paso aparece cuando se completa el anterior.
  const [nivel, setNivel] = useState<NivelId | null>(null);
  const [grado, setGrado] = useState<GradoId | null>(null);
  const [area, setArea] = useState<AreaId | null>(null);
  const [tema, setTema] = useState("");
  const [cantidad, setCantidad] = useState<CantidadPreguntas | null>(null);
  const [modoTema, setModoTema] = useState<"manual" | "pdf">("manual");
  const [analisis, setAnalisis] = useState<AnalizarPlanificacionResponse | null>(null);
  const usarPlanificacion = pdfHabilitado && modoTema === "pdf";
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const grados = useMemo(() => (nivel ? gradosDeNivel(nivel) : []), [nivel]);
  const areas = useMemo(() => (grado ? areasDeGrado(grado) : []), [grado]);
  const gradoInfo = grado ? obtenerGrado(grado) : null;
  const etapa = gradoInfo ? ETAPAS_INFO[gradoInfo.etapa] : null;
  const sugerencias = area && grado ? temasSugeridos(area, grado) : [];
  const temaLimpio = useMemo(() => sanitizarTema(tema), [tema]);
  const temaValido = temaLimpio.length >= TEMA_MIN && /\p{L}/u.test(temaLimpio);

  // Con una planificación analizada, nivel, grado y asignatura quedan fijos:
  // los temas y el contexto se calcularon para esa combinación.
  const bloqueadoPorPdf = usarPlanificacion && analisis !== null;
  const areaPdf = usarPlanificacion ? (analisis?.areaDetectada ?? null) : null;
  const pdfNoCoincide = Boolean(areaPdf && area && !areasCompatibles(areaPdf, area));
  const areaPdfDisponible = areaPdf !== null && areas.some((a) => a.id === areaPdf);

  // Si la asignatura elegida no existe en el nuevo grado, se deja sin elegir.
  useEffect(() => {
    if (area && !areas.some((a) => a.id === area)) setArea(null);
  }, [areas, area]);

  useEffect(() => () => abortRef.current?.abort(), []);

  function elegirNivel(n: NivelId) {
    if (bloqueadoPorPdf) return;
    setNivel(n);
    if (grado && obtenerGrado(grado).nivel !== n) setGrado(null);
    setError(null);
  }

  async function comenzar(e?: FormEvent) {
    e?.preventDefault();
    if (cargando) return;
    if (!nivel || !grado || !area) {
      setError(!nivel ? "Elige el nivel educativo." : !grado ? "Elige el grado o curso." : "Elige la asignatura.");
      return;
    }
    if (usarPlanificacion && !analisis) {
      setError("Sube tu planificación en PDF y pulsa «Detectar temas» antes de comenzar.");
      return;
    }
    if (pdfNoCoincide && areaPdf) {
      setError(
        `Tu planificación es de ${nombreArea(areaPdf)}, pero elegiste ${nombreArea(area)}. Cambia la asignatura o sube la planificación correcta.`,
      );
      return;
    }
    if (!temaValido) {
      setError(
        usarPlanificacion
          ? "Elige uno de los temas detectados en tu planificación."
          : `Escribe un tema específico (mínimo ${TEMA_MIN} letras) o elige uno sugerido.`,
      );
      if (!usarPlanificacion) document.getElementById("tema")?.focus();
      return;
    }
    if (!cantidad) {
      setError("Elige la cantidad de preguntas.");
      return;
    }
    if (sesionActiva && !window.confirm("Tienes una lección en curso. ¿Quieres reemplazarla por una nueva?")) return;
    setError(null);
    setCargando(true);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const data = await solicitarLeccion(
        {
          nivel,
          grado,
          area,
          tema: temaLimpio,
          cantidad,
          ...(usarPlanificacion && analisis
            ? {
                // Solo el fragmento del tema elegido: menos tokens en la generación.
                contexto: analisis.temas.find((t) => sanitizarTema(t.titulo) === temaLimpio)?.contexto ?? analisis.contexto,
                planificacion: analisis.titulo,
              }
            : {}),
        },
        controller.signal,
      );
      iniciarSesion(data.config, data.preguntas, "normal");
      router.push("/quiz");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof QuizApiError ? err.message : "No se pudo generar la lección. Intenta de nuevo.");
      setCargando(false);
    }
  }

  // Grados de EGB agrupados por subnivel.
  const gruposGrados = useMemo(() => {
    const grupos: { etapa: EtapaId; etiqueta: string | null; grados: typeof grados }[] = [];
    for (const g of grados) {
      const ultimo = grupos[grupos.length - 1];
      if (ultimo && ultimo.etapa === g.etapa) ultimo.grados.push(g);
      else grupos.push({ etapa: g.etapa, etiqueta: ETIQUETA_SUBNIVEL[g.etapa] ?? null, grados: [g] });
    }
    return grupos;
  }, [grados]);

  const statsAreas = AREAS_INFO.map((a) => {
    const st = analitica[a.id];
    const dominio = st && st.preguntasRespondidas > 0 ? Math.round((st.aciertos / st.preguntasRespondidas) * 100) : null;
    return { ...a, st, dominio };
  }).filter((a) => a.st && a.st.sesiones > 0);

  const historialValido = historial.filter((h) => buscarArea(h.config.area) && esGrado(h.config.grado));

  return (
    <main className="w-full px-3 pb-16 pt-3 sm:px-6 sm:pt-4 lg:px-8">
      <LessonLoader visible={cargando} tema={temaLimpio} />

      <BarraSuperior
        izquierda={<ThemeToggle />}
        derecha={
          <>
            {hidratado && mejorRacha > 0 && (
              <span
                className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold"
                title="Mejor racha de aciertos seguidos"
              >
                <Flame className="h-4 w-4 text-dorado" aria-hidden />
                {mejorRacha}
              </span>
            )}
            <MarcaApp />
          </>
        }
      />
      <BandaTitulo>Lecciones interactivas · Tutor virtual</BandaTitulo>

      {/* Presentación */}
      <section className="mt-3 flex items-center gap-3 rounded-3xl border-2 border-borde bg-superficie p-4 shadow-[0_6px_0_var(--c-borde),0_10px_24px_-12px_var(--c-sombra)] sm:mt-4 sm:gap-6 sm:p-6">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold text-primario sm:text-base">¡Hola! 👋</p>
          <h1 className="mt-0.5 text-2xl font-black leading-tight sm:text-4xl lg:text-5xl">
            ¿Qué vamos a <span className="text-primario">aprender hoy</span>?
          </h1>
          <p className="mt-2 text-sm font-semibold text-texto/70 sm:text-lg">
            Elige tu grado y tu materia. Yo te leo las preguntas, te ayudo cuando te equivocas y celebro contigo cada
            acierto. 🌟
          </p>
        </div>
        <TutorAvatar isSpeaking={false} size={76} className="shrink-0 md:hidden" />
        <TutorAvatar isSpeaking={false} size={160} className="hidden shrink-0 md:block" />
      </section>

      {/* Continuar lección */}
      <AnimatePresence>
        {hidratado && sesionActiva && configActiva && buscarArea(configActiva.area) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3 flex flex-col gap-3 rounded-xl border border-primario/40 bg-primario-suave p-4 sm:mt-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="text-sm font-bold text-primario">Tienes una lección en curso</p>
              <p className="truncate font-semibold">
                {configActiva.tema} · {progresoActivo} de {totalActivo} respondidas
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push("/quiz")}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primario px-4 py-2.5 font-bold text-white transition hover:brightness-110"
            >
              <Play className="h-4 w-4" aria-hidden /> Continuar
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={comenzar} className="mt-3 space-y-3 sm:mt-4 sm:space-y-4" noValidate>
        {/* 1. Nivel y grado */}
        <Panel paso={1} emoji="🎒" titulo="¿En qué nivel estás?">
          <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-3 sm:gap-3" role="group" aria-label="Nivel educativo">
            {NIVELES_INFO.map((n) => {
              const activo = n.id === nivel;
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => elegirNivel(n.id)}
                  disabled={bloqueadoPorPdf && !activo}
                  aria-pressed={activo}
                  className={`boton-3d relative flex min-h-[64px] min-w-0 items-center gap-3 rounded-2xl border-2 px-3 py-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primario disabled:cursor-not-allowed disabled:opacity-40 min-[400px]:flex-col min-[400px]:gap-1 min-[400px]:px-2 min-[400px]:py-3 min-[400px]:text-center ${
                    activo
                      ? "border-primario bg-primario text-white"
                      : "border-borde bg-superficie-2 text-texto/80 hover:border-borde-fuerte"
                  }`}
                >
                  <span className="relative text-3xl leading-none sm:text-4xl" aria-hidden>
                    {EMOJI_NIVEL[n.id]}
                  </span>
                  <span className="relative block min-w-0 break-words text-sm font-extrabold leading-tight sm:text-base">
                    <span className="lg:hidden">{n.corto}</span>
                    <span className="hidden lg:inline">{n.nombre}</span>
                  </span>
                  <span className={`relative ml-auto block shrink-0 text-xs font-semibold min-[400px]:ml-0 ${activo ? "text-white/85" : "text-texto/55"}`}>
                    {n.descripcion}
                  </span>
                </button>
              );
            })}
          </div>

          {!nivel && (
            <p className="mt-3 text-center text-xs font-semibold text-texto/55">Elige tu nivel educativo para ver los grados.</p>
          )}
          <div className="mt-4 space-y-3 empty:hidden">
            {gruposGrados.map((grupo) => (
              <div key={grupo.etapa} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                {grupo.etiqueta && (
                  <span className="text-[11px] font-bold uppercase tracking-wide text-texto/50 sm:w-24 sm:shrink-0">
                    {grupo.etiqueta}
                  </span>
                )}
                <div className="flex flex-wrap gap-2" role="group" aria-label={grupo.etiqueta ?? "Grado"}>
                  {grupo.grados.map((g) => {
                    const activo = g.id === grado;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setGrado(g.id)}
                        disabled={bloqueadoPorPdf && !activo}
                        aria-pressed={activo}
                        title={`${g.nombre} · ${g.edad}`}
                        className={`boton-3d min-h-[48px] min-w-[56px] rounded-2xl border-2 text-base disabled:cursor-not-allowed disabled:opacity-40 px-2.5 text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primario ${
                          activo
                            ? "border-primario bg-primario-suave text-primario"
                            : "border-borde bg-superficie-2 text-texto/80 hover:border-borde-fuerte"
                        }`}
                      >
                        {g.corto}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {nivel && !gradoInfo && (
            <p className="mt-3 text-xs font-semibold text-texto/55">Elige tu grado o curso.</p>
          )}
          {gradoInfo && etapa && (
            <p className="mt-3 text-xs font-semibold text-texto/60">
              {gradoInfo.nombre} · {etapa.nombre} · {gradoInfo.edad}
            </p>
          )}
          {bloqueadoPorPdf && <AvisoBloqueo />}
          {etapa?.lecturaAutomatica && (
            <p className="mt-2 flex items-start gap-2 rounded-lg bg-primario-suave px-3 py-2 text-xs font-semibold text-primario">
              <Ear className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              En este nivel el tutor lee en voz alta cada pregunta y sus opciones. Se recomienda el acompañamiento de un
              adulto.
            </p>
          )}
        </Panel>

        {/* 2. Asignatura (aparece al elegir el grado) */}
        {grado && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Panel paso={2} emoji="📚" titulo={nivel === "inicial" ? "¿Qué quieres explorar?" : "¿Qué materia quieres practicar?"}>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,140px),1fr))] gap-2 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] sm:gap-3" role="group" aria-label="Asignatura">
                {areas.map((a) => {
                  const activa = a.id === area;
                  return (
                    <motion.button
                      key={a.id}
                      type="button"
                      layout
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setArea(a.id)}
                      disabled={bloqueadoPorPdf && !activa}
                      aria-pressed={activa}
                      className={`boton-3d flex min-h-[64px] rounded-2xl disabled:cursor-not-allowed disabled:opacity-40 min-w-0 items-center gap-2 border-2 p-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primario sm:flex-col sm:items-start sm:gap-2 sm:p-4 ${
                        activa
                          ? "border-[var(--acento)] bg-superficie shadow-[0_0_0_1px_var(--acento),0_10px_24px_-14px_var(--acento)]"
                          : "border-borde bg-superficie-2 hover:border-borde-fuerte"
                      }`}
                      // El color va en una variable y las clases deciden si se pinta: framer-motion
                      // no limpia un borderColor en línea al quitarlo, y el borde anterior quedaba pintado.
                      style={{ "--acento": a.acento } as CSSProperties}
                    >
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:h-11 sm:w-11 sm:rounded-xl"
                        style={{ backgroundColor: `${a.acento}22`, color: a.acento }}
                      >
                        <AreaIcon area={a.id} className="h-[18px] w-[18px] sm:h-6 sm:w-6" />
                      </span>
                      <span className="min-w-0">
                        <span className="block hyphens-auto break-words text-[13px] font-bold leading-tight sm:text-base">{a.nombre}</span>
                        <span className="mt-0.5 hidden text-xs font-medium text-texto/55 sm:block">{a.descripcion}</span>
                      </span>
                    </motion.button>
                  );
                })}
              </div>
              {!area && <p className="mt-3 text-center text-xs font-semibold text-texto/55">Elige la asignatura de la lección.</p>}
              {bloqueadoPorPdf && <AvisoBloqueo />}
            </Panel>
          </motion.div>
        )}

        {/* 3 y 4. Tema y cantidad (aparecen al elegir la asignatura) */}
        {nivel && grado && area && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 sm:space-y-4">
            <div className="grid gap-3 sm:gap-4 xl:grid-cols-[1.6fr_1fr]">
              {/* 3. Tema */}
              <Panel paso={3} emoji="💡" titulo="¿Sobre qué tema?">
                {pdfHabilitado && (
                  <div className="mb-3 grid grid-cols-2 gap-1.5 rounded-xl bg-superficie-2 p-1.5" role="tablist" aria-label="Origen del tema">
                    {(
                      [
                        { id: "manual", etiqueta: "Escribir tema", corto: "Escribir tema", Icono: PenLine },
                        { id: "pdf", etiqueta: "Desde planificación (PDF)", corto: "Planificación PDF", Icono: FileText },
                      ] as const
                    ).map(({ id, etiqueta, corto, Icono }) => {
                      const activo = modoTema === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          role="tab"
                          aria-selected={activo}
                          onClick={() => {
                            setModoTema(id);
                            setError(null);
                            setTema(id === "pdf" ? (analisis?.temas[0]?.titulo ?? "") : "");
                          }}
                          className={`flex min-h-[44px] min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-center text-xs font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primario sm:text-sm ${
                            activo ? "bg-primario text-white shadow" : "text-texto/70 hover:bg-superficie-3"
                          }`}
                        >
                          <Icono className="h-4 w-4 shrink-0" aria-hidden />
                          <span className="min-w-0 break-words">
                            <span className="sm:hidden">{corto}</span>
                            <span className="hidden sm:inline">{etiqueta}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
    
                {usarPlanificacion && pdfNoCoincide && areaPdf && (
                  <div
                    role="alert"
                    className="mb-3 rounded-lg border border-dorado/60 bg-dorado/10 px-3 py-3 text-sm font-semibold text-[#8A5A00] dark:text-dorado"
                  >
                    <p className="flex items-start gap-2">
                      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                      <span>
                        Esta planificación es de <strong>{nombreArea(areaPdf)}</strong>, pero elegiste{" "}
                        <strong>{nombreArea(area)}</strong>. Las preguntas deben ser de la misma asignatura.
                      </span>
                    </p>
                    {areaPdfDisponible ? (
                      <button
                        type="button"
                        onClick={() => {
                          setArea(areaPdf);
                          setError(null);
                        }}
                        className="mt-2 inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-primario px-3 py-2 text-sm font-bold text-white transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-primario/50"
                      >
                        Cambiar a {nombreArea(areaPdf)}
                      </button>
                    ) : (
                      <p className="mt-1.5 text-xs font-medium">
                        {nombreArea(areaPdf)} no está disponible en este grado. Quita el PDF y revisa el nivel y el grado, o
                        sube la planificación correcta.
                      </p>
                    )}
                  </div>
                )}

                {usarPlanificacion ? (
                  <PlanificacionPdf
                    nivel={nivel}
                    grado={grado}
                    area={area}
                    analisis={analisis}
                    onAnalisis={(a) => {
                      setAnalisis(a);
                      if (!a) setTema("");
                      setError(null);
                    }}
                    temaSeleccionado={tema}
                    onSeleccionarTema={(t) => {
                      setTema(t);
                      setError(null);
                    }}
                  />
                ) : (
                  <>
                    <label htmlFor="tema" className="sr-only">
                      Tema específico
                    </label>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-texto/40" aria-hidden />
                      <input
                        id="tema"
                        type="text"
                        value={tema}
                        onChange={(e) => {
                          setTema(e.target.value);
                          if (error) setError(null);
                        }}
                        maxLength={TEMA_MAX}
                        placeholder={`Ej. ${sugerencias[0] ?? "Escribe un tema"}`}
                        autoComplete="off"
                        enterKeyHint="go"
                        className="w-full rounded-lg border-2 border-borde bg-superficie-2 py-3.5 pl-11 pr-14 text-base font-semibold placeholder:text-texto/40 focus:border-primario focus:outline-none"
                        aria-invalid={Boolean(error)}
                        aria-describedby="tema-ayuda"
                      />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-texto/40">
                        {tema.length}/{TEMA_MAX}
                      </span>
                    </div>
                    <div id="tema-ayuda" className="mt-3">
                      <span className="mb-2 block text-xs font-bold text-texto/55">Temas sugeridos:</span>
                      <div className="flex flex-wrap gap-2">
                        <AnimatePresence mode="popLayout" initial={false}>
                          {sugerencias.map((s) => (
                            <motion.button
                              key={`${area}-${grado}-${s}`}
                              type="button"
                              layout
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.9 }}
                              onClick={() => {
                                setTema(s);
                                setError(null);
                              }}
                              className={`min-h-[36px] rounded-full border px-3 py-1.5 text-xs font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primario ${
                                temaLimpio === s
                                  ? "border-primario bg-primario-suave text-primario"
                                  : "border-borde bg-superficie-2 text-texto/75 hover:border-borde-fuerte hover:text-texto"
                              }`}
                            >
                              {s}
                            </motion.button>
                          ))}
                        </AnimatePresence>
                      </div>
                    </div>
                  </>
                )}
              </Panel>
    
              {/* 4. Cantidad */}
              <Panel paso={4} emoji="🎯" titulo="¿Cuántas preguntas?">
                <div className="flex gap-2 sm:gap-3" role="group" aria-label="Cantidad de preguntas">
                  {CANTIDADES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCantidad(c)}
                      aria-pressed={cantidad === c}
                      className={`boton-3d flex h-24 flex-1 flex-col items-center justify-center rounded-2xl border-2 font-extrabold focus:outline-none focus-visible:ring-2 focus-visible:ring-primario sm:h-28 ${
                        cantidad === c
                          ? "border-primario bg-primario text-white"
                          : "border-borde bg-superficie-2 text-texto/80 hover:border-borde-fuerte"
                      }`}
                    >
                      <span className="text-sm leading-none" aria-hidden>
                        {c === 5 ? "⭐" : "⭐⭐"}
                      </span>
                      <span className="mt-1 text-3xl leading-none sm:text-4xl">{c}</span>
                      <span className="mt-1 text-xs font-bold opacity-85">{c === 5 ? "Rapidito" : "Gran reto"}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-center text-xs font-medium text-texto/55">
                  {cantidad ? `⏱️ Unos ${cantidad === 5 ? "5 a 8" : "10 a 15"} minutos` : "Elige cuántas preguntas quieres responder."}
                </p>
              </Panel>
            </div>
    
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-error-borde bg-error/10 px-4 py-3 text-sm font-semibold text-error-texto"
                >
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  {error}
              </motion.div>
        )}
        </AnimatePresence>

        <motion.button
          type="submit"
          disabled={cargando}
          whileTap={{ scale: 0.985 }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#22A45D] px-4 py-5 text-lg font-black text-white shadow-[0_6px_0_#167a43] transition hover:brightness-105 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#22A45D]/40 active:translate-y-1 active:shadow-[0_2px_0_#167a43] disabled:opacity-60 sm:gap-3 sm:text-2xl"
        >
          <Play className="h-6 w-6 shrink-0 fill-current" aria-hidden />
          ¡Comenzar mi lección! 🚀
          <ArrowRight className="hidden h-5 w-5 shrink-0 sm:block" aria-hidden />
        </motion.button>
        </motion.div>
        )}
      </form>

      {/* Progreso */}
      {hidratado && historialValido.length > 0 && (
        <section className="mt-8 sm:mt-10" aria-labelledby="progreso-titulo">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="progreso-titulo" className="text-lg font-extrabold sm:text-xl">
              Tu progreso
            </h2>
            <button
              type="button"
              onClick={() => {
                if (window.confirm("¿Borrar todo tu historial y analítica?")) borrarHistorial();
              }}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-texto/55 transition hover:bg-error/10 hover:text-error"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden /> Borrar historial
            </button>
          </div>

          {statsAreas.length > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
              {statsAreas.map((a) => (
                <div key={a.id} className="rounded-xl bg-superficie p-2.5 shadow-[0_2px_12px_var(--c-sombra)] sm:p-3">
                  <div className="overflow-hidden rounded-lg border border-lila-borde">
                    <div className="flex items-center justify-center gap-1.5 border-b border-lila-borde bg-lila px-2 py-2">
                      <AreaIcon area={a.id} className="h-4 w-4 shrink-0" style={{ color: a.acento }} />
                      <span className="truncate text-xs font-bold">{a.nombre}</span>
                    </div>
                    <div className="flex flex-col items-center px-2 py-3">
                      <Trophy className="h-6 w-6 text-dorado" aria-hidden />
                      <p className="mt-1 text-xl font-extrabold text-primario sm:text-2xl">
                        {a.dominio === null ? "—" : `${a.dominio}%`}
                      </p>
                      <p className="text-center text-[11px] font-semibold text-texto/55">
                        {a.st.sesiones} {a.st.sesiones === 1 ? "lección" : "lecciones"} · {a.st.aciertos}/
                        {a.st.preguntasRespondidas}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <h3 className="mb-2 mt-5 text-sm font-bold uppercase tracking-wide text-texto/60">Lecciones recientes</h3>
          <ul className="divide-y divide-borde overflow-hidden rounded-xl bg-superficie shadow-[0_2px_12px_var(--c-sombra)]">
            {historialValido.slice(0, 6).map((h) => {
              const info = buscarArea(h.config.area);
              return (
                <li key={`${h.id}-${h.fecha}`} className="flex items-center justify-between gap-3 px-3 py-3 sm:px-4">
                  <div className="min-w-0">
                    <p className="truncate font-bold">
                      {h.config.tema}
                      {h.modo === "repaso" && (
                        <span className="ml-2 rounded-full bg-primario-suave px-2 py-0.5 text-[10px] font-bold text-primario">
                          REPASO
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs font-medium text-texto/55">
                      {info?.nombre} · {obtenerGrado(h.config.grado).nombre} · {formatearFecha(h.fecha)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-sm font-extrabold ${
                      h.porcentaje >= 70
                        ? "bg-exito/15 text-exito-texto"
                        : h.porcentaje >= 40
                          ? "bg-dorado/15 text-[#9A6B00] dark:text-dorado"
                          : "bg-error/15 text-error-texto"
                    }`}
                  >
                    {h.aciertos}/{h.total}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
