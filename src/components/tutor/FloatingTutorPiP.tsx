"use client";

import { AnimatePresence, motion } from "framer-motion";
import { GripHorizontal, Maximize2, Minimize2, MicOff, Square, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import TutorAvatar from "@/components/tutor/TutorAvatar";

interface FloatingTutorPiPProps {
  isSpeaking: boolean;
  wordIndex: number;
  expanded: boolean;
  soundEnabled: boolean;
  voiceSupported: boolean;
  voiceName: string | null;
  onStop: () => void;
  onToggleExpand: () => void;
}

/** true en teléfonos y tablets (< 1024 px): ahí el tutor se muestra como burbuja. */
function useEsMovil(): boolean {
  const [movil, setMovil] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const actualizar = () => setMovil(mq.matches);
    actualizar();
    mq.addEventListener("change", actualizar);
    return () => mq.removeEventListener("change", actualizar);
  }, []);
  return movil;
}

export default function FloatingTutorPiP({
  isSpeaking,
  wordIndex,
  expanded,
  soundEnabled,
  voiceSupported,
  voiceName,
  onStop,
  onToggleExpand,
}: FloatingTutorPiPProps) {
  const limitesRef = useRef<HTMLDivElement>(null);
  const esMovil = useEsMovil();

  const ancho = esMovil ? "w-64" : "w-[280px]";
  const avatar = expanded || esMovil ? 168 : 128;

  let estado = "Escuchando tu respuesta...";
  if (isSpeaking) estado = "El tutor está hablando...";
  else if (!soundEnabled) estado = "Voz silenciada";
  else if (!voiceSupported) estado = "Voz no disponible";

  // En teléfonos, la vista compacta es una burbuja que no tapa las opciones.
  if (esMovil && !expanded) {
    return (
      <>
        <div ref={limitesRef} className="pointer-events-none fixed inset-2 z-40" aria-hidden />
        <div className="pointer-events-none fixed bottom-[100px] right-3 z-40 sm:right-6">
          <motion.div
            drag
            dragConstraints={limitesRef}
            dragElastic={0.12}
            dragMomentum={false}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 22 }}
            className="pointer-events-auto relative touch-none select-none"
          >
            <AnimatePresence>
              {isSpeaking && (
                <motion.span
                  key="onda"
                  className="absolute inset-0 rounded-full border-2 border-[#5DB8FF]"
                  initial={{ scale: 1, opacity: 0.8 }}
                  animate={{ scale: 1.45, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
                />
              )}
            </AnimatePresence>
            <motion.button
              type="button"
              onTap={onToggleExpand}
              className="relative flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-full border-2 border-[#3FA9F5] bg-gradient-to-b from-[#1D6FD8] to-[#0A3A7E] shadow-[0_10px_28px_-8px_rgba(0,0,0,0.6)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label="Abrir la ventana del tutor"
            >
              <TutorAvatar isSpeaking={isSpeaking} wordIndex={wordIndex} size={66} className="translate-y-1.5" />
            </motion.button>
            <span className="absolute right-0.5 top-0.5 h-3.5 w-3.5 rounded-full bg-[#3FA9F5] ring-2 ring-white" aria-hidden />
            {isSpeaking && (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={onStop}
                className="absolute -left-1.5 -top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-[#D94336] text-white shadow-lg ring-2 ring-white focus:outline-none"
                aria-label="Detener la voz del tutor"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
              </button>
            )}
            <span className="sr-only" aria-live="polite">
              {estado}
            </span>
          </motion.div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Área de restricción del arrastre: toda la ventana */}
      <div ref={limitesRef} className="pointer-events-none fixed inset-2 z-40" aria-hidden />

      <div className="pointer-events-none fixed bottom-[100px] right-3 z-40 sm:right-6 lg:right-8">
        <motion.aside
          drag
          dragConstraints={limitesRef}
          dragElastic={0.12}
          dragMomentum={false}
          whileDrag={{ scale: 1.03, cursor: "grabbing" }}
          initial={{ opacity: 0, y: 30, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          className={`pointer-events-auto relative ${ancho} cursor-grab touch-none select-none overflow-hidden rounded-3xl border-2 border-[#3FA9F5]/70 bg-[#0A3A7E]/85 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.7),0_0_0_4px_rgba(63,169,245,0.12)] backdrop-blur-md`}
          aria-label="Ventana del tutor"
        >
          {/* Barra superior */}
          <div className="flex items-center justify-between px-3 pt-2.5">
            <GripHorizontal className="h-4 w-4 text-white/40" aria-hidden />
            <span className="relative flex h-3 w-3" title="Tutor activo">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#3FA9F5] opacity-60" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-[#3FA9F5] ring-2 ring-[#0A3A7E]" />
            </span>
          </div>

          {/* "Video" del tutor */}
          <div className="relative mx-2.5 mt-1.5 flex items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-b from-[#1D6FD8] to-[#0A3A7E]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(93,184,255,0.25),transparent_65%)]" />
            <AnimatePresence>
              {isSpeaking && (
                <motion.span
                  key="anillo"
                  className="absolute rounded-full border-2 border-[#5DB8FF]/50"
                  style={{ width: avatar * 0.9, height: avatar * 0.9 }}
                  initial={{ scale: 0.8, opacity: 0.8 }}
                  animate={{ scale: 1.35, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
                />
              )}
            </AnimatePresence>
            <TutorAvatar isSpeaking={isSpeaking} wordIndex={wordIndex} size={avatar} className="relative py-1" />
          </div>

          {/* Pill de estado */}
          <div className="mt-2 flex justify-center px-2">
            <span
              className={`inline-flex max-w-full items-center gap-1.5 truncate rounded-full px-2.5 py-1 font-semibold ${
                expanded ? "text-xs" : "text-[10px]"
              } ${isSpeaking ? "bg-[#3FA9F5] text-white" : "bg-white/10 text-white/80"}`}
              aria-live="polite"
            >
              {isSpeaking ? (
                <Volume2 className="h-3 w-3 shrink-0" aria-hidden />
              ) : (
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#2ECC71]" aria-hidden />
              )}
              <span className="truncate">{estado}</span>
            </span>
          </div>

          {expanded && voiceName && (
            <p className="mt-1 truncate px-3 text-center text-[10px] text-white/40" title={voiceName}>
              Voz: {voiceName}
            </p>
          )}

          {/* Controles */}
          <div className="flex items-center justify-center gap-3 px-3 pb-3 pt-2.5">
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onStop}
              disabled={!isSpeaking}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#D94336] text-white shadow-lg transition hover:bg-[#FF6B5E] focus:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-45"
              aria-label="Detener la voz del tutor"
              title="Detener audio"
            >
              {soundEnabled ? <MicOff className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onToggleExpand}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/12 text-white transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label={expanded ? "Minimizar ventana del tutor" : "Expandir ventana del tutor"}
              title={expanded ? "Minimizar" : "Expandir"}
            >
              {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>
        </motion.aside>
      </div>
    </>
  );
}
