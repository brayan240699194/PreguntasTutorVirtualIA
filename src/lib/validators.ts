import { z } from "zod";
import { areaDisponible, obtenerGrado } from "@/lib/catalogo";
import { AREAS, GRADOS, LETRAS, NIVELES } from "@/types/quiz";

export const TEMA_MIN = 2;
export const TEMA_MAX = 120;

/**
 * Limpia el tema escrito por el usuario antes de enviarlo al modelo:
 * - normaliza Unicode,
 * - elimina caracteres de control y símbolos usados para inyección/markup,
 * - colapsa espacios y recorta la longitud.
 */
export function sanitizarTema(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(/[\p{Cc}\p{Cf}]/gu, " ")
    .replace(/[<>{}[\]`$\\|^~]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, TEMA_MAX);
}

/** Máximo de caracteres del contexto extraído de una planificación. */
export const CONTEXTO_MAX = 4000;

/** Limpia la síntesis de la planificación antes de reenviarla al modelo. */
export function limpiarContexto(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(/[\p{Cc}\p{Cf}]/gu, (c) => (c === "\n" ? "\n" : " "))
    .replace(/[<>`]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, CONTEXTO_MAX);
}

/* ------------------------- Request del cliente ---------------------------- */

export const generateQuizRequestSchema = z
  .object({
    nivel: z.enum(NIVELES, { errorMap: () => ({ message: "Nivel educativo no válido." }) }),
    grado: z.enum(GRADOS, { errorMap: () => ({ message: "Grado o curso no válido." }) }),
    area: z.enum(AREAS, { errorMap: () => ({ message: "Asignatura no válida." }) }),
    tema: z
      .string({ required_error: "El tema es obligatorio." })
      .max(500, "El tema es demasiado largo.")
      .transform(sanitizarTema)
      .pipe(
        z
          .string()
          .min(TEMA_MIN, `El tema debe tener al menos ${TEMA_MIN} caracteres.`)
          .max(TEMA_MAX, `El tema no puede superar ${TEMA_MAX} caracteres.`)
          .refine((t) => /\p{L}/u.test(t), "El tema debe contener letras."),
      ),
    cantidad: z.union([z.literal(5), z.literal(10)], {
      errorMap: () => ({ message: "La cantidad debe ser 5 o 10." }),
    }),
    contexto: z
      .string()
      .max(CONTEXTO_MAX + 500, "El contenido de la planificación es demasiado largo.")
      .transform(limpiarContexto)
      .optional()
      .transform((c) => (c ? c : undefined)),
    planificacion: z
      .string()
      .max(200)
      .transform((t) => sanitizarTema(t).slice(0, 100))
      .optional()
      .transform((t) => (t ? t : undefined)),
  })
  .strict()
  .superRefine((c, ctx) => {
    if (obtenerGrado(c.grado).nivel !== c.nivel) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["grado"], message: "El grado no corresponde al nivel elegido." });
      return;
    }
    if (!areaDisponible(c.area, c.grado)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["area"],
        message: "Esa asignatura no corresponde al grado elegido.",
      });
    }
  });

export type GenerateQuizRequestInput = z.input<typeof generateQuizRequestSchema>;

/* ------------------------- Respuesta del modelo --------------------------- */

const textoNoVacio = (max: number) => z.string().trim().min(1).max(max);

export const opcionSchema = z.object({
  letra: z.enum(LETRAS),
  texto: textoNoVacio(600),
  feedbackEspecifico: textoNoVacio(800),
});

export const preguntaGeneradaSchema = z
  .object({
    id: z.string().optional(),
    enunciado: textoNoVacio(1200),
    opciones: z.array(opcionSchema).length(4),
    letraCorrecta: z.enum(LETRAS),
    bannerExplicacion: textoNoVacio(500),
    guionVozAcierto: textoNoVacio(300),
    guionVozError: textoNoVacio(400),
  })
  .superRefine((p, ctx) => {
    const letras = new Set(p.opciones.map((o) => o.letra));
    if (letras.size !== 4) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Las opciones deben ser A, B, C y D sin repetir." });
    }
    const textos = new Set(p.opciones.map((o) => o.texto.toLowerCase()));
    if (textos.size !== 4) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Las opciones no pueden repetirse." });
    }
  });

export const respuestaModeloSchema = z.object({
  preguntas: z.array(preguntaGeneradaSchema).min(1),
});

export type PreguntaGenerada = z.infer<typeof preguntaGeneradaSchema>;

/* ------------------------- Planificación (PDF) ---------------------------- */

export const analisisPlanificacionSchema = z.object({
  esPlanificacionEducativa: z.boolean(),
  asignatura: z.string().optional(),
  titulo: z.string().trim().min(1).max(300),
  resumen: z.string().trim().min(1).max(2000),
  contexto: z.string().trim().min(1).max(12000),
  temas: z
    .array(z.object({ titulo: z.string().trim().min(1).max(300), descripcion: z.string().trim().max(800) }))
    .min(1),
});

/** Campos que acompañan al PDF en el formulario multipart. */
export const analizarPlanificacionCamposSchema = z
  .object({
    nivel: z.enum(NIVELES),
    grado: z.enum(GRADOS),
    area: z.enum(AREAS),
  })
  .superRefine((c, ctx) => {
    if (obtenerGrado(c.grado).nivel !== c.nivel || !areaDisponible(c.area, c.grado)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "La combinación de nivel, grado y asignatura no es válida." });
    }
  });

export function formatearErroresZod(error: z.ZodError): string[] {
  return error.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message));
}
