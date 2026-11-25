import type { AreaId, EtapaId, GradoId, NivelId } from "@/types/quiz";

/* =============================================================================
 * Catálogo educativo basado en la estructura del Sistema Nacional de Educación
 * del Ecuador (LOEI / MINEDUC): Educación Inicial, Educación General Básica
 * (EGB) y Bachillerato General Unificado (BGU).
 * ========================================================================== */

export interface NivelInfo {
  id: NivelId;
  nombre: string;
  corto: string;
  descripcion: string;
}

export interface EtapaInfo {
  id: EtapaId;
  nombre: string;
  /** Pautas pedagógicas que se envían al modelo. */
  pautas: string;
  /** Si la pregunta y sus opciones se leen en voz alta automáticamente. */
  lecturaAutomatica: boolean;
  /** Nivel MCER de referencia para Inglés (currículo MINEDUC). */
  mcerIngles: string | null;
}

export interface GradoInfo {
  id: GradoId;
  nivel: NivelId;
  etapa: EtapaId;
  nombre: string;
  corto: string;
  edad: string;
}

export interface AreaInfo {
  id: AreaId;
  nombre: string;
  descripcion: string;
  /** Color de acento (hex) para la tarjeta. */
  acento: string;
  /** Temas sugeridos por subnivel. Si un subnivel no aparece, la asignatura no está disponible en él. */
  temas: Partial<Record<EtapaId, string[]>>;
}

/* ----------------------------- Niveles ------------------------------------ */

export const NIVELES_INFO: readonly NivelInfo[] = [
  { id: "inicial", nombre: "Educación Inicial", corto: "Inicial", descripcion: "3 a 5 años" },
  { id: "egb", nombre: "Educación General Básica", corto: "Básica", descripcion: "1.º a 10.º grado" },
  { id: "bgu", nombre: "Bachillerato General Unificado", corto: "Bachillerato", descripcion: "1.º a 3.º curso" },
];

export const ETAPAS_INFO: Record<EtapaId, EtapaInfo> = {
  inicial: {
    id: "inicial",
    nombre: "Educación Inicial (subnivel 2)",
    pautas:
      "Niños y niñas de 3 a 5 años que todavía NO leen: el tutor leerá la pregunta y las opciones en voz alta. Enunciados de máximo 12 palabras, opciones de 1 a 3 palabras, situaciones y objetos cotidianos, sin negaciones, sin LaTeX ni números grandes. Retroalimentación muy breve, cariñosa y concreta.",
    lecturaAutomatica: true,
    mcerIngles: null,
  },
  "egb-preparatoria": {
    id: "egb-preparatoria",
    nombre: "Subnivel Preparatoria",
    pautas:
      "Niños y niñas de 5 a 6 años que inician la lectoescritura: el tutor leerá las preguntas en voz alta. Frases de máximo 15 palabras, opciones muy breves, vocabulario sencillo y ejemplos del entorno inmediato.",
    lecturaAutomatica: true,
    mcerIngles: null,
  },
  "egb-elemental": {
    id: "egb-elemental",
    nombre: "Básica Elemental",
    pautas:
      "Estudiantes de 6 a 9 años. Frases cortas (máximo 20 palabras), vocabulario sencillo, ejemplos concretos y cercanos a su vida diaria en Ecuador.",
    lecturaAutomatica: true,
    mcerIngles: "Pre-A1",
  },
  "egb-media": {
    id: "egb-media",
    nombre: "Básica Media",
    pautas:
      "Estudiantes de 9 a 12 años. Preguntas claras que combinen comprensión y aplicación, con ejemplos del contexto ecuatoriano.",
    lecturaAutomatica: false,
    mcerIngles: "A1",
  },
  "egb-superior": {
    id: "egb-superior",
    nombre: "Básica Superior",
    pautas:
      "Estudiantes de 12 a 15 años. Incluye preguntas de análisis y aplicación, con vocabulario disciplinar apropiado.",
    lecturaAutomatica: false,
    mcerIngles: "A2",
  },
  bgu: {
    id: "bgu",
    nombre: "Bachillerato General Unificado",
    pautas:
      "Estudiantes de 15 a 18 años. Rigor disciplinar, análisis, resolución de problemas y preparación para el examen de acceso a la educación superior.",
    lecturaAutomatica: false,
    mcerIngles: "B1",
  },
};

