"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CircleCheck, CircleX, ThumbsDown, ThumbsUp, Volume2 } from "lucide-react";
import MathText from "@/components/MathText";
import type { Calificacion, Letra, Opcion, Pregunta, RespuestaUsuario } from "@/types/quiz";

interface QuestionCardProps {
  pregunta: Pregunta;
  numero: number;
  total: number;
  respuesta: RespuestaUsuario | undefined;
  calificacion: Calificacion | undefined;
  onResponder: (letra: Letra) => void;
  onCalificar: (valor: Calificacion) => void;
  /** Lee en voz alta la pregunta y sus opciones. */
  onEscuchar?: () => void;
}

type EstadoOpcion = "neutral" | "incorrecta" | "correcta" | "atenuada";

function estadoDeOpcion(opcion: Opcion, pregunta: Pregunta, respuesta: RespuestaUsuario | undefined): EstadoOpcion {
  if (!respuesta) return "neutral";
  if (opcion.letra === pregunta.letraCorrecta) return "correcta";
  if (opcion.letra === respuesta.letraElegida) return "incorrecta";
  return "atenuada";
}

const estilosOpcion: Record<EstadoOpcion, string> = {
  neutral:
    "bg-superficie-2 border-borde text-texto hover:border-borde-fuerte hover:bg-superficie-3 active:scale-[0.99] cursor-pointer",
  incorrecta: "bg-error border-error-borde text-white",
  correcta:
    "bg-superficie-2 border-exito text-texto shadow-[0_0_0_1px_#2ECC71,0_0_22px_-4px_rgba(46,204,113,0.65)]",
  atenuada: "bg-superficie-2 border-borde text-texto opacity-55",
};

const estilosCirculo: Record<EstadoOpcion, string> = {
  neutral: "bg-circulo text-circulo-texto",
  incorrecta: "bg-white/25 text-white",
  correcta: "bg-exito text-[#0E2A1B] shadow-[0_0_14px_rgba(46,204,113,0.8)]",
  atenuada: "bg-circulo text-circulo-texto/70",
};

