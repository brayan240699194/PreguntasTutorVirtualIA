"use client";

import { AnimatePresence, motion } from "framer-motion";
import { MessageSquareText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { SubtitleWord } from "@/types/quiz";

/** Altura reservada por la barra de subtítulos (la página deja este espacio libre abajo). */
export const ALTURA_SUBTITULOS = "pb-[92px] sm:pb-[84px]";

interface LiveSubtitlesProps {
  words: SubtitleWord[];
  currentWordIndex: number;
  visible: boolean;
  speakerName?: string;
}

/** Cantidad de palabras por "página" de subtítulo según el ancho de pantalla. */
function usePalabrasPorPagina(): number {
  const [n, setN] = useState(9);
  useEffect(() => {
    const calcular = () => {
      const w = window.innerWidth;
      setN(w < 400 ? 8 : w < 640 ? 10 : w < 1024 ? 14 : 18);
    };
    calcular();
    window.addEventListener("resize", calcular);
    return () => window.removeEventListener("resize", calcular);
  }, []);
  return n;
}

/**
 * Subtítulos acoplados en una barra fija inferior. En vez de mostrar todo el
 * texto encima del contenido, se muestran por bloques cortos (como subtítulos
 * de video) que avanzan con la voz. La página reserva su altura con
 * `ALTURA_SUBTITULOS`, así que nunca tapan el contenido final.
 */
export default function LiveSubtitles({ words, currentWordIndex, visible, speakerName = "Tutor" }: LiveSubtitlesProps) {
  const porPagina = usePalabrasPorPagina();
  const textoCompleto = useMemo(() => words.map((w) => w.text).join(" "), [words]);

  const indice = Math.max(0, currentWordIndex);
  const pagina = Math.floor(indice / porPagina);
  const inicio = pagina * porPagina;
  const bloque = words.slice(inicio, inicio + porPagina);
  const totalPaginas = Math.max(1, Math.ceil(words.length / porPagina));

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 print:hidden" aria-hidden={!visible}>
      <AnimatePresence>
        {visible && words.length > 0 && (
          <motion.div
            key={textoCompleto}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
            className="border-t border-white/10 bg-[#0B1622]/92 px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-8px_24px_-10px_rgba(0,0,0,0.6)] backdrop-blur-md sm:px-6"
            role="status"
          >
            <p className="sr-only" aria-live="polite">
              {textoCompleto}
            </p>
            <div className="flex items-center gap-3" aria-hidden>
              <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primario text-white sm:flex">
                <MessageSquareText className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7CC4FF]">{speakerName}</span>
                  {totalPaginas > 1 && (
                    <span className="flex gap-1" aria-hidden>
                      {Array.from({ length: totalPaginas }, (_, i) => (
                        <span
                          key={i}
                          className={`h-1 w-3 rounded-full ${i <= pagina ? "bg-[#7CC4FF]" : "bg-white/20"}`}
                        />
                      ))}
                    </span>
                  )}
                </div>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.p
                    key={pagina}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                    className="line-clamp-2 min-h-[2.5em] text-[15px] font-semibold leading-tight text-white sm:text-base"
                  >
                    {bloque.map((w, i) => {
                      const global = inicio + i;
                      const revelada = global <= currentWordIndex;
                      const actual = global === currentWordIndex;
                      return (
                        <span
                          key={`${global}-${w.start}`}
                          className={`transition-[opacity,color] duration-150 ${revelada ? "opacity-100" : "opacity-30"} ${
                            actual ? "text-[#FFD24A]" : ""
                          }`}
                        >
                          {w.text}
                          {i < bloque.length - 1 ? " " : ""}
                        </span>
                      );
                    })}
                  </motion.p>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
