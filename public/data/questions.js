export const questions = [
  {
    id: 1,
    module: 'BIT',
    prompt: 'Você prefere conservar uma reserva ou investir em crescimento agressivo?',
    options: [
      { label: 'A', text: 'Conservar reserva e reduzir risco' },
      { label: 'B', text: 'Investir para crescimento mais agressivo' },
    ],
    metadata: {
      dimension: 'perfil de risco',
      correctAnswer: null,
      qualityScore: 5,
    },
  },
  {
    id: 2,
    module: 'BIT',
    prompt: 'Quando você sente medo de perder dinheiro em um investimento, o que faz?',
    options: [
      { label: 'A', text: 'Sai do investimento rapidamente' },
      { label: 'B', text: 'Mantém posição e analisa os fundamentos' },
    ],
    metadata: {
      dimension: 'comportamento',
      correctAnswer: null,
      qualityScore: 4,
    },
  },
];
