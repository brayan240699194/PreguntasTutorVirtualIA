"use client";

import { motion, useReducedMotion } from "framer-motion";
import { memo, useEffect, useId } from "react";
import { iniciarMonitorIA, useEstadoIA, type EstadoIA } from "@/store/useEstadoIA";

interface TutorAvatarProps {
  isSpeaking: boolean;
  /** Índice de la palabra actual; varía la apertura de la boca por palabra. */
  wordIndex?: number;
  size?: number;
  className?: string;
}

/** Color de la credencial según la conexión con la IA. */
const CREDENCIAL: Record<EstadoIA, { fondo: string; franja: string; titulo: string }> = {
  conectada: { fondo: "#22C55E", franja: "#FFFFFF", titulo: "Conectado a la IA" },
  "sin-ia": { fondo: "#F59E0B", franja: "#FFFFFF", titulo: "Sin conexión con la IA" },
  verificando: { fondo: "#FFFFFF", franja: "#0866E0", titulo: "Verificando conexión con la IA" },
};

const ORIGEN_CENTRO = { transformBox: "fill-box", transformOrigin: "center" } as const;
const ORIGEN_BASE = { transformBox: "fill-box", transformOrigin: "50% 100%" } as const;

/** Patrones de apertura de boca: se alternan por palabra para un lip-sync más orgánico. */
const PATRONES_BOCA: readonly number[][] = [
  [1.5, 6, 3, 7, 2, 5.5, 1.5],
  [2, 7, 4, 5.5, 1.5, 6.5, 2],
  [1.5, 5, 7, 3, 6.5, 2.5, 1.5],
  [3, 6.5, 2.5, 7, 4, 5, 2],
];

/**
 * Personaje docente: profesor/a con gafas, cabello recogido, blazer azul
 * institucional y libro bajo el brazo. Parpadea, respira, mueve las cejas
 * y sincroniza la boca mientras habla.
 */
