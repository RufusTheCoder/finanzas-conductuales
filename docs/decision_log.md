# Decision Log — Finanzas Conductuales

Registro de decisiones tomadas en sesiones de diseño/arquitectura. Una entrada por
sesión relevante. Para cada decisión: **qué** se decidió, **por qué**, y la **alternativa
descartada**. Lo más reciente arriba.

> Plantilla de entrada:
> ```
> ## YYYY-MM-DD — <tema de la sesión>
> **Contexto:** <una línea>
> - **Decisión:** <qué> — **Por qué:** <razón> — **En vez de:** <alternativa descartada>
> **Artefactos:** <spec, commits, rama>
> ```

---

## 2026-06-07 — Fase 2 (pt-BR) deployada + diseño Fase 2b (UI chrome)

**Contexto:** Fase 2 (contenido pt-BR) deployada a prod (`9ab132a..fa7df78`, live `?v=20260607a`, 880 linhas pt-BR, verificada). Durante la ejecución surgieron 2 correcciones de localización del usuario; luego se diseñó Fase 2b (chrome). Rama `feat/i18n-fase2b`.

- **Decisión (Fase 2, ejecución):** valores en **pesos → reais** (câmbio 0,29, redondeado limpio; abstractos como precios de acción mantienen dígitos; Madoff = US$ 65 bi histórico) e **instrumentos MX → BR** (Cetesdirecto/Cetes/SOFIPOS → **Tesouro Direto/CDBs**). — **Por qué:** localización real para alumnos brasileños, no solo traducción literal. — **En vez de:** dejar pesos/instrumentos mexicanos (incoherente para BR).
- **Decisión (siembra):** 880 filas no entran como SQL literal en el MCP → **política RLS temporal acotada** (`anon INSERT WHERE lang='pt-BR'`) + REST batch por script + DROP. — **Por qué:** evita transcribir ~220 KB (error-prone); el script envía bytes exactos. — **En vez de:** pegar SQL gigante (riesgo de corrupción silenciosa de texto).
- **Decisión (Fase 2b):** interpolación vía **placeholders `{nombre}`** extendiendo `t()` (Opción A), para traducir chrome dinámico (contadores, "Paso N de M", frases del informe). — **Por qué:** la mayoría del chrome lleva variables; sin esto, B dejaría medio chrome en español. — **En vez de:** traducir solo strings 100% estáticos.
- **Decisión (Fase 2b):** alcance = **todo el chrome del alumno** (`app.js`); dominio `ui.*`. FUERA: `admin.js`, `privacy.html`. — **Por qué:** pt-BR completo para el alumno; admin es solo del dueño.

**Artefactos:** spec [`docs/superpowers/specs/2026-06-07-i18n-fase2b-design.md`](superpowers/specs/2026-06-07-i18n-fase2b-design.md) · ramas `feat/i18n-fase2` (mergeada), `feat/i18n-fase2b`.

---

## 2026-06-07 — i18n Fase 1b deployada + diseño Fase 2 (pt-BR contenido)

**Contexto:** Fase 1b verificada en navegador (Playwright headless, es-MX idéntico, 0 errores) y **deployada a prod** (master `684db4d`, merge ff que incluyó Fase 0+1a sin pushear). Luego arrancó el diseño de Fase 2 (pt-BR). Rama `feat/i18n-fase2`.

- **Decisión:** Fase 2 traduce **solo el contenido** (880 filas ya cableadas); el UI chrome se difiere a **Fase 2b**. — **Por qué:** entregar pt-BR usable rápido; el chrome es superficie grande (~200 cadenas) y otra pasada. — **En vez de:** pt-BR completo (contenido+UI) de una (mucho más grande). Gap conocido: alumno pt-BR ve chrome en español (fallback evita vacíos).
- **Decisión:** Traducciones generadas por Claude → **TSV `key|es-MX|pt-BR`** → Rodrigo (nativo) revisa/edita → siembra. — **Por qué:** es→pt es fuerte del LLM + revisión nativa rápida = calidad sin lentitud; human-in-the-loop antes de prod. — **En vez de:** sembrar sin revisión, o traducción profesional (más lenta).
- **Decisión:** Selector **ES/PT en dashboard + login**; **auto-detect** navegador pt→pt-BR en 1ª visita (default es-MX); persiste en `localStorage 'fc_lang'` + `users.lang` (nueva `setUserLang`). — **Por qué:** audiencia = alumnos brasileños reales, necesitan auto-elegir fácil y que su elección los siga. — **En vez de:** selector solo en dashboard / sin auto-detect.

**Artefactos:** spec [`docs/superpowers/specs/2026-06-07-i18n-fase2-design.md`](superpowers/specs/2026-06-07-i18n-fase2-design.md) · rama `feat/i18n-fase2`.

---

## 2026-06-06 — Diseño i18n Fase 1b

**Contexto:** Conectar la app a la tabla `translations` (ya sembrada en es-MX en Fase 1a)
vía un helper `t()`, sin cambiar nada visible en es-MX. Rama `feat/i18n-fase1b`.

- **Decisión:** Alcance = preguntas/sesgos/perfiles **+** contenido inline del informe
  (`MECANISMOS`/`ANTIDOTOS`/`DECISION_MATRIX`) **+** `NEXT_STEPS_OPTIONS`. UI chrome y
  `admin.js` se difieren. — **Por qué:** maximizar la completitud del contenido para el
  alumno pt-BR; el chrome de UI es de menor valor y mayor superficie; el admin lo usa solo
  el dueño y siempre en su idioma. — **En vez de:** solo lo ya sembrado (dejaría el informe
  final en español en pt-BR), o i18n completo de la UI (mucho más grande).
- **Decisión:** El texto **se mantiene** en los archivos de datos como respaldo;
  `t(clave, respaldo)` lo usa si falta la clave. — **Por qué:** red de seguridad (la app
  nunca queda peor que hoy) y mantiene el script de extracción re-ejecutable. — **En vez de:**
  borrar el texto de los archivos (criterio de aceite original de la tarea Notion), que es
  más limpio pero rompe si falta una clave y desarma la idempotencia del seed.
- **Decisión:** Helper en módulo nuevo `i18n.js`; acceso REST como `fetchTranslations(lang)`
  en `supabase.js`; contenido inline movido a `public/data/report-content.js`. — **Por qué:**
  separación de responsabilidades, reduce el tamaño de `app.js` (ya 2926 líneas), habilita la
  extracción del contenido inline, y respeta la regla "todo Supabase pasa por `supabase.js`".
  — **En vez de:** meter todo en `app.js` o en `supabase.js`.
- **Decisión:** Carga de traducciones **no bloqueante** en el boot (render inmediato con
  respaldos + re-render al cargar). — **Por qué:** riesgo cero en es-MX (el respaldo es
  idéntico a la BD), sin pantalla en blanco, funciona sin red. — **En vez de:** `await`
  bloqueante antes del primer render.
- **Decisión:** Despliegue en **2 checkpoints** (1: infraestructura + datos ya sembrados;
  2: contenido inline). — **Por qué:** el refactor toca el corazón del render; un deploy
  intermedio acota el riesgo.

**Artefactos:** spec [`docs/superpowers/specs/2026-06-06-i18n-fase1b-design.md`](superpowers/specs/2026-06-06-i18n-fase1b-design.md) · rama `feat/i18n-fase1b` · commit `53428be`.