/* ----------------------------- Grados ------------------------------------- */

export const GRADOS_INFO: readonly GradoInfo[] = [
  { id: "inicial-3", nivel: "inicial", etapa: "inicial", nombre: "Inicial 2 · 3 a 4 años", corto: "3 a 4 años", edad: "3 a 4 años" },
  { id: "inicial-4", nivel: "inicial", etapa: "inicial", nombre: "Inicial 2 · 4 a 5 años", corto: "4 a 5 años", edad: "4 a 5 años" },
  { id: "egb-1", nivel: "egb", etapa: "egb-preparatoria", nombre: "1.º de EGB", corto: "1.º", edad: "5 a 6 años" },
  { id: "egb-2", nivel: "egb", etapa: "egb-elemental", nombre: "2.º de EGB", corto: "2.º", edad: "6 a 7 años" },
  { id: "egb-3", nivel: "egb", etapa: "egb-elemental", nombre: "3.º de EGB", corto: "3.º", edad: "7 a 8 años" },
  { id: "egb-4", nivel: "egb", etapa: "egb-elemental", nombre: "4.º de EGB", corto: "4.º", edad: "8 a 9 años" },
  { id: "egb-5", nivel: "egb", etapa: "egb-media", nombre: "5.º de EGB", corto: "5.º", edad: "9 a 10 años" },
  { id: "egb-6", nivel: "egb", etapa: "egb-media", nombre: "6.º de EGB", corto: "6.º", edad: "10 a 11 años" },
  { id: "egb-7", nivel: "egb", etapa: "egb-media", nombre: "7.º de EGB", corto: "7.º", edad: "11 a 12 años" },
  { id: "egb-8", nivel: "egb", etapa: "egb-superior", nombre: "8.º de EGB", corto: "8.º", edad: "12 a 13 años" },
  { id: "egb-9", nivel: "egb", etapa: "egb-superior", nombre: "9.º de EGB", corto: "9.º", edad: "13 a 14 años" },
  { id: "egb-10", nivel: "egb", etapa: "egb-superior", nombre: "10.º de EGB", corto: "10.º", edad: "14 a 15 años" },
  { id: "bgu-1", nivel: "bgu", etapa: "bgu", nombre: "1.º de Bachillerato", corto: "1.º BGU", edad: "15 a 16 años" },
  { id: "bgu-2", nivel: "bgu", etapa: "bgu", nombre: "2.º de Bachillerato", corto: "2.º BGU", edad: "16 a 17 años" },
  { id: "bgu-3", nivel: "bgu", etapa: "bgu", nombre: "3.º de Bachillerato", corto: "3.º BGU", edad: "17 a 18 años" },
];

/* ----------------------------- Asignaturas -------------------------------- */

