import type {
  AnalizarPlanificacionResponse,
  ApiErrorResponse,
  GenerateQuizResponse,
  QuizConfig,
} from "@/types/quiz";
import { marcarIA } from "@/store/useEstadoIA";

export class QuizApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "QuizApiError";
    this.status = status;
  }
}

function esApiError(x: unknown): x is ApiErrorResponse {
  return typeof x === "object" && x !== null && "error" in x && typeof (x as { error: unknown }).error === "string";
}

function esRespuestaValida(x: unknown): x is GenerateQuizResponse {
  return (
    typeof x === "object" &&
    x !== null &&
    Array.isArray((x as { preguntas?: unknown }).preguntas) &&
    (x as { preguntas: unknown[] }).preguntas.length > 0
  );
}

/** Llama al endpoint de generación y devuelve la respuesta tipada. */
export async function solicitarLeccion(config: QuizConfig, signal?: AbortSignal): Promise<GenerateQuizResponse> {
  let res: Response;
  try {
    res = await fetch("/api/quiz/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
      signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new QuizApiError("No hay conexión con el servidor. Revisa tu internet.", 0);
  }

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    // 5xx: la IA no respondió o no está configurada → credencial naranja.
    if (res.status >= 500) marcarIA(false);
    const mensaje = esApiError(data) ? data.error : `Error del servidor (${res.status}).`;
    throw new QuizApiError(mensaje, res.status);
  }
  if (!esRespuestaValida(data)) {
    throw new QuizApiError("La respuesta del servidor no tiene preguntas.", res.status);
  }
  marcarIA(true);
  return data;
}

/** Envía un PDF de planificación y devuelve los temas detectados. */
export async function analizarPlanificacionPdf(
  archivo: File,
  campos: Pick<QuizConfig, "nivel" | "grado" | "area">,
  signal?: AbortSignal,
): Promise<AnalizarPlanificacionResponse> {
  const form = new FormData();
  form.append("archivo", archivo);
  form.append("nivel", campos.nivel);
  form.append("grado", campos.grado);
  form.append("area", campos.area);

  let res: Response;
  try {
    res = await fetch("/api/planificacion/temas", { method: "POST", body: form, signal });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new QuizApiError("No hay conexión con el servidor. Revisa tu internet.", 0);
  }

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    throw new QuizApiError(esApiError(data) ? data.error : `Error del servidor (${res.status}).`, res.status);
  }
  const d = data as Partial<AnalizarPlanificacionResponse> | null;
  if (!d || !Array.isArray(d.temas) || typeof d.contexto !== "string" || typeof d.titulo !== "string") {
    throw new QuizApiError("La respuesta del servidor no tiene temas.", res.status);
  }
  return d as AnalizarPlanificacionResponse;
}
