export function bitLabel(code) { return code === 'FK' ? 'FF' : code; }

export const BIT_PROFILES = {
  PP: {
    name: 'Passive Preserver',
    nameEs: 'Preservador Pasivo',
    tagline: 'Emocional · Pasivo — Tu prioridad es proteger lo que tienes',
    color: '#2563EB',
    description: 'Tiendes a priorizar la seguridad y la preservación de tu patrimonio por encima del crecimiento. Tus decisiones financieras están fuertemente influenciadas por el miedo a perder. Eres cuidadoso y constante, pero corres el riesgo de que la inflación erosione tu capital al evitar el riesgo necesario.',
    biases: [
      { name: 'Aversión a la pérdida', desc: 'Sientes las pérdidas con más intensidad que las ganancias equivalentes. Perder $1,000 te duele más de lo que te alegra ganar $1,000.' },
      { name: 'Sesgo de status quo', desc: 'Prefieres mantener las cosas como están, incluso cuando cambiar podría beneficiarte. "Mejor malo conocido que bueno por conocer."' },
      { name: 'Efecto dotación', desc: 'Sobrevaloras lo que ya posees simplemente porque es tuyo, lo que te hace resistente a vender o intercambiar.' },
    ],
    recommendations: [
      'Entiende que la inflación es un riesgo silencioso: no invertir también es arriesgar.',
      'Empieza con instrumentos de bajo riesgo pero con rendimiento real (Cetesdirecto, SOFIPOS).',
      'Establece reglas claras antes de invertir para que las emociones no dominen.',
      'Diversifica gradualmente — no necesitas hacer cambios drásticos, pero sí moverte.',
    ],
  },
  FK: {
    name: 'Friendly Follower',
    nameEs: 'Seguidor Amistoso',
    tagline: 'Cognitivo · Pasivo — Buscas orientación en personas de confianza',
    color: '#7C3AED',
    description: 'Tiendes a buscar la opinión de otros antes de tomar decisiones financieras. No es que no pienses — valoras la validación social y el consejo de figuras de autoridad. Tu riesgo está en confiar en voces que suenan seguras pero no necesariamente tienen razón.',
    biases: [
      { name: 'Efecto manada (Herding)', desc: 'Tiendes a seguir lo que hace la mayoría. Si todos compran, compras. La multitud no siempre tiene razón.' },
      { name: 'Sesgo de autoridad', desc: 'Das demasiado peso a la opinión de figuras que percibes como expertos, sin cuestionar si realmente lo son.' },
      { name: 'Sesgo de disponibilidad', desc: 'Das más importancia a la información más reciente y visible. Si el mercado subió esta semana, crees que seguirá subiendo.' },
    ],
    recommendations: [
      'Desarrolla tu propio criterio: antes de preguntar, escribe qué harías tú y por qué.',
      'Cuestiona las fuentes: ¿esa persona realmente sabe, o solo suena segura?',
      'Diversifica tus fuentes de información — no dependas de una sola persona.',
      'Practica tomando decisiones pequeñas por tu cuenta para construir confianza.',
    ],
  },
  II: {
    name: 'Independent Individualist',
    nameEs: 'Individualista Independiente',
    tagline: 'Cognitivo · Activo — Analizas, investigas y decides por tu cuenta',
    color: '#059669',
    description: 'Eres analítico y autosuficiente. Investigas antes de decidir y confías en tu propio juicio. Tu riesgo está en creer que siempre tienes la razón y que tu análisis es mejor de lo que es en realidad.',
    biases: [
      { name: 'Exceso de confianza', desc: 'Sobreestimas tu capacidad para predecir resultados. Tu análisis puede ser sólido pero no infalible.' },
      { name: 'Sesgo de confirmación', desc: 'Buscas información que confirme lo que ya crees e ignoras la que lo contradice. Tu "investigación" puede ser selectiva.' },
      { name: 'Ilusión de control', desc: 'Crees que puedes controlar o influir en resultados que en realidad son inciertos o aleatorios.' },
    ],
    recommendations: [
      'Busca activamente opiniones contrarias a las tuyas — si solo lees lo que confirma tu tesis, no estás investigando.',
      'Acepta que el mercado puede ser irracional más tiempo del que tú puedes ser solvente.',
      'Lleva un registro de tus predicciones para medir tu precisión real, no la percibida.',
      'Considera que pedir consejo no es debilidad — incluso los mejores analistas tienen puntos ciegos.',
    ],
  },
  AA: {
    name: 'Active Accumulator',
    nameEs: 'Acumulador Activo',
    tagline: 'Emocional · Activo — Actúas rápido y buscas crecimiento',
    color: '#DC2626',
    description: 'Eres decidido, arriesgado y orientado a la acción. Te gusta tomar el control y no te da miedo apostar. Tu riesgo es confundir actividad con progreso — más operaciones no siempre significan mejores resultados.',
    biases: [
      { name: 'Exceso de confianza', desc: 'Tu seguridad al actuar puede hacerte subestimar los riesgos reales.' },
      { name: 'Ilusión de control', desc: 'Crees que al estar activo y tomar decisiones, controlas el resultado. El azar juega un papel mayor de lo que percibes.' },
      { name: 'Sesgo de acción', desc: 'Prefieres hacer algo — lo que sea — antes que no hacer nada. A veces la mejor decisión es esperar.' },
    ],
    recommendations: [
      'Implementa reglas de stop-loss y toma de ganancias ANTES de invertir, no en el momento.',
      'No confundas actividad con productividad — a veces la mejor inversión es no hacer nada.',
      'Antes de actuar por impulso, espera 24 horas. Si mañana sigue pareciendo buena idea, adelante.',
      'Calcula cuánto te han costado tus decisiones impulsivas — el dato te puede sorprender.',
    ],
  },
};
