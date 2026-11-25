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

/** Tarjeta blanca con cabecera lila (como el panel "Certificados"). */
export function Panel({
  titulo,
  children,
  className = "",
  id,
}: {
  titulo: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
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
