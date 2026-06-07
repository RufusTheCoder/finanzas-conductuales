// Educational content for the final report + next-steps screen.
// Moved out of app.js so it can be both the es-MX fallback (imported by app.js)
// and the source for scripts/extract_translations.mjs (i18n Fase 1b).

// ── MECANISMOS + DATOS CLASE 23 ──────────────────
export const MECANISMOS = [
  { id: 'dolor', icon: '🔴', name: 'Aversión al Dolor', color: '#922B21', phrase: 'El cerebro evita registrar pérdidas',
    desc: 'El cerebro siente el dolor de perder aproximadamente el doble que el placer de ganar (Kahneman & Tversky). Para evitar ese dolor, distorsiona la realidad — aplaza decisiones, inventa justificaciones, se aferra al pasado.',
    relation: 'Los sesgos de este mecanismo te hacen mantener inversiones perdedoras "para no realizar la pérdida", valorar de más lo que ya posees, y seguir metiendo dinero en decisiones fallidas por el costo hundido.' },
  { id: 'ego', icon: '🛡️', name: 'Protección del Ego', color: '#6C3483', phrase: 'El cerebro distorsiona hechos para preservar la autoimagen',
    desc: 'Tenemos una necesidad profunda de mantener una autoimagen positiva y coherente. Cuando la realidad amenaza esa imagen, el cerebro prefiere distorsionar los hechos antes que revisar la creencia sobre sí mismo.',
    relation: 'Los sesgos de este mecanismo te hacen ver solo la información que confirma tu tesis, atribuir tus éxitos a tu habilidad y los fracasos al mercado, y sobreestimar sistemáticamente tu precisión al predecir.' },
  { id: 'econ', icon: '⚡', name: 'Economía Cognitiva', color: '#1A5276', phrase: 'El cerebro sustituye preguntas difíciles por atajos',
    desc: 'El cerebro es perezoso por diseño — pensar quema energía. Para ahorrarla, sustituye preguntas difíciles ("¿cuál es el valor intrínseco?") por atajos fáciles ("¿cómo se ve?"). El problema es que no avisa cuando lo está haciendo.',
    relation: 'Los sesgos de este mecanismo te hacen anclarte en el primer número que viste, tratar el dinero de modo diferente según su origen, y juzgar probabilidades por la facilidad con que recuerdas ejemplos.' },
  { id: 'grupo', icon: '🔥', name: 'Necesidad de Pertenencia', color: '#1E8449', phrase: 'El cerebro terceriza decisiones al grupo',
    desc: 'El aislamiento fue históricamente peligroso; por eso desarrollamos un instinto potente de alinearnos con el consenso, especialmente bajo incertidumbre. El cerebro trata al grupo como proxy de la verdad.',
    relation: 'Los sesgos de este mecanismo te hacen entrar a inversiones porque "todos están entrando", obedecer a figuras de autoridad sin cuestionar, y generalizar una buena impresión a toda una empresa o persona.' },
  { id: 'tiempo', icon: '⏳', name: 'Presente vs. Futuro', color: '#9A7D0A', phrase: 'El cerebro sobrevalora el ahora',
    desc: 'El cerebro tiene dificultad genuina para imaginar al yo futuro como una persona real. Esta asimetría nos empuja a sacrificar sistemáticamente el futuro por el presente — no por falta de información, sino por una limitación cognitiva.',
    relation: 'Los sesgos de este mecanismo te hacen mantener el status quo por inercia, fallar en el ahorro de largo plazo por gastar hoy, y postergar decisiones importantes cuando requieren esfuerzo presente.' },
];

