"use client";

import { useCallback, useEffect, useState } from "react";

import { CLAVE_TEMA, type Tema } from "@/lib/tema";

export type { Tema };

function leerTemaActual(): Tema {
  if (typeof document === "undefined") return "light";
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

/** Tema claro/oscuro sincronizado con <html data-theme> y localStorage. */
export function useTheme(): { tema: Tema; listo: boolean; setTema: (t: Tema) => void; alternar: () => void } {
  const [tema, setTemaState] = useState<Tema>("light");
  const [listo, setListo] = useState(false);

  useEffect(() => {
    setTemaState(leerTemaActual());
    setListo(true);

    // Mantiene sincronizadas otras pestañas.
    const onStorage = (e: StorageEvent) => {
      if (e.key !== CLAVE_TEMA) return;
      const nuevo: Tema = e.newValue === "dark" ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", nuevo);
      setTemaState(nuevo);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setTema = useCallback((t: Tema) => {
    document.documentElement.setAttribute("data-theme", t);
    setTemaState(t);
    try {
      localStorage.setItem(CLAVE_TEMA, t);
    } catch {
      /* almacenamiento no disponible: el tema solo dura esta visita */
    }
  }, []);

  const alternar = useCallback(() => setTema(leerTemaActual() === "dark" ? "light" : "dark"), [setTema]);

  return { tema, listo, setTema, alternar };
}
