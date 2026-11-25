"use client";

import { motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

/** Interruptor sol / switch / luna, pensado para ir sobre la barra azul. */
export default function ThemeToggle({ className = "", compacto = false }: { className?: string; compacto?: boolean }) {
  const { tema, listo, alternar } = useTheme();
  const oscuro = tema === "dark";

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Sun className={`${compacto ? "hidden sm:block" : ""} h-5 w-5 transition-colors ${oscuro ? "text-white/60" : "text-[#7CFFB2]"}`} aria-hidden />
      <button
        type="button"
        role="switch"
        aria-checked={oscuro}
        aria-label={oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
        onClick={alternar}
        className={`relative h-7 w-12 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white ${
          oscuro ? "bg-[#0B3F8F] ring-1 ring-white/40" : "bg-[#DCE3EC]"
        } ${listo ? "" : "opacity-0"}`}
      >
        <motion.span
          className="absolute top-1 h-5 w-5 rounded-full bg-white shadow-md"
          initial={false}
          animate={{ left: oscuro ? 24 : 4 }}
          transition={{ type: "spring", stiffness: 500, damping: 32 }}
        />
      </button>
      <Moon className={`${compacto ? "hidden sm:block" : ""} h-5 w-5 transition-colors ${oscuro ? "text-white" : "text-white/80"}`} aria-hidden />
    </div>
  );
}
