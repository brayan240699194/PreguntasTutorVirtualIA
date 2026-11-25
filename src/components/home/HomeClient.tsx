"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CircleAlert, Ear, FileText, Flame, PenLine, Play, Search, Trash2, Trophy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import AreaIcon from "@/components/AreaIcon";
import PlanificacionPdf from "@/components/home/PlanificacionPdf";
import LessonLoader from "@/components/LessonLoader";
import ThemeToggle from "@/components/ThemeToggle";
import TutorAvatar from "@/components/tutor/TutorAvatar";
import { BandaTitulo, BarraSuperior, MarcaApp, Panel } from "@/components/ui/AppChrome";
import { QuizApiError, solicitarLeccion } from "@/lib/api";
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

/** Grado que se preselecciona al cambiar de nivel. */
const GRADO_INICIAL: Record<NivelId, GradoId> = { inicial: "inicial-4", egb: "egb-5", bgu: "bgu-1" };

const ETIQUETA_SUBNIVEL: Partial<Record<EtapaId, string>> = {
  "egb-preparatoria": "Preparatoria",
  "egb-elemental": "Elemental",
  "egb-media": "Media",
  "egb-superior": "Superior",
};

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

  const [nivel, setNivel] = useState<NivelId>("egb");
  const [grado, setGrado] = useState<GradoId>("egb-5");
  const [area, setArea] = useState<AreaId>("ciencias-naturales");
  const [tema, setTema] = useState("");
  const [cantidad, setCantidad] = useState<CantidadPreguntas>(5);
  const [modoTema, setModoTema] = useState<"manual" | "pdf">("manual");
  const [analisis, setAnalisis] = useState<AnalizarPlanificacionResponse | null>(null);
  const usarPlanificacion = pdfHabilitado && modoTema === "pdf";
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const grados = gradosDeNivel(nivel);
  const areas = useMemo(() => areasDeGrado(grado), [grado]);
  const etapa = ETAPAS_INFO[obtenerGrado(grado).etapa];
  const sugerencias = temasSugeridos(area, grado);
  const temaLimpio = useMemo(() => sanitizarTema(tema), [tema]);
  const temaValido = temaLimpio.length >= TEMA_MIN && /\p{L}/u.test(temaLimpio);

  // Mantiene una asignatura válida cuando cambia el grado.
  useEffect(() => {
    if (!areas.some((a) => a.id === area) && areas[0]) setArea(areas[0].id);
  }, [areas, area]);

  useEffect(() => () => abortRef.current?.abort(), []);

  function elegirNivel(n: NivelId) {
    setNivel(n);
    if (obtenerGrado(grado).nivel !== n) setGrado(GRADO_INICIAL[n]);
    setError(null);
  }

  async function comenzar(e?: FormEvent) {
    e?.preventDefault();
    if (cargando) return;
    if (usarPlanificacion && !analisis) {
      setError("Sube tu planificación en PDF y pulsa «Detectar temas» antes de comenzar.");
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
      <section className="mt-3 flex items-center gap-3 rounded-xl bg-superficie p-4 shadow-[0_2px_12px_var(--c-sombra)] sm:mt-4 sm:gap-6 sm:p-6">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-extrabold leading-tight sm:text-3xl lg:text-4xl">
            Aprende con <span className="text-primario">tu tutor virtual</span>
          </h1>
          <p className="mt-1.5 text-sm font-medium text-texto/70 sm:mt-2 sm:text-base">
            Elige tu nivel, grado y asignatura según el currículo del Ministerio de Educación. El tutor te explica cada
            respuesta con voz y subtítulos, y al final puedes imprimir tu informe.
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
        <Panel titulo="1 · Nivel educativo y grado">
          <div className="grid grid-cols-1 gap-1.5 rounded-xl bg-superficie-2 p-1.5 min-[400px]:grid-cols-3" role="group" aria-label="Nivel educativo">
            {NIVELES_INFO.map((n) => {
              const activo = n.id === nivel;
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => elegirNivel(n.id)}
                  aria-pressed={activo}
                  className={`relative flex min-h-[48px] min-w-0 items-center justify-between gap-2 rounded-lg px-3 py-2 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primario min-[400px]:block min-[400px]:min-h-[56px] min-[400px]:px-2 min-[400px]:text-center sm:px-4 sm:text-left ${
                    activo ? "text-white" : "text-texto/75 hover:bg-superficie-3"
                  }`}
                >
                  {activo && (
                    <motion.span
                      layoutId="nivel-activo"
                      className="absolute inset-0 rounded-lg bg-primario shadow"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  )}
                  <span className="relative block min-w-0 break-words text-sm font-bold leading-tight">
                    <span className="lg:hidden">{n.corto}</span>
                    <span className="hidden lg:inline">{n.nombre}</span>
                  </span>
                  <span className={`relative block shrink-0 text-[11px] font-medium ${activo ? "text-white/85" : "text-texto/50"}`}>
                    {n.descripcion}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 space-y-3">
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
                        aria-pressed={activo}
                        title={`${g.nombre} · ${g.edad}`}
                        className={`min-h-[44px] min-w-[48px] rounded-lg border-2 px-2.5 text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primario ${
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

          <p className="mt-3 text-xs font-semibold text-texto/60">
            {obtenerGrado(grado).nombre} · {etapa.nombre} · {obtenerGrado(grado).edad}
          </p>
          {etapa.lecturaAutomatica && (
            <p className="mt-2 flex items-start gap-2 rounded-lg bg-primario-suave px-3 py-2 text-xs font-semibold text-primario">
              <Ear className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              En este nivel el tutor lee en voz alta cada pregunta y sus opciones. Se recomienda el acompañamiento de un
              adulto.
            </p>
          )}
        </Panel>

        {/* 2. Asignatura */}
        <Panel titulo={nivel === "inicial" ? "2 · Ámbito de desarrollo" : "2 · Asignatura"}>
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
                  aria-pressed={activa}
                  className={`flex min-h-[60px] min-w-0 items-center gap-2 rounded-xl border-2 p-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primario sm:flex-col sm:items-start sm:gap-2 sm:p-4 ${
                    activa ? "bg-superficie" : "border-borde bg-superficie-2 hover:border-borde-fuerte"
                  }`}
                  style={
                    activa
                      ? { borderColor: a.acento, boxShadow: `0 0 0 1px ${a.acento}, 0 10px 24px -14px ${a.acento}` }
                      : undefined
                  }
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
        </Panel>

        <div className="grid gap-3 sm:gap-4 xl:grid-cols-[1.6fr_1fr]">
          {/* 3. Tema */}
          <Panel titulo="3 · Tema de la lección">
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
          <Panel titulo="4 · Cantidad de preguntas">
            <div className="flex gap-2 sm:gap-3" role="group" aria-label="Cantidad de preguntas">
              {CANTIDADES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCantidad(c)}
                  aria-pressed={cantidad === c}
                  className={`flex h-16 flex-1 flex-col items-center justify-center rounded-xl border-2 font-extrabold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primario sm:h-20 ${
                    cantidad === c
                      ? "border-primario bg-primario text-white shadow-[0_8px_20px_-10px_rgba(8,102,224,0.9)]"
                      : "border-borde bg-superficie-2 text-texto/75 hover:border-borde-fuerte"
                  }`}
                >
                  <span className="text-2xl leading-none sm:text-3xl">{c}</span>
                  <span className="mt-1 text-[10px] font-bold uppercase opacity-80">preguntas</span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-center text-xs font-medium text-texto/55">
              Tiempo estimado: {cantidad === 5 ? "5–8" : cantidad === 10 ? "10–15" : "15–25"} minutos
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
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primario px-4 py-4 text-base font-bold text-white shadow-[0_12px_28px_-12px_rgba(8,102,224,0.9)] transition hover:brightness-110 focus:outline-none focus-visible:ring-4 focus-visible:ring-primario/40 disabled:opacity-60 sm:gap-3 sm:text-lg"
        >
          <Play className="h-5 w-5 shrink-0" aria-hidden />
          Comenzar Lección con Tutor
          <ArrowRight className="hidden h-5 w-5 shrink-0 sm:block" aria-hidden />
        </motion.button>
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
