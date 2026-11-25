import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";
import { CLAVE_TEMA } from "@/lib/tema";

const montserrat = Montserrat({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tutor Virtual · Prolipa",
  description:
    "Lecciones interactivas de Ciencias Naturales, Matemáticas, Estudios Sociales y Lengua y Literatura con un tutor que te explica con voz y subtítulos.",
  applicationName: "Tutor Virtual",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0866E0" },
    { media: "(prefers-color-scheme: dark)", color: "#16212C" },
  ],
  width: "device-width",
  initialScale: 1,
};

/** Aplica el tema guardado antes del primer pintado para evitar parpadeos. */
const scriptTema = `(function(){try{var t=localStorage.getItem(${JSON.stringify(CLAVE_TEMA)});document.documentElement.setAttribute('data-theme',t==='dark'?'dark':'light');}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" data-theme="light" className={montserrat.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptTema }} />
      </head>
      <body className="min-h-dvh bg-fondo font-sans text-texto">{children}</body>
    </html>
  );
}
