// Stage 2 initialization logic
export function init(gameState) {
  const storedStars = localStorage.getItem('rpi-stars');
  const parsed = storedStars !== null ? Number.parseInt(storedStars, 10) : NaN;
  gameState.stars = Number.isNaN(parsed) ? 0 : parsed;
  localStorage.removeItem('rpi-stars');
}
