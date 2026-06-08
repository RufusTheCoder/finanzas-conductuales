# i18n Fase 2 — pt-BR (contenido) — Diseño

**Fecha:** 2026-06-07
**Proyecto:** Finanzas Conductuales (Ibero CDMX)
**Estado:** Diseño aprobado, pendiente de plan
**Depende de:** Fase 1b (✅ deployada — la app ya lee `t(key, fallback)` desde `translations`, recarga por `users.lang` con fallback es-MX).

## Contexto

La tabla `translations(key, lang, text, domain)` (PK `(key,lang)`) tiene **880 filas es-MX** y la app las consume vía `t()`. No hay traducciones pt-BR ni forma de cambiar de idioma en la UI. Fase 2 agrega el contenido pt-BR y el selector.

## Objetivo

Que un alumno pueda usar el curso en **pt-BR**: traducir las 880 filas de contenido (preguntas/sesgos/perfiles/informe) y agregar un **selector de idioma**. Audiencia: alumnos brasileños reales.

## Decisiones tomadas (con el usuario)

1. **Alcance:** solo el **contenido** (las 880 filas ya cableadas). El **UI chrome** (botones, navegación, etiquetas, "Módulo N", pantallas de login, `JOURNEY_STAGES`/`LEARN_BLOCKS`/`SLIDER_LABELS`, frases de conclusión hardcodeadas) **queda fuera** → futura **Fase 2b** ("i18n de UI"). Gap conocido: un alumno pt-BR verá el contenido en portugués pero el chrome en español (usable; el fallback evita vacíos).
2. **Producción de traducciones:** las genero yo (es→pt) y se entregan en un **TSV lado-a-lado `key | es-MX | pt-BR`**; Rodrigo (nativo pt-BR) revisa/edita; recién entonces se siembran. Solo edita lo que esté off; lo no editado usa mi traducción.
3. **Selector:** toggle **ES/PT** en la **barra del dashboard** y en la **pantalla de login**.
4. **Auto-detección:** en la 1ª visita, `navigator.language` que empiece con `pt` → arranca en pt-BR; default es-MX para el resto. Una vez elegido, manda `localStorage 'fc_lang'`.
5. **Persistencia:** al cambiar idioma se guarda en `localStorage 'fc_lang'` y, si está logueado, en `users.lang` (nueva función `setUserLang`), para que la elección lo siga entre dispositivos.

## Arquitectura

### Parte A — Traducciones pt-BR (las 880 filas)

**Generación (workflow paralelo):**
1. **Glosario** es→pt de términos clave para consistencia (p. ej. `sesgo→viés`, `inversionista→investidor`, los 5 mecanismos, los 8 antídotos, los nombres de perfil BIT). Los nombres de tipo BIT en inglés (`Passive Preserver`/`Friendly Follower`/`Independent Individualist`/`Active Accumulator`, en `profile.<code>.name`) **se mantienen en inglés** (igual que en es-MX), salvo que Rodrigo decida lo contrario en la revisión.
2. **Traducción en lotes** (agentes en paralelo sobre las 880 claves, usando el glosario).
3. **Pasada de QA** de consistencia/precisión (terminología uniforme, sin claves omitidas).

**Artefacto de revisión:** `scripts/i18n_ptbr_review.tsv` con columnas `key`, `domain`, `es_mx`, `pt_br` — generado desde `buildRows()` (claves autoritativas, cobertura garantizada de las 880). Rodrigo edita la columna `pt_br` en Sheets/Excel.

**Importación + siembra:** `scripts/import_ptbr_tsv.mjs` lee el TSV aprobado y emite SQL `INSERT … (key, 'pt-BR', text, domain) ON CONFLICT (key,lang) DO NOTHING`. Siembra a prod (write idempotente, autorizado por Rodrigo tras revisión).

**Chequeo de cobertura:** extender `check_translations_alignment.mjs` con un modo pt-BR que verifica **coverage** (toda clave es-MX tiene su par pt-BR; 0 faltantes / 0 extras). No compara texto (pt-BR difiere por diseño).

