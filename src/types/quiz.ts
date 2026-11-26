/* =============================================================================
 * Tipos del dominio: áreas, niveles, preguntas, respuestas, resultados y tutor.
 * ========================================================================== */

/** Asignaturas (EGB/BGU) y ámbitos de desarrollo (Inicial) del currículo MINEDUC. */
export const AREAS = [
  // Educación Inicial — ámbitos de desarrollo y aprendizaje
  "identidad-autonomia",
  "convivencia",
  "medio-natural-cultural",
  "relaciones-logico-matematicas",
  "comprension-expresion-lenguaje",
  "expresion-artistica",
  "expresion-corporal",
  // EGB y BGU — asignaturas
  "lengua-literatura",
  "matematica",
  "ciencias-naturales",
  "estudios-sociales",
  "ingles",
  "educacion-fisica",
  "educacion-cultural-artistica",
  "fisica",
  "quimica",
  "biologia",
  "historia",
  "educacion-ciudadania",
  "filosofia",
  "emprendimiento-gestion",
] as const;
export type AreaId = (typeof AREAS)[number];

/** Niveles del Sistema Nacional de Educación (LOEI, Ecuador). */
export const NIVELES = ["inicial", "egb", "bgu"] as const;
export type NivelId = (typeof NIVELES)[number];

/** Subniveles usados para adaptar dificultad y temas sugeridos. */
export const ETAPAS = [
  "inicial",
  "egb-preparatoria",
  "egb-elemental",
  "egb-media",
  "egb-superior",
  "bgu",
] as const;
export type EtapaId = (typeof ETAPAS)[number];

export const GRADOS = [
  "inicial-3",
  "inicial-4",
  "egb-1",
  "egb-2",
  "egb-3",
  "egb-4",
  "egb-5",
  "egb-6",
  "egb-7",
  "egb-8",
  "egb-9",
  "egb-10",
  "bgu-1",
  "bgu-2",
  "bgu-3",
] as const;
export type GradoId = (typeof GRADOS)[number];

export const CANTIDADES = [5, 10] as const;
export type CantidadPreguntas = (typeof CANTIDADES)[number];

export const LETRAS = ["A", "B", "C", "D"] as const;
export type Letra = (typeof LETRAS)[number];

/* ----------------------------- Preguntas ---------------------------------- */

export interface Opcion {
  letra: Letra;
  texto: string;
  /** Explica por qué ESTA opción es correcta o incorrecta. */
  feedbackEspecifico: string;
}

export interface Pregunta {
  id: string;
  enunciado: string;
  opciones: Opcion[];
  letraCorrecta: Letra;
  /** Resumen de 1-2 frases mostrado en el banner superior. */
  bannerExplicacion: string;
  /** Frase cálida (≤ 20 palabras) para el tutor al acertar. */
  guionVozAcierto: string;
  /** Frase empática (≤ 25 palabras) para el tutor al fallar. */
  guionVozError: string;
}

/* ----------------------------- Configuración ------------------------------ */

export interface QuizConfig {
  nivel: NivelId;
  grado: GradoId;
  area: AreaId;
  tema: string;
  cantidad: CantidadPreguntas;
  /** Síntesis de la planificación PDF del docente (si la lección se basa en ella). */
  contexto?: string;
  /** Título de la planificación de origen. */
  planificacion?: string;
}

export type GenerateQuizRequest = QuizConfig;

export interface GenerateQuizResponse {
  config: QuizConfig;
  preguntas: Pregunta[];
  generadoEn: string;
}

export interface EstadoIAResponse {
  disponible: boolean;
  verificadoEn: string;
}

export interface TemaPlanificacion {
  titulo: string;
  descripcion: string;
  /** Fragmento del documento que corresponde a este tema (si se ubicó). */
  contexto?: string;
}

/**
 * Cómo se obtuvieron los temas: "local" sin modelo (0 tokens), "texto" con un
 * extracto del texto, "pdf" con el archivo completo (solo PDF escaneados cortos).
 */
export type MetodoAnalisis = "local" | "texto" | "pdf";

export interface AnalizarPlanificacionResponse {
  titulo: string;
  resumen: string;
  contexto: string;
  temas: TemaPlanificacion[];
  paginas: number;
  metodo: MetodoAnalisis;
  /** Asignatura a la que parece pertenecer el documento (null si no está clara). */
  areaDetectada: AreaId | null;
}

export type ApiErrorCode =
  | "FUNCION_DESHABILITADA"
  | "ARCHIVO_INVALIDO"
  | "NO_ES_PLANIFICACION"
  | "SOLICITUD_INVALIDA"
  | "LIMITE_EXCEDIDO"
  | "CONFIGURACION_SERVIDOR"
  | "ERROR_IA"
  | "RESPUESTA_IA_INVALIDA"
  | "ERROR_INTERNO";

export interface ApiErrorResponse {
  error: string;
  codigo: ApiErrorCode;
  detalles?: string[];
}

/* ----------------------------- Sesión ------------------------------------- */

export type ModoSesion = "normal" | "repaso";

export interface RespuestaUsuario {
  preguntaId: string;
  letraElegida: Letra;
  esCorrecta: boolean;
  respondidaEn: number;
}

export type Calificacion = "up" | "down";

export interface PreguntaFallada {
  enunciado: string;
  respuestaElegida: string;
  respuestaCorrecta: string;
}

export interface ResultadoSesion {
  id: string;
  config: QuizConfig;
  modo: ModoSesion;
  total: number;
  aciertos: number;
  porcentaje: number;
  duracionMs: number;
  fecha: string;
  mejorRachaSesion: number;
  falladas: PreguntaFallada[];
}

export interface AnaliticaArea {
  sesiones: number;
  preguntasRespondidas: number;
  aciertos: number;
  ultimaSesion: string | null;
}

export type AnaliticaPorArea = Record<AreaId, AnaliticaArea>;

/** Datos que el estudiante escribe para el informe imprimible. */
export interface DatosEstudiante {
  nombre: string;
  institucion: string;
  curso: string;
  docente: string;
}

/* ----------------------------- Tutor -------------------------------------- */

export type TutorStatus = "idle" | "speaking";

export interface SubtitleWord {
  text: string;
  start: number;
  end: number;
}

export interface TutorVoiceState {
  isSupported: boolean;
  isSpeaking: boolean;
  status: TutorStatus;
  words: SubtitleWord[];
  /** Índice de la última palabra pronunciada (-1 = ninguna aún). */
  currentWordIndex: number;
  subtitleVisible: boolean;
  voiceName: string | null;
}

export interface TutorVoiceControls extends TutorVoiceState {
  speak: (text: string) => void;
  stop: () => void;
}