export const ANTIDOTOS = [
  { id: 'precom', icon: '📌', name: 'Pre-compromiso', coverage: [2, 0, 1, 1, 2],
    what: 'Tomar la decisión en frío, por escrito y por adelantado — antes de que aparezca la situación emocional.',
    how: 'Define hoy reglas claras: "Si el mercado cae X%, rebalanceo. Si tengo sobrante a fin de mes, va automático a mi fondo indexado." Automatiza donde puedas (transferencias programadas) para que tu yo futuro no tenga que decidir en el momento.' },
  { id: 'diario', icon: '📓', name: 'Diario de Decisiones', coverage: [1, 2, 1, 0, 0],
    what: 'Registro escrito de cada decisión de inversión: tesis, razones, resultado esperado, fecha — para poder revisar después si hubo habilidad o suerte.',
    how: 'Antes de cada inversión, escribe en 5 líneas: "Compro X porque Y. Espero Z resultado para la fecha W. Vendo si pasa A." Revisa mensualmente. Con el tiempo verás el patrón real de tus aciertos vs tus justificaciones post-hoc.' },
  { id: 's2', icon: '🧘', name: 'Activar Sistema 2', coverage: [1, 1, 2, 1, 1],
    what: 'Interrumpir deliberadamente el modo automático (Sistema 1, rápido y emocional) para pasar al modo analítico (Sistema 2, lento y deliberado) antes de decidir.',
    how: 'Impón una pausa: 24 horas entre el impulso y la acción. Durante esa pausa, hazte 3 preguntas por escrito: "¿Qué información me falta? ¿Qué asumo sin verificar? ¿Cómo sabré si me equivoqué?" Si las respuestas no son claras, no decidas aún.' },
  { id: 'votcie', icon: '🗳️', name: 'Votación Ciega', coverage: [0, 1, 0, 2, 0],
    what: 'Expresar tu opinión por escrito antes de escuchar la del grupo, para evitar que el consenso te contamine.',
    how: 'En reuniones o comités: antes de abrir la discusión, cada participante escribe su posición en un papel. Se revelan simultáneamente. Así se rompe el efecto cascada donde todos se alinean con el primero que habló.' },
  { id: 'testnd', icon: '💰', name: 'Test del Dinero Nuevo', coverage: [1, 0, 0, 0, 2],
    what: 'Tratar cada peso como si acabara de llegar a tus manos — ignorando su origen y tu historial con él.',
    how: 'Ante una inversión perdedora pregúntate: "Si me dieran este dinero hoy en efectivo, ¿compraría esta posición?" Si la respuesta es no, véndela. El precio al que compraste es irrelevante — solo cuenta el presente y el futuro.' },
  { id: 'premortem', icon: '🔍', name: 'Pre-mortem', coverage: [0, 2, 1, 0, 0],
    what: 'Imaginar que tu decisión ya fracasó, y retroceder para identificar por qué — antes de tomarla.',
    how: 'Antes de actuar, escribe: "Estamos en 12 meses en el futuro. Esta inversión fue un desastre. ¿Qué salió mal?" Enumera 5 razones plausibles. Si alguna tiene probabilidad real, ajusta el plan o no inviertas. Funciona porque desactiva el exceso de optimismo.' },
  { id: 'steelman', icon: '⚔️', name: 'Steel-manning', coverage: [0, 2, 0, 1, 0],
    what: 'Construir el mejor argumento posible CONTRA tu propia tesis — el opuesto al "straw-man" que simplifica al oponente.',
    how: 'Antes de invertir: escribe el caso más fuerte para NO hacerlo. Busca activamente análisis contrarios, bajistas, críticos. Si después de leer el mejor contra-argumento sigues convencido, procede. Si no puedes formular un contra-argumento serio, probablemente tienes confirmation bias.' },
  { id: 'chklist', icon: '✅', name: 'Checklist de Sistema 2', coverage: [0, 0, 2, 0, 0],
    what: 'Lista fija de preguntas que te obligas a responder antes de cualquier decisión financiera — como los pilotos antes de despegar.',
    how: 'Arma tu checklist de 5–7 ítems: "¿Conozco los costos? ¿Cuál es el peor escenario? ¿Cuánto perdería? ¿Qué evidencia contraria ignoré? ¿Esto cabe en mi plan?" Fuerza la pausa analítica y evita decisiones por impulso o por historia coherente pero no verificada.' },
];

