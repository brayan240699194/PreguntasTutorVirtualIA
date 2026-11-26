import { AREAS_INFO } from "@/lib/catalogo";
import type { AreaId } from "@/types/quiz";

/* =============================================================================
 * Detecta de qué asignatura es una planificación a partir de su texto, sin IA:
 *  1. la línea «Área: …» / «Asignatura: …» del encabezado,
 *  2. los códigos de destrezas del MINEDUC (M.4.1.1, CN.4.1.1, LL.4.1.1…),
 *  3. vocabulario propio de cada asignatura.
 * Solo devuelve un resultado cuando la evidencia es clara.
 * ========================================================================== */

function normalizar(t: string): string {
  return t
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

/** Prefijos de los códigos de destrezas con criterios de desempeño del MINEDUC. */
const PREFIJOS: [RegExp, AreaId][] = [
  [/\bCN\.F\.\d/g, "fisica"],
  [/\bCN\.Q\.\d/g, "quimica"],
  [/\bCN\.B\.\d/g, "biologia"],
  [/\bCS\.H\.\d/g, "historia"],
  [/\bCS\.EC\.\d/g, "educacion-ciudadania"],
  [/\bCS\.F\.\d/g, "filosofia"],
  [/\bCN\.\d/g, "ciencias-naturales"],
  [/\bCS\.\d/g, "estudios-sociales"],
  [/\bLL\.\d/g, "lengua-literatura"],
  [/\bM\.\d\.\d/g, "matematica"],
  [/\bEFL\.?\s?\d/g, "ingles"],
  [/\bEF\.\d/g, "educacion-fisica"],
  [/\bECA\.\d/g, "educacion-cultural-artistica"],
  [/\bEG\.\d/g, "emprendimiento-gestion"],
];

/** Nombres y sinónimos que pueden aparecer en «Área: …». */
const NOMBRES: [RegExp, AreaId][] = [
  [/matematica/, "matematica"],
  // Antes que «lengua»: «Lengua extranjera» es Inglés.
  [/ingles|english|lengua extranjera/, "ingles"],
  [/lengua|literatura/, "lengua-literatura"],
  [/ciencias naturales|ciencias de la naturaleza/, "ciencias-naturales"],
  [/estudios sociales|ciencias sociales/, "estudios-sociales"],
  [/educacion fisica/, "educacion-fisica"],
  [/cultural y artistica|artistica|\barte\b/, "educacion-cultural-artistica"],
  [/\bfisica\b/, "fisica"],
  [/quimica/, "quimica"],
  [/biologia/, "biologia"],
  [/historia/, "historia"],
  [/ciudadania/, "educacion-ciudadania"],
  [/filosofia/, "filosofia"],
  [/emprendimiento/, "emprendimiento-gestion"],
];

/** Vocabulario característico (sin tildes, en minúsculas). */
const VOCABULARIO: Partial<Record<AreaId, string[]>> = {
  matematica: ["ecuacion", "fraccion", "numerador", "denominador", "suma", "resta", "multiplicacion", "division", "porcentaje", "perimetro", "area", "angulo", "triangulo", "polinomio", "funcion", "algebra", "geometria", "estadistica", "probabilidad", "numeros enteros", "potencia", "raiz cuadrada", "teorema", "derivada"],
  "lengua-literatura": ["sustantivo", "adjetivo", "verbo", "oracion", "sujeto", "predicado", "ortografia", "acentuacion", "tilde", "puntuacion", "lectura", "escritura", "texto narrativo", "cuento", "fabula", "leyenda", "poema", "poesia", "literatura", "figuras literarias", "metafora", "comprension lectora", "sinonimo", "antonimo", "parrafo"],
  "ciencias-naturales": ["celula", "ser vivo", "seres vivos", "ecosistema", "fotosintesis", "materia", "energia", "sistema digestivo", "sistema nervioso", "organismo", "especie", "biodiversidad", "experimento", "ciclo del agua", "planeta", "vertebrado", "invertebrado", "nutricion", "respiracion", "mezcla"],
  "estudios-sociales": ["historia", "geografia", "provincia", "region", "independencia", "colonia", "pueblos", "nacionalidades", "constitucion", "democracia", "ciudadania", "mapa", "relieve", "simbolos patrios", "cultura", "sociedad", "economia", "aborigen", "republica", "derechos"],
  ingles: ["vocabulary", "grammar", "present simple", "past simple", "reading", "listening", "speaking", "writing", "verb to be", "pronouns", "the", "and", "you", "is", "are"],
  "educacion-fisica": ["calentamiento", "estiramiento", "deporte", "futbol", "baloncesto", "voleibol", "ecuavoley", "atletismo", "resistencia", "velocidad", "flexibilidad", "motricidad", "juegos", "gimnasia", "salto", "carrera"],
  "educacion-cultural-artistica": ["musica", "ritmo", "melodia", "instrumento", "dibujo", "pintura", "color", "danza", "teatro", "escultura", "artistas", "patrimonio", "artesania", "expresion artistica", "canto"],
  fisica: ["cinematica", "dinamica", "fuerza", "aceleracion", "velocidad", "newton", "energia cinetica", "trabajo", "potencia", "ondas", "electricidad", "corriente", "voltaje", "magnetismo", "movimiento rectilineo"],
  quimica: ["atomo", "molecula", "tabla periodica", "enlace", "reaccion quimica", "estequiometria", "mol", "elemento", "compuesto", "oxido", "acido", "base", "nomenclatura", "valencia", "electrones"],
  biologia: ["celula", "adn", "genetica", "mendel", "evolucion", "ecologia", "mitosis", "meiosis", "proteinas", "tejido", "organo", "sistema inmunologico", "herencia", "cromosoma"],
  historia: ["historia", "civilizacion", "revolucion", "imperio", "guerra", "siglo", "edad media", "antiguedad", "colonizacion", "independencia", "fuentes historicas"],
  "educacion-ciudadania": ["ciudadania", "democracia", "constitucion", "derechos", "deberes", "estado", "participacion", "interculturalidad", "plurinacionalidad", "funciones del estado"],
  filosofia: ["filosofia", "filosofo", "logica", "etica", "moral", "argumento", "razon", "conocimiento", "socrates", "platon", "aristoteles", "falacia"],
  "emprendimiento-gestion": ["emprendimiento", "negocio", "mercado", "cliente", "producto", "precio", "costos", "ingresos", "marketing", "plan de negocios", "empresa", "contabilidad", "ahorro"],
};

/** Asignaturas que, aunque se llamen distinto, cubren el mismo contenido. */
const FAMILIAS: AreaId[][] = [
  ["ciencias-naturales", "fisica", "quimica", "biologia"],
  ["estudios-sociales", "historia", "educacion-ciudadania", "filosofia"],
];

export function areasCompatibles(a: AreaId, b: AreaId): boolean {
  return a === b || FAMILIAS.some((f) => f.includes(a) && f.includes(b));
}

export function nombreArea(id: AreaId): string {
  return AREAS_INFO.find((a) => a.id === id)?.nombre ?? id;
}

/** Devuelve la asignatura de la planificación, o null si no está clara. */
export function detectarAsignatura(texto: string): AreaId | null {
  if (!texto || texto.length < 80) return null;
  const inicio = normalizar(texto.slice(0, 4000));

  // 1. Encabezado explícito: «Área: Matemática», «Asignatura: Lengua y Literatura».
  for (const m of inicio.matchAll(/(?:area|asignatura|materia)(?: de conocimiento| academica)?\s*[:\-–]\s*([^\n|]{3,60})/g)) {
    const valor = m[1] ?? "";
    for (const [re, id] of NOMBRES) if (re.test(valor)) return id;
  }

  // 2. Códigos de destrezas: muy fiables cuando hay varios.
  const conteoCodigos = new Map<AreaId, number>();
  for (const [re, id] of PREFIJOS) {
    // «CN.\d» no coincide con «CN.F.5»: cada código cuenta una sola vez.
    const n = texto.match(re)?.length ?? 0;
    if (n > 0) conteoCodigos.set(id, (conteoCodigos.get(id) ?? 0) + n);
  }
  const codigos = [...conteoCodigos.entries()].sort((a, b) => b[1] - a[1]);
  if (codigos[0] && codigos[0][1] >= 2 && codigos[0][1] >= 2 * (codigos[1]?.[1] ?? 0)) return codigos[0][0];

  // 3. Vocabulario: hace falta una ventaja clara sobre la segunda asignatura.
  const cuerpo = normalizar(texto.slice(0, 60000));
  const palabras = cuerpo.split(/[^a-z0-9ñ]+/).filter(Boolean).length || 1;
  const puntajes = Object.entries(VOCABULARIO).map(([id, lista]) => {
    let n = 0;
    for (const termino of lista ?? []) {
      const re = new RegExp(`(?<![a-zñ])${termino}(?:s|es)?(?![a-zñ])`, "g");
      n += Math.min(8, cuerpo.match(re)?.length ?? 0);
    }
    return { id: id as AreaId, n };
  });
  // El inglés se detecta por la proporción de palabras inglesas comunes.
  const ingles = puntajes.find((p) => p.id === "ingles");
  if (ingles) ingles.n = ingles.n / palabras > 0.04 ? ingles.n : 0;

  puntajes.sort((a, b) => b.n - a.n);
  const primero = puntajes[0];
  if (!primero || primero.n < 6) return null;
  // La competencia es la mejor asignatura de OTRA familia (Biología no compite con Ciencias).
  const rival = puntajes.find((p) => !areasCompatibles(primero.id, p.id))?.n ?? 0;
  return primero.n >= 2 * rival ? primero.id : null;
}