export const AREAS_INFO: readonly AreaInfo[] = [
  /* ---------- Educación Inicial: ámbitos de desarrollo y aprendizaje ---------- */
  {
    id: "identidad-autonomia",
    nombre: "Identidad y autonomía",
    descripcion: "Quién soy, mi cuerpo y mis hábitos.",
    acento: "#E85D8A",
    temas: { inicial: ["Mi nombre y mi familia", "Partes de mi cuerpo", "Hábitos de higiene", "Mis emociones", "Alimentos saludables"] },
  },
  {
    id: "convivencia",
    nombre: "Convivencia",
    descripcion: "Compartir, respetar y vivir juntos.",
    acento: "#F08A24",
    temas: { inicial: ["Normas del aula", "Compartir y esperar mi turno", "Personas de mi escuela", "Profesiones y oficios", "Fiestas de mi comunidad"] },
  },
  {
    id: "medio-natural-cultural",
    nombre: "Medio natural y cultural",
    descripcion: "Animales, plantas y mi entorno.",
    acento: "#22A45D",
    temas: { inicial: ["Animales domésticos y salvajes", "Las plantas", "El día y la noche", "El estado del tiempo", "Medios de transporte"] },
  },
  {
    id: "relaciones-logico-matematicas",
    nombre: "Relaciones lógico-matemáticas",
    descripcion: "Contar, formas, colores y tamaños.",
    acento: "#2D7FF9",
    temas: { inicial: ["Colores primarios", "Figuras geométricas", "Contar del 1 al 10", "Grande y pequeño", "Arriba, abajo, dentro y fuera"] },
  },
  {
    id: "comprension-expresion-lenguaje",
    nombre: "Comprensión y expresión del lenguaje",
    descripcion: "Escuchar, hablar y jugar con palabras.",
    acento: "#8B5CF6",
    temas: { inicial: ["Sonidos de las vocales", "Rimas y canciones", "Cuentos infantiles", "Adivinanzas", "Pictogramas"] },
  },
  {
    id: "expresion-artistica",
    nombre: "Expresión artística",
    descripcion: "Música, colores y dramatización.",
    acento: "#D946EF",
    temas: { inicial: ["Colores y mezclas", "Instrumentos musicales", "Sonidos fuertes y suaves", "Títeres", "Danzas del Ecuador"] },
  },
  {
    id: "expresion-corporal",
    nombre: "Expresión corporal y motricidad",
    descripcion: "Moverme, jugar y conocer mi cuerpo.",
    acento: "#0EA5A4",
    temas: { inicial: ["Derecha e izquierda", "Juegos tradicionales", "Equilibrio", "Movimientos del cuerpo", "Cuidado al jugar"] },
  },

  /* ---------- EGB y BGU: asignaturas ---------- */
  {
    id: "lengua-literatura",
    nombre: "Lengua y Literatura",
    descripcion: "Lectura, escritura y literatura.",
    acento: "#8B5CF6",
    temas: {
      "egb-preparatoria": ["Las vocales", "Sonidos de las letras", "Cuentos y fábulas", "Rimas y trabalenguas", "Mi nombre"],
      "egb-elemental": ["Sustantivos y adjetivos", "Orden alfabético", "Uso de mayúsculas", "La fábula", "Sinónimos y antónimos"],
      "egb-media": ["Reglas de acentuación", "Signos de puntuación", "Sujeto y predicado", "Leyendas del Ecuador", "Textos instructivos"],
      "egb-superior": ["Figuras literarias", "Oraciones compuestas", "Textos argumentativos", "Mitos y leyendas", "Comprensión lectora inferencial"],
      bgu: ["Realismo mágico", "Literatura ecuatoriana", "Grupo de Guayaquil", "Textos argumentativos", "Movimientos literarios"],
    },
  },
  {
    id: "matematica",
    nombre: "Matemática",
    descripcion: "Números, álgebra, geometría y estadística.",
    acento: "#2D7FF9",
    temas: {
      "egb-preparatoria": ["Números del 1 al 20", "Figuras geométricas", "Sumas sencillas", "Patrones y secuencias", "Largo y corto"],
      "egb-elemental": ["Sumas y restas con llevadas", "Tablas de multiplicar", "Números hasta el 9 999", "Fracciones simples", "Medidas de tiempo"],
      "egb-media": ["Fracciones", "Números decimales", "Perímetro y área", "Múltiplos y divisores", "Proporcionalidad"],
      "egb-superior": ["Números enteros", "Ecuaciones de primer grado", "Teorema de Pitágoras", "Potencias y raíces", "Estadística y probabilidad"],
      bgu: ["Funciones lineales y cuadráticas", "Trigonometría", "Progresiones", "Derivadas", "Probabilidad"],
    },
  },
  {
    id: "ciencias-naturales",
    nombre: "Ciencias Naturales",
    descripcion: "Seres vivos, materia, energía y Tierra.",
    acento: "#22A45D",
    temas: {
      "egb-preparatoria": ["Los seres vivos", "Los cinco sentidos", "Animales de mi entorno", "El agua", "Cuidado de las plantas"],
      "egb-elemental": ["Ciclo de vida de las plantas", "Vertebrados e invertebrados", "Estados de la materia", "El ciclo del agua", "El sistema solar"],
      "egb-media": ["Sistema digestivo", "La célula", "Ecosistemas del Ecuador", "Fuerza y movimiento", "Mezclas y sustancias puras"],
      "egb-superior": ["Sistema nervioso", "Reproducción humana", "Biodiversidad de Galápagos", "Energía y sus transformaciones", "La tabla periódica"],
    },
  },
  {
    id: "estudios-sociales",
    nombre: "Estudios Sociales",
    descripcion: "Historia, geografía y convivencia.",
    acento: "#E0A100",
    temas: {
      "egb-preparatoria": ["Mi familia", "Mi escuela", "Mi barrio", "Símbolos patrios", "Normas de convivencia"],
      "egb-elemental": ["Mi provincia", "Regiones naturales del Ecuador", "Símbolos patrios del Ecuador", "Pueblos y nacionalidades", "Derechos de los niños"],
      "egb-media": ["Época aborigen del Ecuador", "Imperio incaico", "La Colonia", "Independencia del Ecuador", "Relieve e hidrografía del Ecuador"],
      "egb-superior": ["Revolución Liberal", "Ecuador republicano", "Derechos humanos", "Geografía de América Latina", "Globalización"],
    },
  },
  {
    id: "ingles",
    nombre: "Inglés",
    descripcion: "Lengua extranjera: vocabulario y gramática.",
    acento: "#DC2626",
    temas: {
      "egb-elemental": ["Colors and numbers", "Animals", "My family", "Classroom objects", "Greetings"],
      "egb-media": ["Daily routines", "Food and drinks", "Present simple", "Places in town", "Can and can't"],
      "egb-superior": ["Past simple", "Comparatives and superlatives", "Future with going to", "Hobbies and free time", "Reading comprehension"],
      bgu: ["Present perfect", "Conditionals", "Passive voice", "Reported speech", "Reading comprehension"],
    },
  },
  {
    id: "educacion-fisica",
    nombre: "Educación Física",
    descripcion: "Movimiento, deporte y salud.",
    acento: "#0EA5A4",
    temas: {
      "egb-preparatoria": ["Juegos tradicionales", "Desplazamientos", "Ritmo y movimiento", "Partes del cuerpo", "Higiene después de jugar"],
      "egb-elemental": ["Juegos tradicionales del Ecuador", "Habilidades motrices básicas", "Ritmo y danza", "Hidratación y salud", "Juego limpio"],
      "egb-media": ["Reglas del fútbol", "Reglas del ecuavóley", "Atletismo", "Calentamiento y estiramiento", "Alimentación y deporte"],
      "egb-superior": ["Reglas del baloncesto", "Capacidades físicas", "Primeros auxilios básicos", "Gimnasia", "Deporte y salud"],
      bgu: ["Planificación del entrenamiento", "Capacidades físicas condicionales", "Deportes colectivos", "Nutrición deportiva", "Prevención de lesiones"],
    },
  },
  {
    id: "educacion-cultural-artistica",
    nombre: "Educación Cultural y Artística",
    descripcion: "Música, artes visuales y patrimonio.",
    acento: "#D946EF",
    temas: {
      "egb-preparatoria": ["Colores primarios y secundarios", "Instrumentos musicales", "Canciones infantiles", "Títeres", "Dibujo y modelado"],
      "egb-elemental": ["Instrumentos andinos", "Artesanías del Ecuador", "El ritmo", "Teatro y dramatización", "Fiestas populares"],
      "egb-media": ["Patrimonio cultural del Ecuador", "El pasillo ecuatoriano", "Pintores ecuatorianos", "Elementos del dibujo", "Danza folclórica"],
      "egb-superior": ["Oswaldo Guayasamín", "Arte precolombino", "Lenguaje audiovisual", "Historia de la música", "Fotografía"],
      bgu: ["Movimientos artísticos", "Arte contemporáneo ecuatoriano", "Cine y lenguaje audiovisual", "Patrimonio material e inmaterial", "Diseño gráfico"],
    },
  },

  /* ---------- Solo Bachillerato ---------- */
  {
    id: "fisica",
    nombre: "Física",
    descripcion: "Movimiento, fuerzas, energía y ondas.",
    acento: "#2563EB",
    temas: { bgu: ["Cinemática", "Leyes de Newton", "Trabajo y energía", "Electricidad", "Ondas y sonido"] },
  },
  {
    id: "quimica",
    nombre: "Química",
    descripcion: "Materia, reacciones y compuestos.",
    acento: "#F97316",
    temas: { bgu: ["Tabla periódica", "Enlaces químicos", "Nomenclatura inorgánica", "Estequiometría", "Química orgánica"] },
  },
  {
    id: "biologia",
    nombre: "Biología",
    descripcion: "Célula, genética, evolución y ecología.",
    acento: "#16A34A",
    temas: { bgu: ["La célula", "Genética mendeliana", "Evolución", "Biodiversidad del Ecuador", "Sistema inmunológico"] },
  },
  {
    id: "historia",
    nombre: "Historia",
    descripcion: "Procesos históricos del Ecuador y el mundo.",
    acento: "#B45309",
    temas: { bgu: ["Origen de la humanidad", "Civilizaciones antiguas", "Revolución Francesa", "Independencia de América", "Guerra Fría"] },
  },
  {
    id: "educacion-ciudadania",
    nombre: "Educación para la Ciudadanía",
    descripcion: "Democracia, derechos y Estado.",
    acento: "#0891B2",
    temas: { bgu: ["Democracia", "Constitución del Ecuador", "Derechos y deberes", "Plurinacionalidad e interculturalidad", "Funciones del Estado"] },
  },
  {
    id: "filosofia",
    nombre: "Filosofía",
    descripcion: "Pensamiento crítico, lógica y ética.",
    acento: "#7C3AED",
    temas: { bgu: ["¿Qué es la filosofía?", "Filósofos griegos", "Lógica y argumentación", "Ética y moral", "Filosofía latinoamericana"] },
  },
  {
    id: "emprendimiento-gestion",
    nombre: "Emprendimiento y Gestión",
    descripcion: "Ideas de negocio y finanzas.",
    acento: "#059669",
    temas: { bgu: ["Idea de negocio", "Plan de negocios", "Marketing básico", "Costos e ingresos", "Educación financiera"] },
  },
];

