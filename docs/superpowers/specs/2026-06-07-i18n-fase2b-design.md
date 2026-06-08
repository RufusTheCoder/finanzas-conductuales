# i18n Fase 2b — UI chrome — Diseño

**Fecha:** 2026-06-07
**Proyecto:** Finanzas Conductuales (Ibero CDMX)
**Estado:** Diseño aprobado, pendiente de plan
**Depende de:** Fase 1b + Fase 2 (✅ deployadas — contenido es-MX + pt-BR en `translations`, helper `t()`, selector ES/PT, fallback es-MX, `setUserLang`, auto-detect).

## Contexto

El contenido educativo ya está en pt-BR (880 filas), pero el **UI chrome** sigue hardcodeado en español en `app.js` (~200 cadenas: botones, navegación, tabs de jornada, módulos, wizard del informe "PASO N"/"Siguiente", login, toasts). Un alumno pt-BR ve el contenido en portugués pero el chrome en español. Fase 2b cierra ese hueco.

## Objetivo

Llevar todo el **chrome del alumno** a la tabla `translations` (dominio `ui.*`) y cablearlo con `t()`, soportando textos con variables (interpolación) y plurales, sin regresión en es-MX.

## Decisiones tomadas (con el usuario)

1. **Interpolación:** extender `t()` para soportar marcadores `{nombre}` (Opción A). Es la única forma de traducir bien el chrome dinámico (contadores, tiempos, frases del informe).
2. **Alcance:** todo el chrome **visible para el alumno** en `app.js`. **Fuera:** `admin.js` (solo el dueño, en su idioma) y `privacy.html` (texto legal aparte).
3. **Arquitectura:** dominio `ui.*` en la misma tabla `translations` (reutiliza selector + fallback + siembra ya existentes).

## Arquitectura

### Extensión de `t()` (compatible hacia atrás)

Firma actual: `t(key, fallback)`. Nueva: `t(key, fallback, params)`.

```js
export function t(key, fallback, params) {
  let v = store[key];
  v = (v === undefined || v === null) ? (fallback !== undefined ? fallback : key) : v;
  if (params) v = String(v).replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined ? params[k] : m));
  return v;
}
```

- `params` es opcional → las 880 llamadas de contenido existentes (sin params) **no cambian**.
- Marcador `{nombre}` se reemplaza por `params.nombre`; si falta un param, se deja el marcador literal (señal visible de error, no rompe).
- El **fallback** sigue siendo la expresión española original ya interpolada → es-MX nunca se rompe aunque falte la fila o falle la red. (Cuando el fallback se usa, ya no tiene `{huecos}`, así que el replace no afecta.)

### Esquema de claves: `ui.<área>.<slug>`

Áreas: `auth`, `nav`, `dash`, `journey`, `bit`, `sesgo`, `learn`, `report`, `next`, `common`, `rating`. Slug descriptivo en kebab-case. Ejemplos:
- `ui.nav.logout` = "Salir"
- `ui.report.stepCounter` = "Paso {step} de {total}"
- `ui.dash.greeting` = "Hola, {name}"
- `ui.sesgo.quizCounter` = "¿Cómo decides tú? · {n} de {total}"

### Valor sembrado vs. fallback

Por cada sitio cableado:
- **Fallback** (2º arg) = la expresión española original (interpolada en vivo). Garantiza es-MX.
- **Valor es-MX sembrado** = el mismo texto pero con `{huecos}` en lugar de las variables. Es la fuente canónica para traducir.
- **Valor pt-BR sembrado** = la traducción con los mismos `{huecos}`.

Ejemplo de cableado:
```js
// antes
<div class="quiz-label">Paso ${step} de ${TOTAL}</div>
// después
<div class="quiz-label">${t('ui.report.stepCounter', `Paso ${step} de ${TOTAL}`, { step, total: TOTAL })}</div>
```

### Casos especiales

- **Plurales** (ej. "módulo/módulos"): dos claves elegidas por el código según el número.
  `t(n === 1 ? 'ui.dash.remaining.one' : 'ui.dash.remaining.other', fb, { n })`.
  es: "Te quedan {n} módulo" / "…{n} módulos"; pt: "Falta {n} módulo" / "Faltam {n} módulos".
- **Frases con HTML/variables incrustadas** (conclusión del informe): se guardan con `{huecos}` y HTML literal (`<strong>{mech}</strong> ({pct}%)`), y el nombre del mecanismo se pasa **ya traducido** desde `report.mecanismo.<id>.name`. Esto además traduce las frases de conclusión que en Fase 1b quedaron en español.
- **Arrays de etiquetas** (`SLIDER_LABELS`, `RATING_LABELS`): cada ítem una clave (`ui.rating.slider.0`…), o se reconstruyen vía `t()` por índice.
- **HTML escaping:** el chrome se interpola igual que hoy (sin escape); `t()` devuelve string, mismo comportamiento.

## Pipeline (reusa Fase 1b/2)

1. **Extender `t()`** (+ test unitario de interpolación). Deploy-safe (compat hacia atrás).
2. **Inventariar + extraer** (workflow): recorrer `app.js`, identificar cada cadena de chrome del alumno, asignar clave `ui.*`, parametrizar variables → produce (a) mapa `{clave: es_con_huecos}` y (b) lista de ediciones `viejo → t(...)` por sitio.
3. **Cablear** los ~200 sitios (subagentes por región/área, con verificación + grep de completitud), reemplazando el inline por `t('ui...', <original como fallback>, {params})`.
4. **Sembrar es-MX `ui.*`** (el mapa extraído) + **traducir a pt-BR** (workflow → TSV `ui.*` para revisión de Rodrigo → sembrar pt-BR).
5. **Deploy** (bump de caché; merge a master) + **verificar** es-MX (regresión) y pt-BR en navegador.

> Checkpoints: (1) `t()` + un área piloto (p. ej. el wizard del informe) → deploy → verificar; (2) resto de áreas → deploy. Reduce el riesgo del refactor más grande.

## Criterios de aceptación

- **es-MX byte-idéntico** (regresión): toda la app se ve igual en español (verificado con `verify_esmx.mjs`).
- **pt-BR**: el chrome del alumno (dashboard, tabs, módulos, wizard del informe, login, botones) renderiza en portugués, con contadores/tiempos/plurales correctos (ej. "Passo 3 de 6", "Faltam 4 módulos").
- **Cobertura:** cada clave `ui.*` tiene fila es-MX y pt-BR (chequeo de cobertura).
- Cero `pageErrors`, cero fuga de claves crudas (`ui.`/`{hueco}` sin rellenar visibles).
- Las 880 llamadas de contenido existentes intactas (params opcional).

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Refactor grande (~200 sitios) | Subagentes por área + grep de completitud + verificación en navegador, en checkpoints. |
| Orden de palabras / plurales es↔pt | Marcadores nombrados (no posicionales) + 2 claves para plurales; revisión nativa (Rodrigo) del TSV. |
| Hueco sin rellenar (param faltante) | `t()` deja el `{hueco}` literal (visible) en vez de romper; verificación lo detecta. |
| Romper es-MX | Fallback = expresión original; nunca peor que hoy. |
| Selector/área no cubierta | Inventario exhaustivo + grep de cadenas español residuales por área. |

## Fuera de alcance

- `admin.js` (backoffice del dueño).
- `privacy.html` (texto legal — esfuerzo separado si se quiere).
- Idiomas adicionales (la base ya lo soporta).
