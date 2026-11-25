/**
 * Lectura local de PDFs (solo servidor) con pdf-parse.
 *
 * Objetivo: ahorrar tokens. El texto se extrae en el servidor y los temas se
 * detectan con reglas (marcadores del PDF, títulos «Unidad / Tema / Capítulo»
 * o la lista de «Contenidos / Destrezas»). Solo si no se encuentra estructura
 * se envía a Gemini un extracto acotado del texto, nunca el libro completo.
 * Cada tema guarda su propio fragmento del documento para generar la lección.
 */
import { createHash } from "node:crypto";
import { PDFParse } from "pdf-parse";
import { CONTEXTO_MAX } from "@/lib/validators";

/** Páginas máximas que se leen (un libro escolar completo cabe de sobra). */
export const MAX_PAGINAS_LECTURA = 400;
/** Tamaño del fragmento de cada tema que se reenvía al generar la lección. */
const CONTEXTO_TEMA = Math.min(3500, CONTEXTO_MAX);
/** Máximo de texto que se envía al modelo cuando no hay estructura detectable. */
export const MAX_TEXTO_IA = 12000;
const MAX_TEMAS = 10;

export interface PdfExtraido {
  total: number;
  leidas: number;
  /** Texto limpio por página (sin encabezados/pies repetidos ni números de página). */
  paginas: string[];
  /** Títulos de los marcadores del PDF (si los tiene). */
  marcadores: string[];
  tituloMeta: string;
}

export class PdfLecturaError extends Error {
  constructor(
    public readonly code: "PROTEGIDO" | "DANADO",
    message: string,
  ) {
    super(message);
    this.name = "PdfLecturaError";
  }
}

/* --------------------------------- Lectura -------------------------------- */

interface NodoMarcador {
  title: string;
  items?: NodoMarcador[];
}

function aplanarMarcadores(nodos: NodoMarcador[] | null | undefined): string[] {
  if (!nodos?.length) return [];
  // Un único nodo raíz (p. ej. el título del libro) → usar sus hijos.
  let nivel = nodos;
  while (nivel.length === 1 && nivel[0]?.items?.length) nivel = nivel[0].items;
  return nivel.map((n) => limpiarLinea(n.title ?? "")).filter((t) => t.length >= 3);
}

