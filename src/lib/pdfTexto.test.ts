import { describe, expect, it } from "vitest";
import { analizarLocalmente, esEscaneado, fragmentosPorTema, muestrear, type PdfExtraido } from "@/lib/pdfTexto";

const relleno = (tema: string) =>
  Array.from({ length: 40 }, (_, i) => `Explicación ${i} sobre ${tema} con ejemplos y actividades para el aula.`).join("\n");

function pdf(paginas: string[], extra: Partial<PdfExtraido> = {}): PdfExtraido {
  return { total: paginas.length, leidas: paginas.length, paginas, marcadores: [], tituloMeta: "", ...extra };
}

describe("esEscaneado", () => {
  it("detecta un PDF sin texto", () => {
    expect(esEscaneado(pdf(["", " ", "12"]))).toBe(true);
  });

  it("no marca como escaneado un PDF con texto", () => {
    expect(esEscaneado(pdf([relleno("los ecosistemas")]))).toBe(false);
  });
});

describe("analizarLocalmente", () => {
  it("detecta los temas a partir de títulos «Unidad N: …»", () => {
    const paginas = [
      "Libro de Ciencias Naturales",
      `Unidad 1: Los ecosistemas\n${relleno("los ecosistemas")}`,
      `Unidad 2: La célula\n${relleno("la célula")}`,
      `Unidad 3: El agua\n${relleno("el agua")}`,
      relleno("repaso"),
      relleno("evaluación"),
      relleno("anexos"),
      relleno("glosario"),
      relleno("bibliografía"),
    ];
    const r = analizarLocalmente(pdf(paginas), "ciencias.pdf");
    expect(r).not.toBeNull();
    expect(r!.fuente).toBe("titulos");
    expect(r!.temas.map((t) => t.titulo)).toEqual(["Los ecosistemas", "La célula", "El agua"]);
    // Cada tema trae su propio fragmento del documento.
    expect(r!.temas[1]!.contexto).toContain("la célula");
    expect(r!.temas[1]!.contexto).not.toContain("los ecosistemas");
  });

  // Nota: un ítem sin puntuación final absorbe la línea siguiente (heurística de
  // ítems partidos en dos líneas), por eso la lista termina cada ítem con punto.
  it("usa la lista de «Contenidos» en una planificación corta", () => {
    const paginas = [
      [
        "Planificación microcurricular",
        "Contenidos:",
        "1. Números fraccionarios: lectura y escritura.",
        "2. Suma de fracciones homogéneas.",
        "3. Resta de fracciones homogéneas.",
        "Números fraccionarios y su representación gráfica en la recta.",
        "Suma de fracciones homogéneas con material concreto.",
        "Resta de fracciones homogéneas en problemas cotidianos.",
      ].join("\n"),
    ];
    const r = analizarLocalmente(pdf(paginas), "plan.pdf");
    expect(r?.fuente).toBe("contenidos");
    expect(r?.temas.map((t) => t.titulo)).toEqual([
      "Números fraccionarios",
      "Suma de fracciones homogéneas",
      "Resta de fracciones homogéneas",
    ]);
  });

  it("devuelve null si no hay estructura reconocible", () => {
    expect(analizarLocalmente(pdf([relleno("varios temas sin títulos")]), "x.pdf")).toBeNull();
  });
});

describe("fragmentosPorTema", () => {
  it("devuelve undefined para un tema que no aparece", () => {
    const paginas = [relleno("los ecosistemas"), relleno("la célula")];
    const [a, b] = fragmentosPorTema(paginas, ["sobre los ecosistemas", "tema inexistente xyz"]);
    expect(a).toBeDefined();
    expect(b).toBeUndefined();
  });
});

describe("muestrear", () => {
  it("no toca textos cortos y acota los largos", () => {
    expect(muestrear("hola mundo", 100)).toBe("hola mundo");
    expect(muestrear("palabra ".repeat(2000), 500).length).toBeLessThanOrEqual(520);
  });
});
