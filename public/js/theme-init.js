// Runs before first paint, so a saved theme never flashes the wrong colors.
document.documentElement.classList.replace('no-js', 'js');
try {
  const saved = localStorage.getItem('tk-theme');
  if (saved === 'light' || saved === 'dark') document.documentElement.dataset.theme = saved;
} catch (error) {
  console.warn('Saved theme unavailable, using the default light theme.', error);
}