export async function extraerPdf(bytes: Buffer): Promise<PdfExtraido> {
  const parser = new PDFParse({ data: new Uint8Array(bytes), verbosity: 0 });
  try {
    const info = await parser.getInfo();
    const texto = await parser.getText({ first: MAX_PAGINAS_LECTURA });
    const crudas = texto.pages.sort((a, b) => a.num - b.num).map((p) => p.text ?? "");
    const meta = (info.info as { Title?: unknown } | undefined)?.Title;
    return {
      total: texto.total,
      leidas: crudas.length,
      paginas: limpiarPaginas(crudas),
      marcadores: aplanarMarcadores(info.outline as NodoMarcador[] | null | undefined),
      tituloMeta: typeof meta === "string" ? limpiarLinea(meta) : "",
    };
  } catch (e) {
    const nombre = (e as { name?: string })?.name ?? "";
    if (nombre === "PasswordException") {
      throw new PdfLecturaError("PROTEGIDO", "El PDF está protegido con contraseña.");
    }
    throw new PdfLecturaError("DANADO", "No se pudo leer el PDF; puede estar dañado.");
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

/* --------------------------------- Limpieza ------------------------------- */

function limpiarLinea(l: string): string {
  return l
    .normalize("NFC")
    .replace(/[\p{Cc}\p{Cf}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Clave de comparación: minúsculas, sin tildes ni dígitos. */
function claveLinea(l: string): string {
  return quitarTildes(l.toLowerCase()).replace(/\d+/g, "#");
}

function quitarTildes(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").normalize("NFC");
}

function limpiarPaginas(paginas: string[]): string[] {
  const lineas = paginas.map((p) => p.split("\n").map(limpiarLinea).filter(Boolean));
  // Encabezados y pies que se repiten en muchas páginas.
  const conteo = new Map<string, number>();
  for (const ls of lineas) for (const k of new Set(ls.map(claveLinea))) conteo.set(k, (conteo.get(k) ?? 0) + 1);
  const umbral = paginas.length >= 6 ? Math.max(3, paginas.length * 0.3) : Number.POSITIVE_INFINITY;
  return lineas.map((ls) =>
    ls
      .filter(
        (l) =>
          !/^\d{1,4}$/.test(l) &&
          !/^(p[áa]g(ina)?\.?\s*)?\d{1,4}\s*(de|\/)\s*\d{1,4}$/i.test(l) &&
          !/^-+\s*\d{1,4}\s*-+$/.test(l) &&
          (conteo.get(claveLinea(l)) ?? 0) < umbral,
      )
      .join("\n"),
  );
}

/** Caracteres de texto real por página: si es muy bajo, el PDF es escaneado. */
export function esEscaneado(pdf: PdfExtraido): boolean {
  const total = pdf.paginas.reduce((n, p) => n + p.replace(/\s/g, "").length, 0);
  return total < 120 || total / Math.max(1, pdf.leidas) < 40;
}

/* ---------------------------- Detección de temas -------------------------- */

export type FuenteTemas = "marcadores" | "titulos" | "contenidos";

interface Candidato {
  titulo: string;
  descripcion: string;
  /** Texto que se busca en el documento para ubicar el fragmento del tema. */
  ancla: string;
}

function recortar(t: string, max: number): string {
  if (t.length <= max) return t;
  const corte = t.slice(0, max - 1);
  const espacio = corte.lastIndexOf(" ");
  return `${(espacio > max * 0.6 ? corte.slice(0, espacio) : corte).replace(/[\s,;:.\-–—]+$/, "")}…`;
}

/** Quita líneas de puntos del índice y el número de página final. */
function limpiarTitulo(t: string, quitarPagina = true): string {
  return t
    .replace(/\s*(\.{2,}|…+|_{2,})\s*\d*\s*$/, "")
    .replace(quitarPagina ? /(\p{L}{3,}[^\d]*)\s+\d{1,4}$/u : /$^/, "$1")
    .replace(/^[\s.:\-–—]+|[\s.:\-–—]+$/g, "")
    .trim();
}

function deduplicar(cs: Candidato[]): Candidato[] {
  const vistos = new Set<string>();
  return cs.filter((c) => {
    const k = claveLinea(c.titulo);
    if (!c.titulo || vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
}

/** A) Marcadores (outline) del PDF: típicos de libros y guías digitales. */
function desdeMarcadores(pdf: PdfExtraido): Candidato[] {
  const cs = deduplicar(
    pdf.marcadores
      .map((t) => limpiarTitulo(t, false))
      .filter(
        (t) =>
          t.length >= 3 &&
          !/^(portada|indice|contenidos?|creditos|presentacion|bibliografia|anexos?|glosario)$/i.test(quitarTildes(t)) &&
          // «Unidad 1» sin nombre no sirve como tema: se usan los títulos del texto.
          !/^(unidad|tema|capitulo|leccion|bloque|modulo|semana|parcial)\s+\w{1,5}$/i.test(quitarTildes(t)),
      )
      .map((t) => ({ titulo: recortar(t, 90), descripcion: "Sección del documento", ancla: t })),
  );
  return cs.length >= 2 ? cs : [];
}

const RE_ENCABEZADO =
  /^(unidad|tema|cap[ií]tulo|lecci[oó]n|bloque|m[oó]dulo|semana|parcial)\s+(\d{1,2}|[ivxl]{1,5})\b\s*[.:\-–—]?\s*(.*)$/i;
const PRIORIDAD_ENCABEZADO = ["unidad", "capitulo", "bloque", "modulo", "parcial", "tema", "leccion", "semana"];

/** B) Títulos «Unidad 1: …», «Tema 2. …», «Capítulo 3 …» (también en el índice). */
function desdeTitulos(pdf: PdfExtraido): Candidato[] {
  const grupos = new Map<string, Map<string, Candidato>>();
  for (const pagina of pdf.paginas) {
    const ls = pagina.split("\n");
    ls.forEach((linea, i) => {
      if (linea.length > 140) return;
      const m = linea.match(RE_ENCABEZADO);
      if (!m) return;
      const tipo = quitarTildes(m[1].toLowerCase());
      const numero = m[2].toUpperCase();
      let resto = limpiarTitulo(m[3] ?? "");
      // «Unidad 1» sola en una línea: el título suele estar en la siguiente.
      const siguiente = ls[i + 1] ? limpiarTitulo(ls[i + 1]) : "";
      if (!resto && siguiente && siguiente.length <= 90 && !RE_ENCABEZADO.test(siguiente)) resto = siguiente;
      if (resto && !/[\p{L}]{3,}/u.test(resto)) resto = "";
      const etiqueta = `${m[1][0].toUpperCase()}${m[1].slice(1).toLowerCase()} ${numero}`;
      const grupo = grupos.get(tipo) ?? new Map<string, Candidato>();
      const previo = grupo.get(numero);
      // Conservar la versión con el título más completo (índice vs. cuerpo).
      if (!previo || (resto && previo.titulo === etiqueta)) {
        grupo.set(numero, {
          titulo: recortar(resto || etiqueta, 90),
          descripcion: resto ? etiqueta : "Sección del documento",
          // «Unidad 1 Título»: coincide igual en el índice y en el cuerpo.
          ancla: resto ? `${etiqueta} ${resto}` : etiqueta,
        });
      }
      grupos.set(tipo, grupo);
    });
  }
  for (const tipo of PRIORIDAD_ENCABEZADO) {
    const grupo = grupos.get(tipo);
    if (grupo && grupo.size >= 2) return deduplicar([...grupo.values()]);
  }
  return [];
}

const RE_SECCION_LISTA =
  /^(contenidos?|temas?|temario|[íi]ndice|destrezas|conocimientos|saberes|aprendizajes|objetivos espec[íi]ficos)\b[^.]{0,60}:?$/i;
const RE_ITEM = /^(?:(\d{1,2}|[a-h])[.)]|[•●▪◦\-–*]|([A-Z]{1,4}\.(?:\d+\.){1,4}\d+\.?))\s+(.{4,})$/;
const PRIORIDAD_SECCION = ["contenido", "tema", "temario", "indice", "saberes", "conocimientos", "aprendizajes", "destrezas", "objetivos"];

function partirItem(texto: string, codigo?: string): Candidato {
  const limpio = limpiarTitulo(texto);
  const m = limpio.match(/^(.{6,80}?)[:;.]\s+(.{3,})$/);
  if (m) {
    return { titulo: m[1].trim(), descripcion: recortar(`${codigo ? `${codigo} ` : ""}${m[2].trim()}`, 220), ancla: limpio };
  }
  return {
    titulo: recortar(limpio, 90),
    descripcion: limpio.length > 90 ? recortar(limpio, 220) : codigo ? `Destreza ${codigo}` : "Contenido de la planificación",
    ancla: limpio,
  };
}

/** C) Lista numerada o con viñetas bajo «Contenidos», «Temas», «Destrezas»… */
function desdeContenidos(pdf: PdfExtraido): Candidato[] {
  const lineas = pdf.paginas.join("\n").split("\n");
  const bloques: { tipo: string; items: Candidato[] }[] = [];
  for (let i = 0; i < lineas.length; i++) {
    const cab = lineas[i];
    if (cab.length > 80 || !RE_SECCION_LISTA.test(cab)) continue;
    const tipo = PRIORIDAD_SECCION.find((p) => quitarTildes(cab.toLowerCase()).startsWith(p)) ?? "otros";
    const textos: { texto: string; codigo?: string }[] = [];
    for (let j = i + 1; j < lineas.length && textos.length < 20; j++) {
      const l = lineas[j];
      const m = l.match(RE_ITEM);
      if (m) {
        textos.push({ texto: m[3], codigo: m[2]?.replace(/\.$/, "") });
        continue;
      }
      const ultimo = textos[textos.length - 1];
      // Línea partida de un ítem largo.
      if (ultimo && l.length > 0 && !RE_SECCION_LISTA.test(l) && (!/[.:;]$/.test(ultimo.texto) || /^\p{Ll}/u.test(l))) {
        ultimo.texto = `${ultimo.texto} ${l}`;
        continue;
      }
      if (textos.length === 0 && j - i <= 2) continue; // subtítulo entre la cabecera y la lista
      break;
    }
    if (textos.length >= 2) bloques.push({ tipo, items: textos.map((t) => partirItem(t.texto, t.codigo)) });
  }
  bloques.sort((a, b) => PRIORIDAD_SECCION.indexOf(a.tipo) - PRIORIDAD_SECCION.indexOf(b.tipo));
  return bloques.length ? deduplicar(bloques[0].items) : [];
}

/* ------------------------------ Fragmentos -------------------------------- */

/** Texto en una sola línea y su versión para búsquedas (misma longitud). */
function prepararBusqueda(paginas: string[]): { plano: string; busqueda: string } {
  const plano = paginas.join("\n").replace(/[ \t]+/g, " ").replace(/\n+/g, "\n").trim();
  const sinTildes = quitarTildes(plano.toLowerCase());
  const busqueda = sinTildes.length === plano.length ? sinTildes : plano.toLowerCase();
  // Los saltos de línea cuentan como espacios (los ítems partidos se unen).
  return { plano, busqueda: busqueda.replace(/\n/g, " ") };
}

/** Si el texto es largo, toma trozos repartidos de principio a fin. */
export function muestrear(texto: string, max: number, trozos = 5): string {
  const t = texto.trim();
  if (t.length <= max) return t;
  const tam = Math.floor(max / trozos) - 4;
  const paso = (t.length - tam) / (trozos - 1);
  const partes: string[] = [];
  for (let k = 0; k < trozos; k++) {
    let inicio = Math.floor(k * paso);
    if (k > 0) {
      const esp = t.indexOf(" ", inicio);
      if (esp !== -1 && esp - inicio < 40) inicio = esp + 1;
    }
    let parte = t.slice(inicio, inicio + tam);
    const ultimoEsp = parte.lastIndexOf(" ");
    if (ultimoEsp > tam * 0.8) parte = parte.slice(0, ultimoEsp);
    partes.push(parte.trim());
  }
  return partes.join(" … ");
}

const SEPARADOR = /[^\p{L}\p{N}]+/u;

/** Busca la frase palabra por palabra, sin importar la puntuación entre ellas. */
function posiciones(busqueda: string, aguja: string): number[] {
  const palabras = aguja.split(SEPARADOR).filter(Boolean).slice(0, 8);
  if (palabras.join("").length < 3) return [];
  // Las palabras solo contienen letras y números: no hace falta escaparlas.
  const re = new RegExp(palabras.join(SEPARADOR.source), "gu");
  const res: number[] = [];
  for (const m of busqueda.matchAll(re)) {
    res.push(m.index ?? 0);
    if (res.length >= 50) break;
  }
  return res;
}

function claveBusqueda(t: string): string {
  return quitarTildes(t.toLowerCase()).replace(/…$/, "").trim();
}

/**
 * Para cada tema, ubica su sección en el documento (la aparición seguida de más
 * texto, así se descarta la entrada del índice) y devuelve un fragmento acotado.
 */
export function fragmentosPorTema(paginas: string[], anclas: string[]): (string | undefined)[] {
  const { plano, busqueda } = prepararBusqueda(paginas);
  if (plano.length <= CONTEXTO_TEMA) return anclas.map(() => plano);
  const claves = anclas.map(claveBusqueda);
  const todas = claves.map((k) => posiciones(busqueda, k));
  return claves.map((_, i) => {
    let mejor = { inicio: -1, fin: -1 };
    for (const p of todas[i]) {
      let fin = plano.length;
      todas.forEach((ps, j) => {
        if (j === i) return;
        for (const q of ps) if (q > p && q < fin) fin = q;
      });
      if (fin - p > mejor.fin - mejor.inicio) mejor = { inicio: p, fin };
    }
    if (mejor.inicio < 0) return undefined;
    let segmento = plano.slice(mejor.inicio, mejor.fin);
    // Secciones muy cortas (ítem de una lista): incluir el texto que las rodea.
    if (segmento.length < 800) {
      const desde = Math.max(0, mejor.inicio - 600);
      segmento = plano.slice(desde, Math.min(plano.length, desde + 2200));
    }
    return muestrear(segmento.replace(/\n/g, " "), CONTEXTO_TEMA);
  });
}

/* ------------------------------ Análisis local ---------------------------- */

export interface TemaLocal {
  titulo: string;
  descripcion: string;
  contexto?: string;
}

export interface AnalisisLocal {
  fuente: FuenteTemas;
  titulo: string;
  resumen: string;
  contexto: string;
  temas: TemaLocal[];
}

function tituloDocumento(pdf: PdfExtraido, nombreArchivo: string): string {
  const primeras = pdf.paginas.slice(0, 2).join("\n").split("\n");
  // En una planificación corta, la línea «Unidad N: …» es el mejor título;
  // en un libro esa línea es la primera entrada del índice.
  const corto = pdf.leidas <= 8;
  const unidad = corto
    ? primeras.map((l) => l.match(/(unidad\s+(\d{1,2}|[ivx]{1,4})\s*[:.\-–—]\s*\S.{2,})/i)?.[1]).find(Boolean)
    : undefined;
  if (unidad) return recortar(limpiarTitulo(unidad), 100);
  if (pdf.tituloMeta.length >= 4 && !/\.(docx?|pdf|pptx?)$|microsoft|untitled|sin t[íi]tulo/i.test(pdf.tituloMeta)) {
    return recortar(pdf.tituloMeta, 100);
  }
  const util = primeras.find((l) => l.length >= 6 && l.length <= 100 && /[\p{L}]{4,}/u.test(l));
  if (util) return recortar(util, 100);
  return recortar(nombreArchivo.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim() || "Planificación", 100);
}

const DESCRIPCION_FUENTE: Record<FuenteTemas, string> = {
  marcadores: "los marcadores del documento",
  titulos: "los títulos de unidades y temas",
  contenidos: "la lista de contenidos",
};

/** Detecta los temas sin usar el modelo. Devuelve null si no hay estructura clara. */
export function analizarLocalmente(pdf: PdfExtraido, nombreArchivo: string): AnalisisLocal | null {
  const corto = pdf.leidas <= 8;
  const estrategias: [FuenteTemas, (p: PdfExtraido) => Candidato[]][] = corto
    ? [["contenidos", desdeContenidos], ["titulos", desdeTitulos], ["marcadores", desdeMarcadores]]
    : [["marcadores", desdeMarcadores], ["titulos", desdeTitulos], ["contenidos", desdeContenidos]];

  for (const [fuente, detectar] of estrategias) {
    const candidatos = detectar(pdf).slice(0, MAX_TEMAS);
    if (candidatos.length < 2) continue;

    const fragmentos = fragmentosPorTema(pdf.paginas, candidatos.map((c) => c.ancla));
    // Si casi ningún tema aparece en el texto, la estructura no es fiable.
    if (fragmentos.filter(Boolean).length < Math.ceil(candidatos.length / 2)) continue;

    const { plano } = prepararBusqueda(pdf.paginas);
    const contexto =
      plano.length <= CONTEXTO_TEMA
        ? plano
        : muestrear(fragmentos.filter(Boolean).map((f) => (f ?? "").slice(0, 700)).join(" … "), CONTEXTO_TEMA, 4);

    const objetivo = !corto ? undefined : plano.match(/objetivos?(?: general(?:es)?| de (?:la )?unidad)?\s*[:\n]?\s*([^\n]{20,240})/i)?.[1];
    const resumen = [
      `Se identificaron ${candidatos.length} temas a partir de ${DESCRIPCION_FUENTE[fuente]}.`,
      objetivo ? `Objetivo: ${recortar(objetivo.trim(), 220)}` : "",
    ]
      .filter(Boolean)
      .join(" ");

    return {
      fuente,
      titulo: tituloDocumento(pdf, nombreArchivo),
      resumen,
      contexto: contexto || plano.slice(0, CONTEXTO_TEMA),
      temas: candidatos.map((c, i) => ({ titulo: c.titulo, descripcion: c.descripcion, contexto: fragmentos[i] })),
    };
  }
  return null;
}

/**
 * Extracto acotado para el modelo cuando no hay estructura: el inicio del
 * documento, las líneas que parecen títulos y muestras del resto.
 */
export function extractoParaModelo(pdf: PdfExtraido): string {
  const { plano } = prepararBusqueda(pdf.paginas);
  if (plano.length <= MAX_TEXTO_IA) return plano;
  const inicio = plano.slice(0, 5000);
  const titulos: string[] = [];
  let largo = 0;
  const vistos = new Set<string>();
  for (const l of plano.slice(5000).split("\n")) {
    if (l.length < 4 || l.length > 90 || /[.,;]$/.test(l) || !/^[\p{Lu}\d]/u.test(l)) continue;
    const k = claveLinea(l);
    if (vistos.has(k)) continue;
    vistos.add(k);
    titulos.push(l);
    largo += l.length + 1;
    if (largo > 3500) break;
  }
  const resto = MAX_TEXTO_IA - inicio.length - largo - 200;
  return [
    inicio,
    "[Títulos encontrados en el resto del documento]",
    titulos.join("\n"),
    "[Muestras del resto del documento]",
    muestrear(plano.slice(5000).replace(/\n/g, " "), Math.max(1000, resto), 6),
  ].join("\n");
}

/* --------------------------------- Caché ---------------------------------- */

interface EntradaCache<T> {
  valor: T;
  expira: number;
}
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX = 40;
const cache = new Map<string, EntradaCache<unknown>>();

export function claveCache(bytes: Buffer, ...extra: string[]): string {
  return createHash("sha256").update(bytes).update(extra.join("|")).digest("hex");
}

export function leerCache<T>(clave: string): T | undefined {
  const e = cache.get(clave);
  if (!e) return undefined;
  if (e.expira < Date.now()) {
    cache.delete(clave);
    return undefined;
  }
  return e.valor as T;
}

export function guardarCache<T>(clave: string, valor: T): void {
  if (cache.size >= CACHE_MAX) {
    const masAntigua = cache.keys().next().value;
    if (masAntigua !== undefined) cache.delete(masAntigua);
  }
  cache.set(clave, { valor, expira: Date.now() + CACHE_TTL_MS });
}
