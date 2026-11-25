import { NextResponse } from "next/server";
import { GeminiError } from "@/lib/gemini";
import type { ApiErrorCode, ApiErrorResponse } from "@/types/quiz";

export function errorJson(
  status: number,
  codigo: ApiErrorCode,
  error: string,
  detalles?: string[],
  headers?: Record<string, string>,
): NextResponse<ApiErrorResponse> {
  const body: ApiErrorResponse = detalles && detalles.length ? { error, codigo, detalles } : { error, codigo };
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export function errorLimite(reintentarEnSeg: number, mensaje: string): NextResponse<ApiErrorResponse> {
  return errorJson(429, "LIMITE_EXCEDIDO", `${mensaje} Intenta de nuevo en ${reintentarEnSeg} s.`, undefined, {
    "Retry-After": String(reintentarEnSeg),
  });
}

/** Traduce los errores del servicio de IA a respuestas HTTP con mensajes para el usuario. */
export function respuestaErrorIA(error: unknown, origen: string): NextResponse<ApiErrorResponse> {
  if (error instanceof GeminiError) {
    console.error(`[${origen}] ${error.code}: ${error.message}`, error.detalles);
    switch (error.code) {
      case "SIN_API_KEY":
        return errorJson(500, "CONFIGURACION_SERVIDOR", "El servidor no tiene configurada la clave de Gemini.");
      case "CLAVE_INVALIDA":
        return errorJson(
          500,
          "CONFIGURACION_SERVIDOR",
          "La clave de Gemini es inválida o no tiene permisos. Revisa GEMINI_API_KEY en .env.local.",
        );
      case "SATURADO":
        return errorJson(
          503,
          "ERROR_IA",
          "El servicio está muy ocupado en este momento. Espera unos segundos e intenta de nuevo.",
          undefined,
          { "Retry-After": "10" },
        );
      case "NO_ES_PLANIFICACION":
        return errorJson(
          422,
          "NO_ES_PLANIFICACION",
          "El PDF no parece una planificación o material educativo. Sube una planificación, guía o unidad didáctica.",
        );
      case "RESPUESTA_IA_INVALIDA":
        return errorJson(502, "RESPUESTA_IA_INVALIDA", "El tutor generó una respuesta con formato inválido. Intenta de nuevo.");
      case "ERROR_IA":
        return errorJson(
          502,
          "ERROR_IA",
          "El servicio de lecciones no respondió correctamente. Intenta de nuevo en unos segundos.",
        );
    }
  }
  console.error(`[${origen}] Error inesperado:`, error);
  return errorJson(500, "ERROR_INTERNO", "Ocurrió un error inesperado. Intenta de nuevo.");
}
