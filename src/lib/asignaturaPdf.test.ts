import { describe, expect, it } from "vitest";
import { areasCompatibles, detectarAsignatura } from "@/lib/asignaturaPdf";

describe("detectarAsignatura", () => {
  it("usa la línea «Área:» del encabezado", () => {
    const texto = `UNIDAD EDUCATIVA FISCAL SAN JOSÉ
PLANIFICACIÓN MICROCURRICULAR
Docente: Lcda. María Pérez   Área: Matemática   Grado: 8.º EGB
Objetivos de la unidad: resolver problemas cotidianos.`;
    expect(detectarAsignatura(texto)).toBe("matematica");
  });

  it("«Lengua extranjera» es Inglés, no Lengua y Literatura", () => {
    expect(detectarAsignatura(`PLANIFICACIÓN\nAsignatura: Lengua Extranjera - Inglés\nCurso: 9.º EGB\n${"x ".repeat(40)}`)).toBe("ingles");
  });

  it("reconoce los códigos de destrezas del MINEDUC", () => {
    const texto = `Destrezas con criterios de desempeño
CN.4.1.1. Indagar y explicar las propiedades de los seres vivos.
CN.4.1.3. Analizar la estructura de la célula animal y vegetal.
I.CN.4.1.1. Explica las propiedades de los seres vivos.`;
    expect(detectarAsignatura(texto)).toBe("ciencias-naturales");
    expect(detectarAsignatura("M.4.1.2. Resolver ecuaciones. M.4.1.5. Operar con fracciones. Actividades de refuerzo en clase.")).toBe(
      "matematica",
    );
    expect(detectarAsignatura("CN.F.5.1.1. Determinar la velocidad. CN.F.5.1.2. Aplicar las leyes de Newton en ejercicios prácticos.")).toBe(
      "fisica",
    );
  });

  it("detecta por vocabulario cuando no hay encabezado ni códigos", () => {
    const texto = `Guía de estudio. Las fracciones tienen numerador y denominador. Para sumar fracciones con igual
denominador se suman los numeradores. El porcentaje es una fracción de denominador cien. Resuelve la ecuación
y calcula el perímetro y el área del triángulo. Repasa la multiplicación y la división de fracciones.`;
    expect(detectarAsignatura(texto)).toBe("matematica");
  });

  it("no adivina si el texto no es claro", () => {
    expect(detectarAsignatura("Documento general de la institución con horarios, reuniones y avisos para las familias del plantel.")).toBeNull();
  });
});

describe("areasCompatibles", () => {
  it("Biología es compatible con Ciencias Naturales, pero no Matemática", () => {
    expect(areasCompatibles("biologia", "ciencias-naturales")).toBe(true);
    expect(areasCompatibles("matematica", "lengua-literatura")).toBe(false);
  });
});
