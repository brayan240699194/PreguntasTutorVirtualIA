import { NextResponse, type NextRequest } from "next/server";
import { errorJson, errorLimite, respuestaErrorIA } from "@/lib/apiRespuestas";
import { planificacionPdfHabilitada } from "@/lib/funciones";
import { fechaLimitePorDefecto, generarPreguntas } from "@/lib/gemini";
import { obtenerIp, verificarLimite } from "@/lib/rateLimit";
import { formatearErroresZod, generateQuizRequestSchema } from "@/lib/validators";
import type { ApiErrorResponse, GenerateQuizResponse } from "@/types/quiz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_POR_MINUTO = 6;

export async function POST(req: NextRequest): Promise<NextResponse<GenerateQuizResponse | ApiErrorResponse>> {
  const fechaLimite = fechaLimitePorDefecto();
  const limite = verificarLimite("generar", obtenerIp(req), MAX_POR_MINUTO);
  if (!limite.permitido) return errorLimite(limite.reintentarEnSeg, "Has generado muchas lecciones seguidas.");

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return errorJson(415, "SOLICITUD_INVALIDA", "El cuerpo debe enviarse como application/json.");
  }

  let cuerpo: unknown;
  try {
    cuerpo = await req.json();
  } catch {
    return errorJson(400, "SOLICITUD_INVALIDA", "El cuerpo de la solicitud no es JSON válido.");
  }

  const validacion = generateQuizRequestSchema.safeParse(cuerpo);
  if (!validacion.success) {
    const detalles = formatearErroresZod(validacion.error);
    return errorJson(400, "SOLICITUD_INVALIDA", detalles[0] ?? "Solicitud inválida.", detalles);
  }

  const config = validacion.data;
  if (config.contexto && !planificacionPdfHabilitada()) {
    return errorJson(
      403,
      "FUNCION_DESHABILITADA",
      "Las lecciones a partir de una planificación en PDF están deshabilitadas en este momento.",
    );
  }

  try {
    const preguntas = await generarPreguntas(config, fechaLimite);
    const body: GenerateQuizResponse = { config, preguntas, generadoEn: new Date().toISOString() };
    return NextResponse.json(body, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return respuestaErrorIA(error, "quiz/generate");
  }
}

export function GET(): NextResponse<ApiErrorResponse> {
  return errorJson(405, "SOLICITUD_INVALIDA", "Método no permitido. Usa POST.", undefined, { Allow: "POST" });
}
