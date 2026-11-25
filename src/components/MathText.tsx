"use client";

import { Fragment, memo, useMemo, type ReactNode } from "react";
import { BlockMath, InlineMath } from "react-katex";

type Segmento = { tipo: "texto"; valor: string } | { tipo: "inline"; valor: string } | { tipo: "bloque"; valor: string };

const MARCADOR_DOLAR = "\u0000DOLAR\u0000";

/** Corrige backslashes duplicados que a veces llegan desde el JSON del modelo. */
function normalizarLatex(src: string): string {
  return src.replace(/\\\\(?=[a-zA-Z])/g, "\\").trim();
}

/**
 * Divide el texto en segmentos de texto plano, matemática en línea ($...$)
 * y matemática en bloque ($$...$$). Respeta `\$` como dólar literal.
 */
export function segmentarTexto(entrada: string): Segmento[] {
  const texto = entrada.replace(/\\\$/g, MARCADOR_DOLAR);
  const segmentos: Segmento[] = [];
  const re = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
  let ultimo = 0;
  let m: RegExpExecArray | null;

  const restaurar = (s: string) => s.split(MARCADOR_DOLAR).join("$");

  while ((m = re.exec(texto)) !== null) {
    if (m.index > ultimo) segmentos.push({ tipo: "texto", valor: restaurar(texto.slice(ultimo, m.index)) });
    if (m[1] !== undefined) segmentos.push({ tipo: "bloque", valor: normalizarLatex(restaurar(m[1])) });
    else if (m[2] !== undefined) segmentos.push({ tipo: "inline", valor: normalizarLatex(restaurar(m[2])) });
    ultimo = re.lastIndex;
  }
  if (ultimo < texto.length) segmentos.push({ tipo: "texto", valor: restaurar(texto.slice(ultimo)) });
  return segmentos;
}

/** Si la fórmula es inválida, se muestra el código fuente sin romper el layout. */
function fallback(original: string): ReactNode {
  return <code className="rounded bg-black/25 px-1 font-mono text-[0.9em]">{original}</code>;
}

interface MathTextProps {
  text: string;
  className?: string;
  /** Si es true, las fórmulas $$...$$ se renderizan también en línea. */
  forceInline?: boolean;
}

function MathTextBase({ text, className, forceInline = false }: MathTextProps) {
  const segmentos = useMemo(() => segmentarTexto(text), [text]);

  return (
    <span className={className}>
      {segmentos.map((s, i) => {
        if (s.tipo === "texto") return <Fragment key={i}>{s.valor}</Fragment>;
        if (s.tipo === "inline" || forceInline) {
          return (
            <span key={i} className="math-inline inline-block max-w-full overflow-x-auto align-middle">
              <InlineMath math={s.valor} renderError={() => fallback(s.valor)} />
            </span>
          );
        }
        return (
          <span key={i} className="math-block my-2 block max-w-full overflow-x-auto">
            <BlockMath math={s.valor} renderError={() => fallback(s.valor)} />
          </span>
        );
      })}
    </span>
  );
}

const MathText = memo(MathTextBase);
export default MathText;