function TutorAvatarBase({ isSpeaking, wordIndex = 0, size = 160, className }: TutorAvatarProps) {
  const reducir = useReducedMotion();
  const uid = useId().replace(/:/g, "");
  const estadoIA = useEstadoIA((s) => s.estado);
  const credencial = CREDENCIAL[estadoIA];
  useEffect(() => iniciarMonitorIA(), []);
  const patron = PATRONES_BOCA[Math.abs(wordIndex) % PATRONES_BOCA.length] ?? [1.5, 6, 1.5];

  const idPiel = `piel-${uid}`;
  const idBlazer = `blazer-${uid}`;
  const idCabello = `cabello-${uid}`;
  const idLente = `lente-${uid}`;

  return (
    <motion.div
      className={className}
      style={{ width: size, height: size }}
      animate={reducir ? undefined : { y: [0, -4, 0] }}
      transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
      aria-label={`${isSpeaking ? "Docente virtual hablando" : "Docente virtual escuchando"}. ${credencial.titulo}.`}
      title={credencial.titulo}
      role="img"
    >
      <svg viewBox="0 0 200 200" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={idPiel} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F8D7B9" />
            <stop offset="100%" stopColor="#EDB98F" />
          </linearGradient>
          <linearGradient id={idBlazer} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1F7BF0" />
            <stop offset="100%" stopColor="#0752B8" />
          </linearGradient>
          <linearGradient id={idCabello} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#4A3426" />
            <stop offset="100%" stopColor="#2E1F17" />
          </linearGradient>
          <radialGradient id={idLente} cx="35%" cy="30%" r="80%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#CFE4FF" stopOpacity="0.08" />
          </radialGradient>
        </defs>

        {/* Ondas de sonido */}
        {isSpeaking &&
          [0, 1, 2].map((i) => (
            <g key={i}>
              <motion.path
                d={`M${34 - i * 10} ${78 - i * 6} Q ${22 - i * 10} 100 ${34 - i * 10} ${122 + i * 6}`}
                stroke="#5DB8FF"
                strokeWidth={3}
                strokeLinecap="round"
                fill="none"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.9, 0] }}
                transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.22 }}
              />
              <motion.path
                d={`M${166 + i * 10} ${78 - i * 6} Q ${178 + i * 10} 100 ${166 + i * 10} ${122 + i * 6}`}
                stroke="#5DB8FF"
                strokeWidth={3}
                strokeLinecap="round"
                fill="none"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.9, 0] }}
                transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.22 }}
              />
            </g>
          ))}

        {/* Moño del cabello (detrás de la cabeza) */}
        <circle cx={100} cy={34} r={17} fill={`url(#${idCabello})`} />
        <path d="M86 40 Q 100 48 114 40" stroke="#5C4232" strokeWidth={3} fill="none" strokeLinecap="round" />

        {/* Torso con respiración */}
        <motion.g
          style={ORIGEN_BASE}
          animate={reducir ? undefined : { scaleY: [1, 1.022, 1], scaleX: [1, 0.992, 1] }}
          transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* Cuello */}
          <path d="M88 136 L 88 154 Q 100 162 112 154 L 112 136 Z" fill="#E3AA80" />
          {/* Blazer */}
          <path d="M40 200 C 40 170, 60 152, 88 150 L 100 172 L 112 150 C 140 152, 160 170, 160 200 Z" fill={`url(#${idBlazer})`} />
          {/* Blusa / camisa */}
          <path d="M88 150 L 100 172 L 112 150 L 106 148 L 100 158 L 94 148 Z" fill="#FFFFFF" />
          {/* Solapas */}
          <path d="M88 150 L 78 166 L 92 172 L 100 186 Z" fill="#0A5BCB" />
          <path d="M112 150 L 122 166 L 108 172 L 100 186 Z" fill="#0A5BCB" />
          {/* Botón */}
          <circle cx={100} cy={192} r={2.6} fill="#E8F1FF" />
          {/* Credencial / gafete: verde = con IA, naranja = sin IA (banco local) */}
          <g data-estado-ia={estadoIA}>
            <rect x={117} y={172} width={21} height={15} rx={2.8} fill={credencial.fondo} stroke="#FFFFFF" strokeWidth={1.2} style={{ transition: "fill 0.4s ease" }} />
            <rect x={120} y={175.5} width={8} height={2.4} rx={1} fill={credencial.franja} />
            <rect x={120} y={180.5} width={14} height={2} rx={1} fill={credencial.franja} opacity={0.75} />
          </g>
          {/* Libro bajo el brazo */}
          <g transform="rotate(-12 58 184)">
            <rect x={42} y={172} width={34} height={24} rx={2.5} fill="#F5B400" />
            <rect x={42} y={172} width={5} height={24} rx={1.5} fill="#D99A00" />
            <rect x={52} y={178} width={18} height={2.4} rx={1} fill="#FFF3C4" />
            <rect x={52} y={183} width={13} height={2.4} rx={1} fill="#FFF3C4" />
          </g>
        </motion.g>

        {/* Orejas */}
        <ellipse cx={58} cy={100} rx={7} ry={10} fill="#EDB98F" />
        <ellipse cx={142} cy={100} rx={7} ry={10} fill="#EDB98F" />
        {/* Aretes */}
        <circle cx={58} cy={112} r={2.6} fill="#F5B400" />
        <circle cx={142} cy={112} r={2.6} fill="#F5B400" />

        {/* Cabeza */}
        <ellipse cx={100} cy={98} rx={42} ry={46} fill={`url(#${idPiel})`} />

        {/* Cabello: frente con raya al costado */}
        <path
          d="M57 98 C 52 62, 74 44, 102 44 C 130 44, 150 62, 143 98 C 139 82, 132 72, 120 66 C 108 74, 88 78, 70 76 C 63 82, 59 90, 57 98 Z"
          fill={`url(#${idCabello})`}
        />
        <path d="M118 52 C 112 60, 104 66, 92 70" stroke="#6B4B37" strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.6} />

        {/* Mejillas */}
        <ellipse cx={74} cy={116} rx={8} ry={5} fill="#FF8E8E" opacity={0.35} />
        <ellipse cx={126} cy={116} rx={8} ry={5} fill="#FF8E8E" opacity={0.35} />

        {/* Cejas: se levantan levemente al hablar */}
        <motion.g
          animate={isSpeaking && !reducir ? { y: [0, -2.5, 0, -1.5, 0] } : { y: 0 }}
          transition={{ duration: 1.4, repeat: isSpeaking ? Infinity : 0, ease: "easeInOut" }}
        >
          <path d="M70 83 Q 79 78 88 82" stroke="#3A281D" strokeWidth={3.4} fill="none" strokeLinecap="round" />
          <path d="M112 82 Q 121 78 130 83" stroke="#3A281D" strokeWidth={3.4} fill="none" strokeLinecap="round" />
        </motion.g>

        {/* Ojos con parpadeo */}
        <motion.g
          style={ORIGEN_CENTRO}
          animate={reducir ? undefined : { scaleY: [1, 1, 0.08, 1, 1, 0.08, 1] }}
          transition={{ duration: 5.4, repeat: Infinity, times: [0, 0.6, 0.63, 0.66, 0.9, 0.93, 1], ease: "easeInOut" }}
        >
          <ellipse cx={80} cy={97} rx={5.2} ry={6} fill="#2B1E16" />
          <ellipse cx={120} cy={97} rx={5.2} ry={6} fill="#2B1E16" />
          <circle cx={81.8} cy={94.8} r={1.8} fill="#FFFFFF" />
          <circle cx={121.8} cy={94.8} r={1.8} fill="#FFFFFF" />
        </motion.g>

        {/* Gafas rectangulares redondeadas */}
        <g>
          <rect x={64} y={86} width={32} height={23} rx={8} fill={`url(#${idLente})`} stroke="#1E2A44" strokeWidth={3.2} />
          <rect x={104} y={86} width={32} height={23} rx={8} fill={`url(#${idLente})`} stroke="#1E2A44" strokeWidth={3.2} />
          <path d="M96 95 Q 100 91.5 104 95" stroke="#1E2A44" strokeWidth={3.2} fill="none" strokeLinecap="round" />
          <path d="M64 93 L 57 90" stroke="#1E2A44" strokeWidth={3} strokeLinecap="round" />
          <path d="M136 93 L 143 90" stroke="#1E2A44" strokeWidth={3} strokeLinecap="round" />
        </g>

        {/* Nariz */}
        <path d="M100 103 Q 97 112 101 114" stroke="#C98C63" strokeWidth={2.4} fill="none" strokeLinecap="round" />

        {/* Boca: sonrisa en reposo / lip-sync al hablar */}
        {isSpeaking ? (
          <g>
            <motion.ellipse
              key={`boca-${wordIndex}`}
              cx={100}
              cy={126}
              rx={9}
              fill="#8E2F3C"
              initial={{ ry: 1.5 }}
              animate={{ ry: patron }}
              transition={{ duration: 0.55, repeat: Infinity, ease: "easeInOut" }}
            />
            <rect x={94} y={122.2} width={12} height={2.4} rx={1.2} fill="#FFFFFF" opacity={0.9} />
            <motion.ellipse
              cx={100}
              cy={130}
              rx={4.8}
              fill="#F27A86"
              initial={{ ry: 0.4 }}
              animate={{ ry: [0.4, 2.2, 0.8, 2.4, 0.4] }}
              transition={{ duration: 0.55, repeat: Infinity, ease: "easeInOut" }}
            />
          </g>
        ) : (
          <path d="M89 123 Q 100 133 111 123" stroke="#8E2F3C" strokeWidth={3.4} fill="none" strokeLinecap="round" />
        )}
      </svg>
    </motion.div>
  );
}

const TutorAvatar = memo(TutorAvatarBase);
export default TutorAvatar;
