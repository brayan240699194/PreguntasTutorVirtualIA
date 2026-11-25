import { describe, expect, it, vi } from "vitest";
import { ejecutarConRespaldo, GeminiError, normalizarPregunta, parsearRespuesta } from "@/lib/gemini";
import type { PreguntaGenerada } from "@/lib/validators";

function pregunta(correcta: "A" | "B" | "C" | "D" = "B"): PreguntaGenerada {
  return {
    enunciado: "¿Qué órgano produce la bilis?",
    opciones: [
      { letra: "A", texto: "Vesícula", feedbackEspecifico: "Solo la almacena." },
      { letra: "B", texto: "Hígado", feedbackEspecifico: "Correcto, la fabrica." },
      { letra: "C", texto: "Páncreas", feedbackEspecifico: "Produce jugo pancreático." },
      { letra: "D", texto: "Estómago", feedbackEspecifico: "Produce jugo gástrico." },
    ],
    letraCorrecta: correcta,
    bannerExplicacion: "El hígado produce la bilis.",
    guionVozAcierto: "Muy bien.",
    guionVozError: "No exactamente.",
  };
}

describe("normalizarPregunta", () => {
  it("mezcla las opciones conservando cuál es la correcta", () => {
    for (let i = 0; i < 30; i++) {
      const p = normalizarPregunta(pregunta());
      expect(p.opciones.map((o) => o.letra)).toEqual(["A", "B", "C", "D"]);
      expect(p.opciones.find((o) => o.letra === p.letraCorrecta)?.texto).toBe("Hígado");
    }
  });

  it("asigna un id nuevo", () => {
    expect(normalizarPregunta(pregunta()).id).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("parsearRespuesta", () => {
  it("devuelve exactamente la cantidad pedida", () => {
    const json = JSON.stringify({ preguntas: [pregunta(), pregunta("A"), pregunta("D")] });
    expect(parsearRespuesta(json, 2)).toHaveLength(2);
  });

  it.each([
    ["vacía", ""],
    ["JSON mal formado", "{preguntas:"],
    ["fuera de esquema", JSON.stringify({ preguntas: [{ enunciado: "x" }] })],
    ["con pocas preguntas", JSON.stringify({ preguntas: [pregunta()] })],
  ])("rechaza una respuesta %s", (_, texto) => {
    expect(() => parsearRespuesta(texto, 3)).toThrowError(GeminiError);
  });

  it("rechaza opciones repetidas", () => {
    const p = pregunta();
    p.opciones[1] = { ...p.opciones[1]!, texto: "Vesícula" };
    expect(() => parsearRespuesta(JSON.stringify({ preguntas: [p] }), 1)).toThrowError(GeminiError);
  });
});

describe("ejecutarConRespaldo", () => {
  const conEstado = (status: number) => Object.assign(new Error(`HTTP ${status}`), { status });

  it("reintenta ante un 503 y devuelve el resultado", async () => {
    const fn = vi.fn().mockRejectedValueOnce(conEstado(503)).mockResolvedValueOnce("ok");
    await expect(ejecutarConRespaldo(fn, Date.now() + 30_000)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("no reintenta con una clave inválida", async () => {
    const fn = vi.fn().mockRejectedValue(conEstado(401));
    await expect(ejecutarConRespaldo(fn, Date.now() + 30_000)).rejects.toMatchObject({ code: "CLAVE_INVALIDA" });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("pasa al siguiente modelo si el actual no existe (404)", async () => {
    const fn = vi.fn().mockRejectedValueOnce(conEstado(404)).mockResolvedValueOnce("ok");
    await expect(ejecutarConRespaldo(fn, Date.now() + 30_000)).resolves.toBe("ok");
    expect(fn.mock.calls[0]![0]).not.toBe(fn.mock.calls[1]![0]);
  });

  it("no empieza un intento si ya no queda tiempo", async () => {
    const fn = vi.fn();
    await expect(ejecutarConRespaldo(fn, Date.now() + 1_000)).rejects.toMatchObject({ code: "SATURADO" });
    expect(fn).not.toHaveBeenCalled();
  });

  it("aborta la llamada en curso al llegar a la fecha límite", async () => {
    const inicio = Date.now();
    const fn = vi.fn(
      (_m: string, _i: number, signal: AbortSignal) =>
        new Promise((_, rechazar) => signal.addEventListener("abort", () => rechazar(signal.reason))),
    );
    await expect(ejecutarConRespaldo(fn, inicio + 5_300)).rejects.toMatchObject({ code: "SATURADO" });
    expect(Date.now() - inicio).toBeLessThan(6_500);
    expect(fn).toHaveBeenCalledTimes(1);
  }, 10_000);
});
