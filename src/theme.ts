type Theme = 'light' | 'dark';

const THEME_KEY = 'theme';

// Primeira visita: segue o tema do sistema. Depois: a escolha guardada.
function preferredTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // sem acesso ao armazenamento: usa o tema do sistema
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

let current: Theme = preferredTheme();

function applyTheme(): void {
  document.documentElement.dataset.theme = current;
}
applyTheme();

/** Botão ☾/☀ para o topo da página. */
export function createThemeToggle(): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'theme-toggle';

  const sync = (): void => {
    button.textContent = current === 'dark' ? '☀' : '☾';
    const label = current === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
    button.title = label;
    button.setAttribute('aria-label', label);
  };

  button.addEventListener('click', () => {
    current = current === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(THEME_KEY, current);
    } catch (error) {
      console.error('Failed to save theme:', error);
    }
    applyTheme();
    sync();
  });

  sync();
  return button;
}