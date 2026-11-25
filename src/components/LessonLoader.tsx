"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import TutorAvatar from "@/components/tutor/TutorAvatar";

const MENSAJES = [
  "Preparando tu lección personalizada...",
  "Diseñando preguntas a tu nivel...",
  "Buscando los errores más comunes para enseñarte mejor...",
  "Escribiendo explicaciones claras...",
  "Afinando la voz del tutor...",
  "¡Casi listo!",
];

interface LessonLoaderProps {
  visible: boolean;
  tema?: string;
}

export default function LessonLoader({ visible, tema }: LessonLoaderProps) {
  const [indice, setIndice] = useState(0);

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
          aria-live="assertive"
          aria-label="Generando lección"
        >
          <div className="relative">
            <motion.div
              className="absolute inset-0 rounded-full bg-primario/25 blur-2xl"
              animate={{ scale: [1, 1.2, 1], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <TutorAvatar isSpeaking size={180} className="relative" />
          </div>

          {tema && (
            <p className="mt-6 text-center text-sm font-bold uppercase tracking-[0.18em] text-primario">{tema}</p>
          )}

          <div className="mt-3 h-8 text-center">
            <AnimatePresence mode="wait">
              <motion.p
                key={indice}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="text-lg font-bold"
              >
                {MENSAJES[indice]}
              </motion.p>
            </AnimatePresence>
          </div>

          <div className="mt-6 flex gap-2" aria-hidden>
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
