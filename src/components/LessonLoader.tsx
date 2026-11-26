"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import TutorAvatar from "@/components/tutor/TutorAvatar";
import { useTutorVoice } from "@/hooks/useTutorVoice";
import { useQuizStore } from "@/store/useQuizStore";

const MENSAJES = [
  "Preparando tu lección personalizada...",
  "Diseñando preguntas a tu nivel...",
  "Buscando los errores más comunes para enseñarte mejor...",
  "Escribiendo explicaciones claras...",
  "¡Casi listo!",
];

/** Lo que dice la tutora mientras se genera la lección: saludo e instrucciones. */
function guionDeCarga(tema?: string): string[] {
  return [
    tema
      ? `¡Hola! Estoy preparando tu lección sobre ${tema}. Dame unos segundos.`
      : "¡Hola! Estoy preparando tu lección. Dame unos segundos.",
    "Mientras tanto, te cuento cómo funciona. Lee cada pregunta con calma y elige una de las cuatro opciones.",
    "Si aciertas, te felicitaré. Si te equivocas, no pasa nada: te explicaré por qué y aprenderás algo nuevo.",
    "Si usas teclado, también puedes responder con las letras A, B, C y D.",
    "Al final verás tu resultado y podrás repasar las preguntas que fallaste.",
    "¡Ya casi está lista! Prepárate.",
  ];
}

interface LessonLoaderProps {
  visible: boolean;
  tema?: string;
}

export default function LessonLoader({ visible, tema }: LessonLoaderProps) {
  const [indice, setIndice] = useState(0);
  const [paso, setPaso] = useState(-1);
  const sonidoActivado = useQuizStore((s) => s.sonidoActivado);
  const { speak, stop, isSpeaking, words, currentWordIndex, subtitleVisible } = useTutorVoice({
    enabled: sonidoActivado,
    holdMs: 700,
  });
  const guion = useMemo(() => guionDeCarga(tema), [tema]);

  // Mensajes de estado que rotan bajo la tutora.
  useEffect(() => {
    if (!visible) {
      setIndice(0);
      return;
    }
    const id = window.setInterval(() => {
      setIndice((i) => Math.min(i + 1, MENSAJES.length - 1));
    }, 2800);
    return () => window.clearInterval(id);
  }, [visible]);

  // Empieza a hablar al abrirse y se calla al cerrarse.
  useEffect(() => {
    if (visible) {
      setPaso(0);
    } else {
      setPaso(-1);
      stop();
    }
  }, [visible, stop]);

  useEffect(() => {
    const frase = guion[paso];
    if (visible && frase) speak(frase);
  }, [paso, visible, guion, speak]);

  // Al terminar una frase (el subtítulo se oculta), pasa a la siguiente tras una pausa.
  useEffect(() => {
    if (!visible || paso < 0 || subtitleVisible || paso >= guion.length - 1) return;
    const id = window.setTimeout(() => setPaso((p) => p + 1), 600);
    return () => window.clearTimeout(id);
  }, [visible, paso, subtitleVisible, guion.length]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-fondo/95 px-6 backdrop-blur-sm"
          role="alertdialog"
          aria-busy="true"
          aria-label="Generando lección"
        >
          <div className="relative">
            <motion.div
              className="absolute inset-0 rounded-full bg-primario/25 blur-2xl"
              animate={{ scale: [1, 1.2, 1], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <TutorAvatar isSpeaking={isSpeaking} wordIndex={currentWordIndex} size={180} className="relative" />
          </div>

          {tema && (
            <p className="mt-6 text-center text-sm font-bold uppercase tracking-[0.18em] text-primario">{tema}</p>
          )}

          {/* Subtítulos de lo que dice la tutora */}
          <div className="mt-4 flex min-h-[4.5rem] max-w-xl items-center justify-center" aria-live="polite">
            <AnimatePresence mode="wait">
              {subtitleVisible && words.length > 0 && (
                <motion.p
                  key={words.map((w) => w.text).join(" ")}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="rounded-xl bg-superficie px-4 py-3 text-center text-base font-semibold leading-relaxed shadow-[0_2px_12px_var(--c-sombra)] sm:text-lg"
                >
                  {words.map((w, i) => (
                    <span
                      key={`${w.start}-${w.text}`}
                      className={`transition-colors duration-150 ${i <= currentWordIndex ? "text-texto" : "text-texto/35"}`}
                    >
                      {w.text}{" "}
                    </span>
                  ))}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <div className="mt-2 h-6 text-center">
            <AnimatePresence mode="wait">
              <motion.p
                key={indice}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="text-sm font-bold text-texto/60"
              >
                {MENSAJES[indice]}
              </motion.p>
            </AnimatePresence>
          </div>

          <div className="mt-5 flex gap-2" aria-hidden>
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="h-3 w-3 rounded-full bg-primario"
                animate={{ y: [0, -10, 0], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
              />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
