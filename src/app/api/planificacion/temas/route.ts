import { NextResponse, type NextRequest } from "next/server";
import { errorJson, errorLimite, respuestaErrorIA } from "@/lib/apiRespuestas";
import {
  PDF_ESCANEADO_MAX_MB,
  PDF_ESCANEADO_MAX_PAGINAS,
  PDF_MAX_MB,
  planificacionPdfHabilitada,
} from "@/lib/funciones";
import { analizarPlanificacion, fechaLimitePorDefecto } from "@/lib/gemini";
import {
  PdfLecturaError,
  analizarLocalmente,
  claveCache,
  esEscaneado,
  extractoParaModelo,
  extraerPdf,
  fragmentosPorTema,
  guardarCache,
  leerCache,
} from "@/lib/pdfTexto";
import { obtenerIp, verificarLimite } from "@/lib/rateLimit";
import { analizarPlanificacionCamposSchema, formatearErroresZod } from "@/lib/validators";
import type { AnalizarPlanificacionResponse, ApiErrorResponse } from "@/types/quiz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_POR_MINUTO = 8;
const PDF_MAX_BYTES = PDF_MAX_MB * 1024 * 1024;

/**
 * Recibe un PDF de planificación, guía o libro (multipart/form-data, campo
 * "archivo") junto con nivel, grado y asignatura, y devuelve los temas.
 * El texto se extrae en el servidor con pdf-parse; el modelo solo se usa
 * cuando no hay estructura detectable, y entonces con un extracto acotado.
 */
export async function POST(req: NextRequest): Promise<NextResponse<AnalizarPlanificacionResponse | ApiErrorResponse>> {
  const fechaLimite = fechaLimitePorDefecto();
  if (!planificacionPdfHabilitada()) {
    return errorJson(403, "FUNCION_DESHABILITADA", "La carga de planificaciones en PDF está deshabilitada.");
  }

  const limite = verificarLimite("planificacion", obtenerIp(req), MAX_POR_MINUTO);
  if (!limite.permitido) return errorLimite(limite.reintentarEnSeg, "Has analizado muchas planificaciones seguidas.");

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return errorJson(415, "SOLICITUD_INVALIDA", "El archivo debe enviarse como multipart/form-data.");
  }

  // Rechazo temprano por tamaño declarado (margen para los demás campos).
  const declarado = Number(req.headers.get("content-length") ?? "0");
  if (declarado > PDF_MAX_BYTES + 64 * 1024) {
    return errorJson(413, "ARCHIVO_INVALIDO", `El PDF supera el máximo de ${PDF_MAX_MB} MB.`);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return errorJson(400, "SOLICITUD_INVALIDA", "No se pudo leer el formulario enviado.");
  }

  const campos = analizarPlanificacionCamposSchema.safeParse({
    nivel: form.get("nivel"),
    grado: form.get("grado"),
    area: form.get("area"),
  });
  if (!campos.success) {
    const detalles = formatearErroresZod(campos.error);
    return errorJson(400, "SOLICITUD_INVALIDA", detalles[0] ?? "Datos inválidos.", detalles);
  }

  const archivo = form.get("archivo");
  if (!(archivo instanceof File)) {
    return errorJson(400, "ARCHIVO_INVALIDO", "Adjunta un archivo PDF.");
  }
  if (archivo.size === 0) {
    return errorJson(400, "ARCHIVO_INVALIDO", "El archivo está vacío.");
  }
  if (archivo.size > PDF_MAX_BYTES) {
    return errorJson(413, "ARCHIVO_INVALIDO", `El PDF supera el máximo de ${PDF_MAX_MB} MB.`);
  }

  const bytes = Buffer.from(await archivo.arrayBuffer());
  // Verifica la firma real del archivo, no solo la extensión o el tipo declarado.
  if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") {
    return errorJson(415, "ARCHIVO_INVALIDO", "El archivo no es un PDF válido.");
  }

  const { nivel, grado, area } = campos.data;
  const clave = claveCache(bytes, nivel, grado, area);
  const enCache = leerCache<AnalizarPlanificacionResponse>(clave);
  if (enCache) {
    console.info(`[planificacion/temas] caché · ${enCache.paginas} págs · 0 tokens`);
    return responder(enCache);
  }

  const inicio = Date.now();
  let pdf;
  try {
    pdf = await extraerPdf(bytes);
  } catch (e) {
    const protegido = e instanceof PdfLecturaError && e.code === "PROTEGIDO";
    return errorJson(
      422,
      "ARCHIVO_INVALIDO",
      protegido
        ? "El PDF está protegido con contraseña. Quita la protección y vuelve a subirlo."
        : "No se pudo leer el PDF. Puede estar dañado; prueba exportarlo de nuevo.",
    );
  }

  try {
    let resultado: AnalizarPlanificacionResponse;

    // 1) Sin modelo: estructura detectada en el texto (0 tokens).
    const local = esEscaneado(pdf) ? null : analizarLocalmente(pdf, archivo.name);
    if (local) {
      resultado = {
        titulo: local.titulo,
        resumen: local.resumen,
        contexto: local.contexto,
        temas: local.temas,
        paginas: pdf.total,
        metodo: "local",
      };
    } else if (!esEscaneado(pdf)) {
      // 2) Con modelo, pero solo con un extracto acotado del texto.
      const extracto = extractoParaModelo(pdf);
      const ia = await analizarPlanificacion({ tipo: "texto", texto: extracto }, campos.data, fechaLimite);
      const fragmentos = fragmentosPorTema(pdf.paginas, ia.temas.map((t) => t.titulo));
      resultado = {
        ...ia,
        temas: ia.temas.map((t, i) => ({ ...t, contexto: fragmentos[i] })),
        paginas: pdf.total,
        metodo: "texto",
      };
    } else {
      // 3) PDF escaneado (solo imágenes): el modelo tiene que "verlo", si es corto.
      if (pdf.total > PDF_ESCANEADO_MAX_PAGINAS || bytes.length > PDF_ESCANEADO_MAX_MB * 1024 * 1024) {
        return errorJson(
          422,
          "ARCHIVO_INVALIDO",
          `El PDF parece escaneado (solo imágenes, sin texto seleccionable). Para documentos escaneados se admiten hasta ${PDF_ESCANEADO_MAX_PAGINAS} páginas; sube una versión con texto o solo las páginas de la unidad.`,
        );
      }
      const ia = await analizarPlanificacion({ tipo: "pdf", base64: bytes.toString("base64") }, campos.data, fechaLimite);
      resultado = { ...ia, paginas: pdf.total, metodo: "pdf" };
    }

    console.info(
      `[planificacion/temas] ${resultado.metodo} · ${pdf.total} págs (${pdf.leidas} leídas) · ${resultado.temas.length} temas · ${Date.now() - inicio} ms`,
    );
    guardarCache(clave, resultado);
    return responder(resultado);
  } catch (error) {
    return respuestaErrorIA(error, "planificacion/temas");
  }
}

function responder(r: AnalizarPlanificacionResponse): NextResponse<AnalizarPlanificacionResponse> {
  return NextResponse.json(r, { status: 200, headers: { "Cache-Control": "no-store" } });
}

export function GET(): NextResponse<ApiErrorResponse> {
  return errorJson(405, "SOLICITUD_INVALIDA", "Método no permitido. Usa POST.", undefined, { Allow: "POST" });
}
