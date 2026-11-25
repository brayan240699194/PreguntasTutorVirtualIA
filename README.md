# Tutor IA · Ecosistema educativo

Lecciones de opción múltiple alineadas al currículo del MINEDUC (Ecuador), generadas con Gemini para Educación Inicial, EGB y BGU: 21 asignaturas y ámbitos de desarrollo (catálogo en `src/lib/catalogo.ts`). Incluye un tutor animado que habla y muestra subtítulos sincronizados.

El modelo por defecto es `gemini-3.8-flash`, con `gemini-3.7-flash` y `gemini-3.5-flash` como respaldo si está saturado o no disponible. Se cambia con `GEMINI_MODEL`.

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # y coloca tu GEMINI_API_KEY de https://aistudio.google.com/apikey
npm run dev                  # http://localhost:3000
```

Producción: `npm run build && npm start`. Verificación de tipos: `npm run typecheck`. Tests (Vitest): `npm test`.

### Variables de entorno

| Variable | Por defecto | Uso |
| --- | --- | --- |
| `GEMINI_API_KEY` | — | Clave de Google AI Studio (obligatoria) |
| `GEMINI_MODEL` | `gemini-3.8-flash` | Modelo principal |
| `PLANIFICACION_PDF_HABILITADA` | `false` | Activa la carga de planificaciones en PDF |
| `PROXIES_CONFIABLES` | `0` | Proxies delante de la app; define de dónde se lee la IP del cliente |
| `LIMITE_GLOBAL_POR_MINUTO` | `60` | Tope de solicitudes por minuto a cada endpoint, sumando todas las IP |

## Estructura

| Ruta | Función |
| --- | --- |
| `src/app/page.tsx` | Selector de área, nivel, tema y cantidad; historial y analítica |
| `src/app/quiz/page.tsx` | Sala de evaluación y pantalla de resultados |
| `src/app/api/quiz/generate/route.ts` | Endpoint POST con validación Zod y límite de 6 solicitudes/min por IP |
| `src/app/api/planificacion/temas/route.ts` | Endpoint POST (multipart) que extrae los temas de un PDF; 8 solicitudes/min por IP |
| `src/lib/gemini.ts` | Cliente `@google/genai`, `responseSchema`, prompt pedagógico, normalización, reintentos y modelos de respaldo con plazo máximo |
| `src/lib/pdfTexto.ts` | Extracción de texto del PDF y detección de temas sin IA |
| `src/lib/rateLimit.ts` | Límite por IP y tope global en memoria |
| `src/lib/*.test.ts` | Tests de validación, límites, normalización de preguntas y detección de temas |
| `src/store/useQuizStore.ts` | Estado Zustand persistido en `localStorage` |
| `src/hooks/useTutorVoice.ts` | Síntesis de voz (Web Speech API) y avance de subtítulos palabra por palabra |
| `src/components/tutor/*` | Avatar SVG, ventana flotante (PiP) y subtítulos |

## Lecciones desde una planificación en PDF

En el paso «Tema de la lección» se puede subir una planificación, guía o libro (PUD, PCA, plan de clase, texto escolar; máx. 30 MB). Para ahorrar tokens, el PDF **no** se envía entero al modelo:

1. El servidor extrae el texto con `pdf-parse` (hasta 400 páginas, en menos de un segundo).
2. Los temas se detectan **sin IA** a partir de los marcadores del PDF, los títulos «Unidad / Tema / Capítulo…» o la lista de «Contenidos / Destrezas».
3. Solo si no hay estructura reconocible se envía a Gemini un extracto de texto (máx. 12 000 caracteres).
4. Los PDF escaneados (sin texto) se envían como archivo solo si tienen hasta 15 páginas; si son más largos, se rechazan.
5. Cada tema guarda su propio fragmento del documento (máx. 3 500 caracteres), que es lo único que se usa al generar la lección.
6. Los resultados se guardan en caché durante una hora: volver a subir el mismo PDF no consume nada.

En la consola del servidor se ve qué camino se usó: `[planificacion/temas] local · 52 págs · 5 temas · 190 ms`.

Se activa o desactiva en `.env.local` y requiere reiniciar el servidor:

```bash
PLANIFICACION_PDF_HABILITADA=true   # false (o sin definir) oculta la pestaña y bloquea las rutas
```

## Notas

- La clave solo se lee en el servidor; nunca uses el prefijo `NEXT_PUBLIC_`.
- El rate limit es en memoria (una instancia). Para varias instancias, usa un almacén compartido (Redis, etc.).
- La IP del cliente sale de `x-forwarded-for`. Si la app recibe las conexiones directamente, esa cabecera la puede falsificar el cliente; por eso existe además un tope global que protege la cuota de Gemini. Detrás de un proxy (Vercel, nginx…), configura `PROXIES_CONFIABLES` para leer la IP real.
- Cada solicitud tiene un plazo total de 52 s para las llamadas a Gemini (las rutas tienen `maxDuration = 60`). Si se agota, la llamada en curso se aborta y se responde 503.
- En la lista de «Contenidos» de un PDF, un ítem sin puntuación final se une con la línea siguiente (para recomponer ítems partidos en dos líneas).
- El servidor mezcla el orden de las opciones para evitar el sesgo de posición del modelo.
- Atajos en la lección: `A–D` o `1–4` para responder, `←/→` o `Enter` para navegar, `Esc` para callar al tutor.
- La calidad de la voz depende del navegador: Chrome y Edge ofrecen voces neuronales en español.
