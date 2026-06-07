# i18n Fase 1b — Diseño

**Fecha:** 2026-06-06
**Proyecto:** Finanzas Conductuales (Ibero CDMX)
**Estado:** Diseño aprobado, pendiente de plan de implementación
**Tarea Notion:** [🌎 IBERO i18n Fase 1](https://app.notion.com/p/349f4525168281c49388e35dc716fa4d)

## Contexto

Fase 0 (commit `b28da7f`) creó la tabla `translations(key, lang, text, domain, comment, updated_at)`
(PK `(key,lang)`) y la columna `users.lang DEFAULT 'es-MX'`. Fase 1a (commit `05126aa`)
sembró **786 filas es-MX** extraídas de los archivos de datos vía
`scripts/extract_translations.mjs` (script idempotente):

- `question` = 100 (20 preguntas)
- `sesgo` = 630 (15 sesgos)
- `profile` = 56 (4 perfiles)

Hoy la app **no usa esas filas**: `app.js` sigue leyendo el texto directamente de
`public/data/questions.js`, `sesgos.js` y `profiles.js`. Fase 1b conecta la app a la BD.

## Objetivo

Que `app.js` cargue las traducciones desde Supabase en el arranque y use un helper
`t(clave, respaldo)` en lugar de leer el texto de los archivos de datos — **sin cambiar
nada visible en es-MX**. Además, mover a la BD el contenido educativo que hoy está
escrito *inline* en `app.js` (mecanismos, antídotos, matriz de decisión, próximos pasos),
que no se extrajo en Fase 1a.

## Decisiones tomadas (con el usuario)

1. **Alcance:** preguntas/sesgos/perfiles **+** contenido inline del informe
   (`MECANISMOS`, `ANTIDOTOS`, `DECISION_MATRIX`) **+** `NEXT_STEPS_OPTIONS`.
   El texto de interfaz (botones, etiquetas, navegación) queda **hardcoded** para una fase posterior.
2. **Fallback:** el texto **se mantiene** en los archivos de datos como red de seguridad.
   `t(clave, respaldo)` devuelve el respaldo si falta la clave. (Difiere del criterio de
   aceite original de la tarea Notion, que pedía borrar el texto; se eligió la opción más
   segura, que además mantiene funcionando el script de extracción.)
3. **`admin.js`:** **fuera de alcance**. Lo usa solo el dueño del curso y siempre en su
   idioma; sus mapas hardcoded (`SESGO_NAMES`, `PROFILE_NAMES`, `TYPE_LABEL`,
   `BLOCK_LABELS`) quedan como están.

## Arquitectura

### Módulos nuevos / modificados

| Archivo | Cambio |
|---|---|
| `public/js/i18n.js` | **NUEVO.** Diccionario en memoria + `t(key, fallback)` + `setLang`/`getLang` + `loadTranslations(lang)` (caché en localStorage). |
| `public/js/supabase.js` | **+** `fetchTranslations(lang)` — único punto de acceso REST (regla del proyecto: todo Supabase pasa por aquí). |
| `public/data/report-content.js` | **NUEVO.** Exporta `MECANISMOS`, `ANTIDOTOS`, `DECISION_MATRIX`, `NEXT_STEPS_OPTIONS` (movidos desde `app.js`). Sirve de respaldo y de fuente para el script de extracción. |
| `public/js/app.js` | Importa de `i18n.js` y `report-content.js`; integra la carga en el boot; cablea los 40 sitios ya sembrados + los consumidores del contenido inline con `t()`. |
| `scripts/extract_translations.mjs` | Importa `report-content.js` y emite las claves nuevas del dominio `report`. |
| `scripts/i18n_seed_*.sql` | Regenerado con las filas nuevas (idempotente, `ON CONFLICT DO NOTHING`). |

### `i18n.js` — API

```js
let store = {};        // { clave: texto } del idioma activo
let activeLang = 'es-MX';

export function getLang() { return activeLang; }
export function setLang(lang) { activeLang = lang; }

// Devuelve la traducción; si falta, el respaldo (texto del archivo = es-MX); si no, la clave.
export function t(key, fallback) {
  const v = store[key];
  return (v === undefined || v === null) ? (fallback ?? key) : v;
}

// 1 fetch del idioma + caché en localStorage. Nunca lanza: si falla, usa caché o queda vacío.
export async function loadTranslations(lang) { /* fetchTranslations + build store + cache */ }
```

`fetchTranslations(lang)` en `supabase.js`:
`GET /rest/v1/translations?lang=eq.<lang>&select=key,text`.

### Integración en el boot (`app.js`, líneas ~2924-2926)

Carga **no bloqueante**. El render inicial usa los respaldos (idéntico a hoy) y, cuando
las traducciones llegan, re-renderiza:

```js
const bootLang = localStorage.getItem('fc_lang') || 'es-MX';
setLang(bootLang);
render();                                   // pinta ya, con respaldos
loadTranslations(bootLang).then(() => render());  // re-render al cargar
loadSession();
mountBugReportWidget();
```

En `loadSession`, una vez conocido `state.user`, si `users.lang !== getLang()` →
`setLang(user.lang)` + `loadTranslations(user.lang).then(render)`. Hoy es inerte (todos
es-MX); habilita pt-BR en Fase 2 sin tocar de nuevo el boot.

**Por qué no rompe es-MX:** el texto es-MX de la BD es idéntico al de los archivos, así
que `t()` devuelve lo mismo cargue o no la BD. Sin pantalla en blanco, sin cambio visual,
sin dependencia de red para funcionar.

## Esquema de claves

### Existentes (dominio = primer segmento) — NO cambiar, ya sembradas

```
question.<id>.prompt                       # id numérico 1..20
question.<id>.opt.<label>.text             # label = A|B|C|D (persistente, NO posición mostrada)
sesgo.<id>.name | definition | description | mechanism | trapQuestion
sesgo.<id>.example.<i>.{label,text}
sesgo.<id>.antidote.<i>
sesgo.<id>.question.<i>.situation
sesgo.<id>.question.<i>.option.<j>.{text,reveal}   # j = índice original (origIdx)
sesgo.<id>.fixation.<i>.question
sesgo.<id>.fixation.<i>.option.<j>                 # opciones = strings planos
profile.<code>.{name,nameEs,tagline,description}   # code = PP|FK|II|AA
profile.<code>.bias.<i>.{name,desc}                # campo es 'desc', no 'description'
profile.<code>.recommendation.<i>
```

> `profile.<code>.nameEs` está sembrado pero **ningún consumidor lo usa** — dato muerto,
> inofensivo, no cablear.

### Nuevas (dominio `report`) — a sembrar en Checkpoint 2

```
report.mecanismo.<id>.{name,phrase,desc,relation}   # id = dolor|ego|econ|grupo|tiempo  (5×4=20)
report.antidoto.<id>.{name,what,how}                # id = precom|diario|s2|votcie|testnd|premortem|steelman|chklist  (8×3=24)
report.matrix.<code>.<i>.{sit,tendency,rational}    # code = PP|FK|AA|II ; i=0..2  (4×3×3=36)
report.nextstep.<id>.{label,hint}                   # id = otro-curso|saber-mas|...  (7×2=14)
```

Total nuevo: **94 filas es-MX** (20+24+36+14). Campos de estructura (`id`, `icon`, `color`,
`coverage`, `weights`, `key`, `num`, `hidden`) **no se traducen**.

## Trampas técnicas (deben respetarse al cablear)

1. **Opciones barajadas.** `getShuffledOptions(key, options)` devuelve
   `[{opt, origIdx, displayIdx}]` donde `opt = options[origIdx]`. La clave de traducción
   se arma con el identificador **original**, nunca con `displayIdx`:
   - BIT: `question.${q.id}.opt.${opt.label}.text` (usa `opt.label` A–D).
   - Sesgo quiz: `sesgo.${s.id}.question.${i}.option.${origIdx}.text` (y `.reveal`).
   - Fijación: `sesgo.${s.id}.fixation.${i}.option.${origIdx}` (opción = string plano).
   La **letra mostrada** sigue siendo `'ABCD'[displayIdx]`; solo la **clave** usa el original.
   > Bug intermitente si se equivoca: solo falla en algunos barajados. Verificar con barajado forzado.

2. **Nombres de segmento exactos.** Sesgos usan palabras completas `question`/`fixation`/`option`;
   BIT usa `opt`. Deben calcar el script de extracción o el lookup falla (cae al respaldo silenciosamente).

3. **`opt.reveal`** (explicación tras responder, `app.js:1779-1780`) se traduce junto con `opt.text`.

4. **Concatenaciones** (`name + ' · ' + tagline`): cada fragmento se envuelve en su propio
   `t()`; el separador ` · ` es maquetación, no se traduce.

5. **`FK` nunca se renombra** (clave de perfil guardada en Supabase). `bitLabel()` sigue
   mostrando "FF" y **no** se traduce.

## Inventario de consumidores

**`app.js` — datos ya sembrados (40 sitios):** question=11, sesgo=18, profile=11.
Lista completa con `file:line` en el mapa de la sesión (workflow `i18n-fase1b-map`).

**`app.js` — contenido inline (Checkpoint 2):** consumidores en las funciones del informe
final (p. ej. `renderReportStep4_Mecanismos` ~`app.js:2058`), la sección de antídotos, la
matriz de decisión, y `renderNextSteps`. Se mapean con precisión en el plan de implementación.

**Fuera de alcance (queda en español para pt-BR — hueco documentado, no olvido):**
`LEARN_BLOCKS` (títulos "¿Qué es?"/"¿Cómo funciona?"…), `JOURNEY_STAGES` (nav),
`SLIDER_LABELS`, `RATING_LABELS`, etiquetas sueltas ("Módulo N", "La trampa del
cuestionario:", botones) y todo `admin.js`.

## Estrategia de despliegue (2 checkpoints)

**Checkpoint 1 — infraestructura + datos ya sembrados**
1. Crear `i18n.js` y `fetchTranslations` en `supabase.js`.
2. Integrar la carga en el boot.
3. Cablear los 40 sitios de preguntas/sesgos/perfiles con `t(clave, respaldo)`.
4. Deploy → **verificar es-MX idéntico**.

**Checkpoint 2 — contenido inline**
1. Mover `MECANISMOS`/`ANTIDOTOS`/`DECISION_MATRIX`/`NEXT_STEPS_OPTIONS` a `report-content.js`.
2. Extender `extract_translations.mjs` (dominio `report`), regenerar SQL, sembrar 94 filas es-MX.
3. Cablear esos consumidores con `t()`.
4. Deploy → **verificar**.

## Criterios de aceptación

- La app se ve y funciona **idéntica en es-MX** (cargando de la BD, con respaldo).
- Cero errores nuevos en consola; `question_responses` intacto (IDs preservados).
- Las opciones barajadas muestran la traducción correcta (prueba con barajado forzado).
- **Chequeo de alineación:** un script/función dev que compara cada fila es-MX de la BD
  contra el texto del archivo de datos y avisa si hay desalineación (detecta drift).
- `report-content.js` es la única fuente del contenido inline (sin duplicación en `app.js`).

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Clave mal armada → cae al respaldo en silencio (se ve es-MX en pt-BR) | Chequeo de alineación + prueba de barajado forzado; helpers de construcción de clave para los casos de opciones. |
| Boot async re-renderiza sobre interacción del usuario | El re-render solo ocurre una vez al cargar; en es-MX el resultado es idéntico, sin parpadeo. |
| Mover contenido inline rompe cálculos (mecanismos usan `coverage`/`weights`) | Solo se mueven las estructuras completas; los campos de estructura se conservan; `import` reemplaza la definición inline sin cambiar la forma. |
| `app.js` ya tiene 2926 líneas | Sacar `i18n` a su módulo y el contenido a `report-content.js` reduce, no aumenta, el tamaño de `app.js`. |

## Fuera de alcance (fases futuras)

- pt-BR real (traducción + siembra) — Fase 2.
- Selector de idioma en la UI — Fase 2/3 (inútil hasta que exista pt-BR).
- i18n del chrome de UI (botones, navegación, etiquetas) — fase aparte.
- i18n de `admin.js` — cuando se necesite vista bilingüe en el backoffice.
- Borrar el texto de los archivos de datos — posible limpieza futura, una vez con pt-BR
  estable y confianza alta (hoy se mantiene como respaldo a propósito).
