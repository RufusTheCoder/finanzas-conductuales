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
