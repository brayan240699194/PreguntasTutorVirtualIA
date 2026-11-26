import { GraduationCap } from "lucide-react";
import type { ReactNode } from "react";
import LogoProlipa from "@/components/ui/LogoProlipa";

/** Barra superior azul con esquinas redondeadas (estilo plataforma institucional). */
export function BarraSuperior({ izquierda, derecha }: { izquierda?: ReactNode; derecha?: ReactNode }) {
  return (
    <header className="flex min-h-[60px] items-center justify-between gap-2 rounded-xl bg-primario px-3 py-2.5 text-white sm:min-h-[64px] sm:gap-3 shadow-[0_6px_18px_-8px_rgba(8,102,224,0.7)] sm:px-6">
      <div className="flex min-w-0 items-center gap-1.5 sm:gap-3">{izquierda}</div>
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">{derecha}</div>
    </header>
  );
}

/** Marca de la app para el lado derecho de la barra: logo de Prolipa sobre una pastilla blanca. */
export function MarcaApp({ subtitulo = "Lecciones interactivas" }: { subtitulo?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right md:block">
        <p className="text-sm font-bold leading-tight">Tutor Virtual</p>
        <p className="text-xs font-medium text-white/85">{subtitulo}</p>
      </div>
      <span className="flex h-10 items-center rounded-lg bg-white px-2 shadow-inner sm:h-12 sm:px-3">
        <LogoProlipa tono="sobre-blanco" className="h-7 w-auto sm:h-9" />
      </span>
    </div>
  );
}

/** Banda con degradado azul y título centrado en mayúsculas. */
export function BandaTitulo({ children }: { children: ReactNode }) {
  return (
    <div className="mt-3 flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-primario to-primario-2 px-4 py-3 text-center text-sm font-bold uppercase tracking-wide text-white shadow-[0_6px_18px_-10px_rgba(8,102,224,0.8)] sm:text-base">
      <GraduationCap className="h-5 w-5 shrink-0" aria-hidden />
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
}

/** Colores alegres para el número de cada paso. */
const COLORES_PASO = ["#2D7FF9", "#22A45D", "#F08A24", "#8B5CF6", "#E85D8A"];

/**
 * Tarjeta de un paso del formulario. Con `paso`, la cabecera muestra un número
 * grande de color y un emoji; sin él, conserva la cabecera lila clásica.
 */
export function Panel({
  titulo,
  children,
  className = "",
  id,
  paso,
  emoji,
}: {
  titulo: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
  paso?: number;
  emoji?: string;
}) {
  if (paso === undefined) {
    return (
      <section
        id={id}
        className={`min-w-0 rounded-xl bg-superficie p-2 shadow-[0_2px_12px_var(--c-sombra)] sm:p-4 ${className}`}
      >
        <div className="overflow-hidden rounded-lg border border-lila-borde">
          <div className="border-b border-lila-borde bg-lila px-4 py-2.5 text-center text-sm font-bold">{titulo}</div>
          <div className="p-3 sm:p-4">{children}</div>
        </div>
      </section>
    );
  }
  const color = COLORES_PASO[(paso - 1) % COLORES_PASO.length];
  return (
    <section
      id={id}
      className={`min-w-0 rounded-3xl border-2 border-borde bg-superficie p-3 shadow-[0_6px_0_var(--c-borde),0_10px_24px_-12px_var(--c-sombra)] sm:p-5 ${className}`}
    >
      <h2 className="mb-3 flex items-center gap-3 sm:mb-4">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-lg font-black text-white shadow-[0_3px_0_rgba(0,0,0,0.18)] sm:h-11 sm:w-11 sm:text-xl"
          style={{ backgroundColor: color }}
          aria-hidden
        >
          {paso}
        </span>
        <span className="min-w-0 flex-1 text-lg font-extrabold leading-tight sm:text-xl">{titulo}</span>
        {emoji && (
          <span className="shrink-0 text-2xl sm:text-3xl" aria-hidden>
            {emoji}
          </span>
        )}
      </h2>
      {children}
    </section>
  );
}
