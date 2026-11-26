import { describe, expect, it } from "vitest";
import { generateQuizRequestSchema, limpiarContexto, sanitizarTema, TEMA_MAX } from "@/lib/validators";

const valido = { nivel: "egb", grado: "egb-5", area: "matematica", tema: "Fracciones", cantidad: 5 };

describe("sanitizarTema", () => {
  it("quita símbolos de markup e inyección y colapsa espacios", () => {
    expect(sanitizarTema("  <b>Fracciones</b> {x}  `$y`  ")).toBe("b Fracciones /b x y");
  });

  it("elimina caracteres de control y de formato", () => {
    expect(sanitizarTema("Suma\u0000​de\tnúmeros")).toBe("Suma de números");
  });

  it("recorta a TEMA_MAX caracteres", () => {
    expect(sanitizarTema("a".repeat(TEMA_MAX + 50))).toHaveLength(TEMA_MAX);
  });
});

describe("limpiarContexto", () => {
  it("conserva los saltos de línea y reduce los repetidos", () => {
    expect(limpiarContexto("Uno\n\n\n\nDos <script>")).toBe("Uno\n\nDos script");
  });
});

describe("generateQuizRequestSchema", () => {
  it("acepta una configuración válida", () => {
    const r = generateQuizRequestSchema.safeParse(valido);
    expect(r.success).toBe(true);
  });

  it("rechaza un grado que no corresponde al nivel", () => {
    const r = generateQuizRequestSchema.safeParse({ ...valido, nivel: "bgu" });
    expect(r.success).toBe(false);
  });

  it("rechaza una asignatura que no corresponde al grado", () => {
    const r = generateQuizRequestSchema.safeParse({ ...valido, area: "identidad-autonomia" });
    expect(r.success).toBe(false);
  });

  it("rechaza cantidades distintas de 5 o 10", () => {
    expect(generateQuizRequestSchema.safeParse({ ...valido, cantidad: 7 }).success).toBe(false);
    expect(generateQuizRequestSchema.safeParse({ ...valido, cantidad: 15 }).success).toBe(false);
  });

  it("rechaza campos desconocidos", () => {
    expect(generateQuizRequestSchema.safeParse({ ...valido, extra: 1 }).success).toBe(false);
  });

  it("rechaza un tema sin letras tras sanitizar", () => {
    expect(generateQuizRequestSchema.safeParse({ ...valido, tema: "<<>> 123 {}" }).success).toBe(false);
  });

  it("descarta un contexto vacío", () => {
    const r = generateQuizRequestSchema.safeParse({ ...valido, contexto: "   " });
    expect(r.success && r.data.contexto).toBeUndefined();
  });
});
