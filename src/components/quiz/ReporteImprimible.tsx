"use client";

import LogoProlipa from "@/components/ui/LogoProlipa";
import MathText from "@/components/MathText";
import { obtenerArea, obtenerGrado, obtenerNivel } from "@/lib/catalogo";
import type { DatosEstudiante, Letra, Pregunta, ResultadoSesion } from "@/types/quiz";

interface ReporteImprimibleProps {
  resultado: ResultadoSesion;
  preguntas: Pregunta[];
  respuestas: Record<string, { letraElegida: Letra; esCorrecta: boolean }>;
  datos: DatosEstudiante;
}

function formatearDuracion(ms: number): string {
  const totalSeg = Math.round(ms / 1000);
  const m = Math.floor(totalSeg / 60);
  const s = totalSeg % 60;
  return `${m} min ${s.toString().padStart(2, "0")} s`;
}

function nivelDominio(p: number): string {
  if (p >= 90) return "Dominio experto";
  if (p >= 70) return "Buen dominio";
  if (p >= 40) return "En progreso";
  return "Necesita repaso";
}

/**
 * Informe de resultados en formato A4. Solo se muestra al imprimir
 * (`hidden print:block`) y usa colores fijos, independientes del tema.
 */
export default function ReporteImprimible({ resultado, preguntas, respuestas, datos }: ReporteImprimibleProps) {
  const { config } = resultado;
  const fecha = new Date(resultado.fecha);
  const fechaTexto = fecha.toLocaleDateString("es-EC", { day: "2-digit", month: "long", year: "numeric" });
  const horaTexto = fecha.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" });
  const falladas = preguntas.filter((p) => !respuestas[p.id]?.esCorrecta);

  const filaDatos: [string, string][] = [
    ["Estudiante", datos.nombre || "—"],
    ["Unidad educativa", datos.institucion || "—"],
    ["Curso / Paralelo", datos.curso || "—"],
    ["Docente", datos.docente || "—"],
    ["Asignatura", obtenerArea(config.area).nombre],
    ["Nivel", `${obtenerNivel(config.nivel).nombre} · ${obtenerGrado(config.grado).nombre}`],
    ["Tema", config.tema],
    ["Fecha", `${fechaTexto}, ${horaTexto}`],
    ...(config.planificacion ? ([["Planificación", config.planificacion]] as [string, string][]) : []),
  ];

  const resumen: [string, string][] = [
    ["Puntaje", `${resultado.aciertos} / ${resultado.total}`],
    ["Porcentaje", `${resultado.porcentaje}%`],
    ["Nivel de dominio", nivelDominio(resultado.porcentaje)],
    ["Tiempo empleado", formatearDuracion(resultado.duracionMs)],
    ["Mejor racha", String(resultado.mejorRachaSesion)],
  ];

  return (
    <article className="hidden bg-white font-sans text-[11pt] leading-snug text-[#111827] print:block" aria-hidden>
      {/* Encabezado */}
      <header className="reporte-bloque overflow-hidden rounded-lg border border-[#0866E0]">
        <div className="flex items-center justify-between border-b-4 border-[#0866E0] bg-white px-5 py-2.5">
          <LogoProlipa tono="sobre-blanco" className="h-11 w-auto" />
          <p className="text-right text-[9pt] font-bold leading-tight text-[#0B3F8F]">
            Tutor Virtual
            <br />
            <span className="font-semibold text-[#4B5563]">Lecciones interactivas</span>
          </p>
        </div>
        <div className="flex items-center justify-between bg-[#0866E0] px-5 py-3 text-white">
          <div>
            <p className="text-[9pt] font-semibold uppercase tracking-wider opacity-90">Prolipa · Tutor Virtual</p>
            <h1 className="text-[16pt] font-extrabold">Informe de resultados</h1>
          </div>
          <div className="text-right text-[9pt] font-semibold">
            {resultado.modo === "repaso" ? "Sesión de repaso" : "Evaluación"}
            <br />
            N.º {resultado.id.slice(0, 8).toUpperCase()}
          </div>
        </div>
        <table className="w-full border-collapse text-[10pt]">
          <tbody>
            {Array.from({ length: Math.ceil(filaDatos.length / 2) }, (_, i) => {
              const a = filaDatos[i * 2];
              const b = filaDatos[i * 2 + 1];
              return (
                <tr key={i} className="border-t border-[#DDE3EC]">
                  {[a, b].map((celda, j) =>
                    celda ? (
                      <td key={j} className="w-1/2 px-5 py-1.5 align-top">
                        <span className="font-bold text-[#0B3F8F]">{celda[0]}: </span>
                        <span>{celda[1]}</span>
                      </td>
                    ) : (
                      <td key={j} />
                    ),
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </header>

      {/* Resumen */}
      <section className="reporte-bloque mt-4 grid grid-cols-5 gap-2">
        {resumen.map(([etiqueta, valor]) => (
          <div key={etiqueta} className="rounded-md border border-[#D9CDF3] text-center">
            <div className="bg-[#EFE8F8] px-1 py-1 text-[8pt] font-bold uppercase text-[#4B3B78]">{etiqueta}</div>
            <div className="px-1 py-2 text-[12pt] font-extrabold text-[#0866E0]">{valor}</div>
          </div>
        ))}
      </section>

      {/* Detalle */}
      <h2 className="mt-5 text-[12pt] font-extrabold text-[#0B3F8F]">Detalle de respuestas</h2>
      <table className="mt-2 w-full border-collapse text-[9.5pt]">
        <thead>
          <tr className="bg-[#EFE8F8] text-left text-[#4B3B78]">
            <th className="w-8 border border-[#D9CDF3] px-2 py-1.5 text-center">N.º</th>
            <th className="border border-[#D9CDF3] px-2 py-1.5">Pregunta</th>
            <th className="w-[22%] border border-[#D9CDF3] px-2 py-1.5">Respuesta del estudiante</th>
            <th className="w-[22%] border border-[#D9CDF3] px-2 py-1.5">Respuesta correcta</th>
            <th className="w-12 border border-[#D9CDF3] px-2 py-1.5 text-center">Resultado</th>
          </tr>
        </thead>
        <tbody>
          {preguntas.map((p, i) => {
            const r = respuestas[p.id];
            const elegida = r ? p.opciones.find((o) => o.letra === r.letraElegida) : undefined;
            const correcta = p.opciones.find((o) => o.letra === p.letraCorrecta);
            return (
              <tr key={p.id} className="reporte-bloque align-top">
                <td className="border border-[#DDE3EC] px-2 py-1.5 text-center font-bold">{i + 1}</td>
                <td className="border border-[#DDE3EC] px-2 py-1.5">
                  <MathText text={p.enunciado} forceInline />
                </td>
                <td className="border border-[#DDE3EC] px-2 py-1.5">
                  {elegida ? <MathText text={`${elegida.letra}) ${elegida.texto}`} forceInline /> : "Sin responder"}
                </td>
                <td className="border border-[#DDE3EC] px-2 py-1.5">
                  {correcta && <MathText text={`${correcta.letra}) ${correcta.texto}`} forceInline />}
                </td>
                <td
                  className={`border border-[#DDE3EC] px-2 py-1.5 text-center font-extrabold ${
                    r?.esCorrecta ? "text-[#13733E]" : "text-[#B42318]"
                  }`}
                >
                  {r?.esCorrecta ? "✔" : "✘"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Retroalimentación */}
      {falladas.length > 0 && (
        <section className="mt-5">
          <h2 className="text-[12pt] font-extrabold text-[#0B3F8F]">Retroalimentación para repasar</h2>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[9.5pt]">
            {falladas.map((p) => (
              <li key={p.id} className="reporte-bloque">
                <MathText text={p.bannerExplicacion} forceInline />
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Firmas */}
      <section className="reporte-bloque mt-14 grid grid-cols-2 gap-16 px-6 text-center text-[9.5pt]">
        <div>
          <div className="border-t border-[#111827] pt-1.5 font-bold">{datos.nombre || "Estudiante"}</div>
          <div className="text-[#4B5563]">Firma del estudiante</div>
        </div>
        <div>
          <div className="border-t border-[#111827] pt-1.5 font-bold">{datos.docente || "Docente"}</div>
          <div className="text-[#4B5563]">Firma del docente</div>
        </div>
      </section>

      <footer className="mt-8 border-t border-[#DDE3EC] pt-2 text-center text-[8pt] text-[#6B7280]">
        {datos.institucion ? `${datos.institucion} · ` : ""}Documento generado el {fechaTexto}
      </footer>
    </article>
  );
}