### Parte B — Selector de idioma (app.js + supabase.js)

- **`supabase.js`:** `setUserLang(email, lang)` → `PATCH /rest/v1/users?email=eq.<email>` body `{lang}`.
- **`app.js`:** helper `switchLang(lang)`:
  ```
  setLang(lang); localStorage.setItem('fc_lang', lang);
  await loadTranslations(lang); render();
  if (state.user?.email && !isReadOnly()) setUserLang(state.user.email, lang);  // fire-and-forget
  ```
- **Control UI:** toggle `ES | PT` (etiquetas neutras, sin traducción) en:
  - `renderDashboard` → barra `dash-nav`.
  - `renderAuth*` → en el shell de login.
  Marca el idioma activo (`getLang()`).
- **Auto-detección (boot):** cambiar el cálculo de `bootLang` (hoy `localStorage 'fc_lang' || 'es-MX'`) a:
  ```
  localStorage 'fc_lang' || (navigator.language?.toLowerCase().startsWith('pt') ? 'pt-BR' : 'es-MX')
  ```
  Solo aplica en la 1ª visita (después `fc_lang` existe).
- **Sin cambio en el fallback:** `t(key, fallback)` ya degrada pt-BR ausente → texto es-MX del archivo.

### Parte C — Secuencia / despliegue

1. Generar draft pt-BR (workflow) → `i18n_ptbr_review.tsv`.
2. **[Gate humano]** Rodrigo revisa/edita el TSV.
3. Importar TSV aprobado → **sembrar pt-BR en prod** (880 filas, una por clave es-MX).
4. Construir selector + `setUserLang` + auto-detect (código).
5. Bump de caché + **deploy** (merge a master; lo dispara Rodrigo). El selector llega cuando pt-BR ya está sembrado, así que "PT" funciona de inmediato.
6. Verificar pt-BR en navegador (extender `verify_esmx.mjs` para forzar `fc_lang='pt-BR'`).

> El código del selector (paso 4) es independiente de la traducción (1-3) y puede avanzar en paralelo, pero se **despliega después** de sembrar pt-BR para que el modo PT no se vea vacío.

## Criterios de aceptación

- **Cobertura:** 880 filas `lang='pt-BR'` en la BD (una por cada clave es-MX); 0 faltantes / 0 extras (chequeo de cobertura).
- **Selector** en dashboard y login; cambiar idioma re-renderiza en vivo y persiste en `localStorage 'fc_lang'` + `users.lang`.
- **Auto-detect:** navegador en pt → arranca pt-BR en 1ª visita; resto es-MX.
- **es-MX intacto** (sin regresión; verificado con `verify_esmx.mjs`).
- **pt-BR renderiza el contenido en portugués** en dashboard + un sesgo + los 6 pasos del informe (verificado en navegador), sin errores ni fuga de claves.
- Texto pt-BR = el aprobado por Rodrigo en el TSV.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Traducción inconsistente (terminología) | Glosario compartido + pasada de QA + revisión humana nativa. |
| Claves pt-BR desalineadas de es-MX | TSV generado desde `buildRows()` (claves autoritativas) + chequeo de cobertura. |
| Selector visible pero pt-BR vacío | Sembrar pt-BR **antes** de desplegar el selector; además fallback a es-MX. |
| Alumno pt-BR ve chrome en español | Aceptado para Fase 2; encarar Fase 2b (i18n de UI) poco después. |
| Escritura a prod (siembra) | Idempotente (`ON CONFLICT DO NOTHING`), tras revisión y con OK explícito. |
| `users.lang` PATCH falla | Fire-and-forget; `localStorage 'fc_lang'` ya preserva la elección local. |

## Fuera de alcance (futuro)

- **Fase 2b:** i18n del UI chrome (botones, navegación, labels, login, frases de conclusión) — extraer ~200 cadenas a un dominio `ui.*`, cablear y traducir.
- i18n de `admin.js` (solo Rodrigo; siempre en su idioma).
- Más idiomas (la base ya lo soporta).
