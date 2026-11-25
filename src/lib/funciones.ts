/**
 * Interruptores de funciones, controlados por el administrador desde las
 * variables de entorno (.env.local). Solo se leen en el servidor.
 */

const VERDADERO = new Set(["true", "1", "si", "sí", "on", "yes"]);

/** Permite subir una planificación en PDF para generar temas y preguntas. */
export function planificacionPdfHabilitada(): boolean {
  const v = process.env.PLANIFICACION_PDF_HABILITADA?.trim().toLowerCase();
  return v !== undefined && VERDADERO.has(v);
}

/** Tamaño máximo del PDF (MB): admite guías y libros, porque se leen en el servidor. */
export const PDF_MAX_MB = 30;

/** Los PDF escaneados (sin texto) solo se envían al modelo si son así de cortos. */
export const PDF_ESCANEADO_MAX_PAGINAS = 15;
export const PDF_ESCANEADO_MAX_MB = 10;