export default function QuestionCard({
  pregunta,
  numero,
  total,
  respuesta,
  calificacion,
  onResponder,
  onCalificar,
  onEscuchar,
}: QuestionCardProps) {
  const respondida = Boolean(respuesta);
  const acerto = respuesta?.esCorrecta ?? false;
  const opcionCorrecta = pregunta.opciones.find((o) => o.letra === pregunta.letraCorrecta);

  return (
    <motion.article
      key={pregunta.id}
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="overflow-hidden rounded-3xl bg-superficie shadow-[0_4px_20px_var(--c-sombra)]"
      aria-labelledby={`enunciado-${pregunta.id}`}
    >
      {/* Banner explicativo superior */}
      <AnimatePresence initial={false}>
        {respondida && (
          <motion.div
            key="banner"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div
              role="alert"
              className={`flex items-start gap-3 px-5 py-4 text-sm font-semibold leading-relaxed text-white sm:px-7 sm:text-base ${
                acerto ? "bg-[#1F9D57]" : "bg-[#D94336]"
              }`}
            >
              {acerto ? (
                <CircleCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              ) : (
                <CircleX className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              )}
              <div>
                <span className="mb-0.5 block text-xs font-extrabold uppercase tracking-wider text-white/80">
                  {acerto ? "¡Correcto!" : "Incorrecto"}
                </span>
                <MathText text={pregunta.bannerExplicacion} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="px-4 pb-4 pt-5 sm:px-7 sm:pb-6 sm:pt-7">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-bold uppercase tracking-[0.16em] text-texto/50">
            Pregunta {numero} de {total}
          </span>
          {onEscuchar && (
            <button
              type="button"
              onClick={onEscuchar}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-primario-suave px-3 py-1.5 text-xs font-bold text-primario transition hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primario"
              aria-label="Escuchar la pregunta y sus opciones"
            >
              <Volume2 className="h-4 w-4" aria-hidden /> Escuchar
            </button>
          )}
        </div>
        <h2
          id={`enunciado-${pregunta.id}`}
          className="mt-2 text-lg font-bold leading-snug sm:text-xl"
        >
          <MathText text={pregunta.enunciado} />
        </h2>

        <ul className="mt-5 grid grid-cols-1 gap-3 xl:grid-cols-2" role="list">
          {pregunta.opciones.map((opcion, i) => {
            const estado = estadoDeOpcion(opcion, pregunta, respuesta);
            const esElegida = respuesta?.letraElegida === opcion.letra;
            const mostrarFeedback = respondida && (esElegida || estado === "correcta");
            return (
              <motion.li
                key={opcion.letra}
                initial={{ opacity: 0, y: 8 }}
                animate={
                  estado === "incorrecta"
                    ? { opacity: 1, y: 0, x: [0, -7, 7, -5, 5, 0] }
                    : estado === "correcta" && esElegida
                      ? { opacity: 1, y: 0, scale: [1, 1.025, 1] }
                      : { opacity: 1, y: 0 }
                }
                transition={{ delay: respondida ? 0 : i * 0.05, duration: estado === "neutral" ? 0.2 : 0.4 }}
              >
                <button
                  type="button"
                  onClick={() => onResponder(opcion.letra)}
                  disabled={respondida}
                  aria-pressed={esElegida}
                  aria-label={`Opción ${opcion.letra}: ${opcion.texto}${
                    estado === "correcta" ? " (respuesta correcta)" : estado === "incorrecta" ? " (incorrecta)" : ""
                  }`}
                  className={`group flex w-full items-start gap-3.5 rounded-2xl border-2 px-3.5 py-3.5 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primario disabled:cursor-default sm:px-4 ${estilosOpcion[estado]}`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold transition-all duration-200 ${estilosCirculo[estado]}`}
                    aria-hidden
                  >
                    {opcion.letra}
                  </span>
                  <span className="min-w-0 flex-1 break-words pt-1.5 text-[15px] font-semibold leading-snug sm:text-base">
                    <MathText text={opcion.texto} />
                    <AnimatePresence initial={false}>
                      {mostrarFeedback && (
                        <motion.span
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className={`mt-2 block overflow-hidden text-[13px] font-medium leading-relaxed sm:text-sm ${
                            estado === "incorrecta" ? "text-white/90" : "text-exito-texto"
                          }`}
                        >
                          <MathText text={opcion.feedbackEspecifico} />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </span>
                  {estado === "correcta" && (
                    <CircleCheck className="mt-1.5 h-5 w-5 shrink-0 text-exito" aria-hidden />
                  )}
                  {estado === "incorrecta" && <CircleX className="mt-1.5 h-5 w-5 shrink-0 text-white" aria-hidden />}
                </button>
              </motion.li>
            );
          })}
        </ul>

        {/* Footer de tarjeta: calificación */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-borde pt-4">
          <span className="text-xs font-semibold text-texto/55">
            {respondida
              ? acerto
                ? "¡Bien hecho! ¿Te resultó útil esta pregunta?"
                : `Respuesta correcta: ${opcionCorrecta?.letra ?? ""}. ¿Te resultó útil esta pregunta?`
              : "Elige una opción (teclas A–D o 1–4)"}
          </span>
          <div className="flex items-center gap-2" role="group" aria-label="Calificar pregunta">
            <button
              type="button"
              onClick={() => onCalificar("up")}
              aria-pressed={calificacion === "up"}
              aria-label="Me gusta esta pregunta"
              className={`flex h-9 w-9 items-center justify-center rounded-full border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primario ${
                calificacion === "up"
                  ? "border-exito bg-exito/20 text-exito-texto"
                  : "border-borde bg-superficie-2 text-texto/60 hover:text-texto"
              }`}
            >
              <ThumbsUp className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onCalificar("down")}
              aria-pressed={calificacion === "down"}
              aria-label="No me gusta esta pregunta"
              className={`flex h-9 w-9 items-center justify-center rounded-full border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primario ${
                calificacion === "down"
                  ? "border-error-borde bg-error/20 text-error-texto"
                  : "border-borde bg-superficie-2 text-texto/60 hover:text-texto"
              }`}
            >
              <ThumbsDown className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </motion.article>
  );
}
