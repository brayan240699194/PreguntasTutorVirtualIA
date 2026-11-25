import { useId } from "react";

/** Los tres libros azules del isotipo. `idBase` evita choques entre varios logos en la página. */
function Libros({ idBase }: { idBase: string }) {
  const cuerpo = `${idBase}-cuerpo`;
  const tapa = `${idBase}-tapa`;
  return (
    <>
      <defs>
        <linearGradient id={cuerpo} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#16357A" />
          <stop offset="0.28" stopColor="#2F63BD" />
          <stop offset="0.55" stopColor="#8FB0E4" />
          <stop offset="0.8" stopColor="#3A6CC4" />
          <stop offset="1" stopColor="#173A80" />
        </linearGradient>
        <linearGradient id={tapa} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#10295F" />
          <stop offset="0.5" stopColor="#2C5DB3" />
          <stop offset="1" stopColor="#10295F" />
        </linearGradient>
      </defs>
      {[14, 84, 154].map((x) => (
        <g key={x}>
          <rect x={x} y={12} width={60} height={222} rx={9} fill={`url(#${cuerpo})`} />
          <rect x={x} y={12} width={60} height={30} rx={9} fill={`url(#${tapa})`} />
          <rect x={x + 3} y={36} width={54} height={3} rx={1.5} fill="#A9C3EE" opacity={0.9} />
        </g>
      ))}
      {/* Curva clara del tercer libro (la «D» del isotipo). */}
      <path d="M184 92 C206 92 214 120 214 150 C214 182 204 208 184 208 Z" fill="#C9DAF5" opacity={0.55} />
    </>
  );
}

interface LogoProlipaProps {
  className?: string;
  /**
   * "auto": «PROLIPA» toma el color del texto (negro en claro, blanco en oscuro).
   * "sobre-blanco": colores originales, para fondos blancos fijos (barra, informe).
   */
  tono?: "auto" | "sobre-blanco";
}

/** Logotipo completo de Prolipa (isotipo + «PROLIPA» + «VANGUARDIA EN EDUCACIÓN»). */
export default function LogoProlipa({ className = "", tono = "auto" }: LogoProlipaProps) {
  const id = useId().replace(/:/g, "");
  const colorMarca = tono === "sobre-blanco" ? "#0B0B0B" : "currentColor";
  const colorLema = tono === "sobre-blanco" ? "#9A9A9A" : "var(--c-lema-logo, #9A9A9A)";
  return (
    <svg
      viewBox="0 0 740 250"
      className={className}
      role="img"
      aria-label="Prolipa, vanguardia en educación"
      xmlns="http://www.w3.org/2000/svg"
    >
      <Libros idBase={`logo-${id}`} />
      <text
        x={236}
        y={180}
        textLength={492}
        lengthAdjust="spacingAndGlyphs"
        fill={colorMarca}
        style={{ font: "900 118px var(--font-montserrat), Arial, sans-serif" }}
      >
        PROLIPA
      </text>
      <text
        x={238}
        y={234}
        textLength={490}
        lengthAdjust="spacingAndGlyphs"
        fill={colorLema}
        style={{ font: "700 37px var(--font-montserrat), Arial, sans-serif" }}
      >
        VANGUARDIA EN EDUCACIÓN
      </text>
    </svg>
  );
}

/** Solo el isotipo (los tres libros), para espacios reducidos. */
export function IsotipoProlipa({ className = "" }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="8 6 212 234" className={className} role="img" aria-label="Prolipa" xmlns="http://www.w3.org/2000/svg">
      <Libros idBase={`iso-${id}`} />
    </svg>
  );
}
