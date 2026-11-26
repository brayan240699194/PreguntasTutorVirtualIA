import type { Metadata, Viewport } from "next";
import { Montserrat, Nunito } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";
import { CLAVE_TEMA } from "@/lib/tema";

/** Tipografía redondeada y muy legible, pensada para lectores que empiezan. */
const nunito = Nunito({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-principal",
  display: "swap",
});

/** Solo para el logotipo de Prolipa, que conserva su tipografía de marca. */
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["700", "900"],
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
    <html lang="es" data-theme="light" className={`${nunito.variable} ${montserrat.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptTema }} />
      </head>
      <body className="min-h-dvh bg-fondo font-sans text-texto">{children}</body>
    </html>
  );
}
