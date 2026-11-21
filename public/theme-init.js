try {
  const savedMode = localStorage.getItem('pranapulse_theme_mode');
  document.documentElement.dataset.mode =
    savedMode === 'light' || savedMode === 'dark' ? savedMode : 'dark';
} catch {
  document.documentElement.dataset.mode = 'dark';
}
