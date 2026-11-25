import HomeClient from "@/components/home/HomeClient";
import { planificacionPdfHabilitada } from "@/lib/funciones";

// Se evalúa en cada solicitud para que el interruptor de .env.local tenga efecto
// sin recompilar la aplicación.
export const dynamic = "force-dynamic";

export default function Page() {
  return <HomeClient pdfHabilitado={planificacionPdfHabilitada()} />;
}
