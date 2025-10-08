const FALLBACK_GRADIENTS = [
  'linear-gradient(135deg, rgba(255, 99, 132, 0.65), rgba(53, 162, 235, 0.65))',
  'linear-gradient(135deg, rgba(255, 159, 64, 0.65), rgba(75, 192, 192, 0.65))',
  'linear-gradient(135deg, rgba(153, 102, 255, 0.65), rgba(255, 205, 86, 0.65))'
];

export const getGradientFromSeed = (seed: string, offset = 0) => {
  const base = seed || 'fallback';
  const hash = base
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const index = (hash + offset) % FALLBACK_GRADIENTS.length;
  return FALLBACK_GRADIENTS[index];
};

export const gradientPalette = FALLBACK_GRADIENTS;

