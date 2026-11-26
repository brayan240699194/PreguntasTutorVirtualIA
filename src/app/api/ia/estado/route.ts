import { NextResponse } from "next/server";
import { verificarIA } from "@/lib/gemini";
import type { EstadoIAResponse } from "@/types/quiz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Indica si el tutor tiene conexión con la IA (credencial verde) o usa el banco local (naranja). */
export async function GET(): Promise<NextResponse<EstadoIAResponse>> {
  const disponible = await verificarIA();
  return NextResponse.json(
    { disponible, verificadoEn: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