/* ----------------------------- Consultas ---------------------------------- */

export function obtenerNivel(id: NivelId): NivelInfo {
  const nivel = NIVELES_INFO.find((n) => n.id === id);
  if (!nivel) throw new Error(`Nivel desconocido: ${id}`);
  return nivel;
}

export function obtenerGrado(id: GradoId): GradoInfo {
  const grado = GRADOS_INFO.find((g) => g.id === id);
  if (!grado) throw new Error(`Grado desconocido: ${id}`);
  return grado;
}

export function obtenerArea(id: AreaId): AreaInfo {
  const area = AREAS_INFO.find((a) => a.id === id);
  if (!area) throw new Error(`Asignatura desconocida: ${id}`);
  return area;
}

export function buscarArea(id: string): AreaInfo | undefined {
  return AREAS_INFO.find((a) => a.id === id);
}

export function gradosDeNivel(nivel: NivelId): GradoInfo[] {
  return GRADOS_INFO.filter((g) => g.nivel === nivel);
}

export function areasDeGrado(grado: GradoId): AreaInfo[] {
  const etapa = obtenerGrado(grado).etapa;
  return AREAS_INFO.filter((a) => a.temas[etapa] !== undefined);
}

export function areaDisponible(area: AreaId, grado: GradoId): boolean {
  return obtenerArea(area).temas[obtenerGrado(grado).etapa] !== undefined;
}

export function temasSugeridos(area: AreaId, grado: GradoId): string[] {
  return obtenerArea(area).temas[obtenerGrado(grado).etapa] ?? [];
}

/** Texto compacto para mostrar: "Matemática · 5.º de EGB". */
export function etiquetaConfig(c: { area: AreaId; grado: GradoId }): string {
  return `${obtenerArea(c.area).nombre} · ${obtenerGrado(c.grado).nombre}`;
}