export const DECISION_MATRIX = {
  PP: [
    { sit: 'Mercado cae 15% en una semana', tendency: 'Paralizarte o vender en pánico al peor precio para "detener el dolor".', rational: 'Rebalancear según tu asignación objetivo. Si la tesis no cambió, las caídas son oportunidades — no razones para salir.' },
    { sit: 'Te ofrecen una inversión nueva', tendency: 'Rechazar por defecto — "mejor lo conocido que lo seguro desconocido".', rational: 'Evaluar contra tu marco de decisión escrito. Si cumple los criterios, invertir una fracción pequeña de prueba.' },
    { sit: 'Sobra dinero a fin de mes', tendency: 'Dejarlo acumulándose en la cuenta de ahorros.', rational: 'Contribución automática (pre-compromiso) a tu portafolio diversificado — decidida en frío, ejecutada en automático.' },
  ],
  FK: [
    { sit: 'Un amigo te habla de una "oportunidad única"', tendency: 'Entrar rápido por FOMO, sin investigar los fundamentos.', rational: 'Escribir tu tesis independiente antes de consultarlo con nadie más. Si después de 48 horas sigue atractiva, entonces valorar posición pequeña.' },
    { sit: 'Mercado sube fuertemente durante meses', tendency: 'Entrar tarde al rally cuando todos ya hablan de eso.', rational: 'Ceñirte al plan previo. La multitud que entra tarde suele ser la que vende primero cuando cae.' },
    { sit: 'Comité de inversión con mayoría que opina X', tendency: 'Alinearte al consenso grupal para no discrepar.', rational: 'Votación ciega escrita antes de la discusión. Expresar la opinión contraria aunque incomode.' },
  ],
  AA: [
    { sit: 'Un trade te da un retorno extraordinario', tendency: 'Atribuirlo a tu habilidad y aumentar exposición en el siguiente.', rational: 'Diario de decisiones — documentar si la tesis original se cumplió o si fue suerte. Mantener el tamaño de posición pre-definido.' },
    { sit: 'Tienes una idea "obvia" y muy convencida', tendency: 'Concentrar una fracción grande del portafolio en esa tesis.', rational: 'Pre-mortem: asumir que dentro de 12 meses la idea resultó errada — ¿por qué? Diversificación forzada con topes de concentración.' },
    { sit: 'Un stop-loss se dispara', tendency: 'Ignorarlo y promediar a la baja — "el mercado está equivocado".', rational: 'Ejecutar el stop exactamente como se definió en frío. La tesis se revisa después, con cabeza fría, no durante la caída.' },
  ],
  II: [
    { sit: 'Tu análisis contradice al consenso del mercado', tendency: 'Ignorar el consenso — "ellos no ven lo que yo veo".', rational: 'Steel-manning: escribe el mejor argumento que justifica la posición contraria. Si no puedes, probablemente tienes confirmation bias.' },
    { sit: 'Investigas un sector nuevo y te sientes experto rápido', tendency: 'Tomar posiciones sofisticadas basadas en tu análisis propio.', rational: 'Activación deliberada del Sistema 2: checklist de preguntas — ¿qué no sé? ¿qué asumo? ¿qué evidencia contraria hay? Posición pequeña mientras calibras.' },
    { sit: 'Un asesor te sugiere reducir concentración', tendency: 'Desestimar el consejo — "no entiende mi tesis".', rational: 'Diario de decisiones: ¿cuántas veces en el pasado el exceso de confianza costó más que la prudencia? Evaluar la concentración con criterios objetivos.' },
  ],
};

export const NEXT_STEPS_OPTIONS = [
  { id: 'otro-curso',   label: 'Otro curso en este mismo formato',       hint: 'ej. Negociación, Inversiones, Valuación' },
  { id: 'saber-mas',    label: 'Saber más sobre finanzas conductuales',  hint: 'Lecturas, videos, referencias para profundizar' },
  { id: 'herramientas', label: 'Herramientas prácticas para mitigar sesgos', hint: 'Plantillas, checklists, rutinas accionables' },
  { id: 'coaching',     label: 'Coaching 1:1 sobre mi perfil BIT',       hint: 'Sesiones individuales con Rodrigo' },
  { id: 'comunidad',    label: 'Comunidad de ex-alumnos',                hint: 'Grupo para seguir aprendiendo y compartir casos' },
  { id: 'corporativa',  label: 'Capacitación corporativa Pandava',       hint: 'Llevar este programa a tu equipo o empresa', hidden: true },
  { id: 'informe-pdf',  label: 'Informe PDF exportable',                 hint: 'Descargar tu informe final en PDF' },
];
