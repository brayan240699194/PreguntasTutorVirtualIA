import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { _reiniciarLimites, obtenerIp, verificarLimite } from "@/lib/rateLimit";

function req(headers: Record<string, string>) {
  return { headers: new Headers(headers) };
}

describe("obtenerIp", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("sin proxy, usa la entrada más cercana al servidor", () => {
    expect(obtenerIp(req({ "x-forwarded-for": "1.1.1.1, 2.2.2.2" }))).toBe("2.2.2.2");
  });

  it("con un proxy de confianza, ignora lo que el cliente escribe a la izquierda", () => {
    vi.stubEnv("PROXIES_CONFIABLES", "1");
    expect(obtenerIp(req({ "x-forwarded-for": "6.6.6.6, 9.9.9.9" }))).toBe("9.9.9.9");
  });

  it("con dos proxies, toma la segunda entrada desde la derecha", () => {
    vi.stubEnv("PROXIES_CONFIABLES", "2");
    expect(obtenerIp(req({ "x-forwarded-for": "6.6.6.6, 5.5.5.5, 10.0.0.1" }))).toBe("5.5.5.5");
  });

  it("recurre a x-real-ip y luego a 'anonimo'", () => {
    expect(obtenerIp(req({ "x-real-ip": "3.3.3.3" }))).toBe("3.3.3.3");
    expect(obtenerIp(req({}))).toBe("anonimo");
  });
});

describe("verificarLimite", () => {
  beforeEach(() => _reiniciarLimites());

  it("bloquea a una IP que supera su límite por minuto", () => {
    for (let i = 0; i < 3; i++) expect(verificarLimite("t", "1.1.1.1", 3, 100).permitido).toBe(true);
    const r = verificarLimite("t", "1.1.1.1", 3, 100);
    expect(r.permitido).toBe(false);
    expect(r.reintentarEnSeg).toBeGreaterThan(0);
    // Otra IP sigue pudiendo.
    expect(verificarLimite("t", "2.2.2.2", 3, 100).permitido).toBe(true);
  });

  it("el tope global frena a quien rota IP falsas", () => {
    for (let i = 0; i < 5; i++) expect(verificarLimite("t", `ip-${i}`, 3, 5).permitido).toBe(true);
    expect(verificarLimite("t", "ip-nueva", 3, 5).permitido).toBe(false);
  });

  it("una solicitud rechazada no consume cupo", () => {
    for (let i = 0; i < 2; i++) verificarLimite("t", "1.1.1.1", 2, 3);
    expect(verificarLimite("t", "1.1.1.1", 2, 3).permitido).toBe(false);
    expect(verificarLimite("t", "2.2.2.2", 2, 3).permitido).toBe(true);
  });

  it("los cubos son independientes", () => {
    verificarLimite("a", "1.1.1.1", 1, 10);
    expect(verificarLimite("a", "1.1.1.1", 1, 10).permitido).toBe(false);
    expect(verificarLimite("b", "1.1.1.1", 1, 10).permitido).toBe(true);
  });
});
