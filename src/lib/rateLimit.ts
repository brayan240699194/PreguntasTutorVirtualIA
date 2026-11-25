import type { NextRequest } from "next/server";

/*
 * Rate limit en memoria con ventana deslizante por IP y por "cubo", más un
 * tope global por cubo que protege la cuota de Gemini aunque alguien falsifique
 * la IP. Suficiente para una sola instancia; en despliegues multi-instancia
 * debe reemplazarse por un almacén compartido (p. ej. Redis).
 */

const VENTANA_MS = 60_000;
const MAX_CLAVES = 5_000;
const registro = new Map<string, number[]>();

/** Tope global de solicitudes por minuto y cubo (todas las IP juntas). */
export const LIMITE_GLOBAL_POR_MINUTO = (() => {
  const n = Number(process.env.LIMITE_GLOBAL_POR_MINUTO);
  return Number.isInteger(n) && n > 0 ? n : 60;
})();

/**
 * Número de proxies de confianza delante de la app (Vercel, nginx, Cloudflare…).
 * - 0 (por defecto): la app recibe las conexiones directamente. Next.js solo
 *   rellena `x-forwarded-for` con la IP del socket si el cliente no la envió,
 *   así que la cabecera puede venir falsificada: se usa igual (no hay otra
 *   fuente), pero el tope global impide abusar de la cuota.
 * - N ≥ 1: se toma la IP que añadió el proxy más externo de confianza, es decir,
 *   la N-ésima entrada desde la derecha de `x-forwarded-for`. Lo que el cliente
 *   escriba a la izquierda se ignora.
 */
function proxiesConfiables(): number {
  const n = Number(process.env.PROXIES_CONFIABLES ?? "0");
  return Number.isInteger(n) && n > 0 ? n : 0;
}

export function obtenerIp(req: Pick<NextRequest, "headers">): string {
  const ips = (req.headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const saltos = proxiesConfiables();

  if (saltos > 0) {
    const ip = ips[ips.length - saltos] ?? ips[0];
    if (ip) return ip;
    return req.headers.get("x-real-ip")?.trim() || "anonimo";
  }
  // Sin proxy: la última entrada es la más cercana al servidor.
  return ips[ips.length - 1] || req.headers.get("x-real-ip")?.trim() || "anonimo";
}

function recientes(clave: string, ahora: number): number[] {
  return (registro.get(clave) ?? []).filter((t) => ahora - t < VENTANA_MS);
}

function esperaSeg(tiempos: number[], ahora: number): number {
  const masAntigua = tiempos[0] ?? ahora;
  return Math.max(1, Math.ceil((VENTANA_MS - (ahora - masAntigua)) / 1000));
}

export function verificarLimite(
  cubo: string,
  ip: string,
  maxPorMinuto: number,
  maxGlobal: number = LIMITE_GLOBAL_POR_MINUTO,
): { permitido: boolean; reintentarEnSeg: number } {
  const ahora = Date.now();
  const claveIp = `${cubo}:ip:${ip}`;
  const claveGlobal = `${cubo}:global`;
  const porIp = recientes(claveIp, ahora);
  const global = recientes(claveGlobal, ahora);
  registro.set(claveIp, porIp);
  registro.set(claveGlobal, global);

  if (porIp.length >= maxPorMinuto) return { permitido: false, reintentarEnSeg: esperaSeg(porIp, ahora) };
  if (global.length >= maxGlobal) return { permitido: false, reintentarEnSeg: esperaSeg(global, ahora) };

  porIp.push(ahora);
  global.push(ahora);

  if (registro.size > MAX_CLAVES) {
    for (const [k, tiempos] of registro) {
      if (tiempos.every((t) => ahora - t >= VENTANA_MS)) registro.delete(k);
    }
  }
  return { permitido: true, reintentarEnSeg: 0 };
}

/** Solo para tests. */
export function _reiniciarLimites(): void {
  registro.clear();
}
