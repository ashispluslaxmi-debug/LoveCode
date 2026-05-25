import chalk from 'chalk';

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  muted: string;
  border: string;
  background: string;
  surface: string;
  text: string;
  textDim: string;
  selection: string;
}

export interface Theme {
  name: string;
  colors: ThemeColors;
  border: { type: 'single' | 'double' | 'round' | 'bold'; style: string };
  spacing: number;
}

export const themes: Record<string, Theme> = {
  default: {
    name: 'Default',
    colors: {
      primary: '#00afff',
      secondary: '#5f87ff',
      accent: '#ff6b6b',
      success: '#00d787',
      warning: '#ffaf00',
      error: '#ff3333',
      info: '#00afff',
      muted: '#585858',
      border: '#444444',
      background: '#1a1a2e',
      surface: '#16213e',
      text: '#e0e0e0',
      textDim: '#888888',
      selection: '#335577',
    },
    border: { type: 'round', style: '─' },
    spacing: 1,
  },
  dark: {
    name: 'Dark',
    colors: {
      primary: '#00d787',
      secondary: '#00afff',
      accent: '#ff6b6b',
      success: '#00d787',
      warning: '#ffaf00',
      error: '#ff3333',
      info: '#00afff',
      muted: '#444444',
      border: '#333333',
      background: '#0d1117',
      surface: '#161b22',
      text: '#c9d1d9',
      textDim: '#8b949e',
      selection: '#1f6feb',
    },
    border: { type: 'single', style: '─' },
    spacing: 1,
  },
  light: {
    name: 'Light',
    colors: {
      primary: '#0066cc',
      secondary: '#6633cc',
      accent: '#cc3300',
      success: '#008800',
      warning: '#cc8800',
      error: '#cc0000',
      info: '#0066cc',
      muted: '#999999',
      border: '#cccccc',
      background: '#ffffff',
      surface: '#f5f5f5',
      text: '#333333',
      textDim: '#888888',
      selection: '#b3d4fc',
    },
    border: { type: 'single', style: '─' },
    spacing: 1,
  },
  ocean: {
    name: 'Ocean',
    colors: {
      primary: '#4db8ff',
      secondary: '#7c4dff',
      accent: '#ff5252',
      success: '#69f0ae',
      warning: '#ffd740',
      error: '#ff1744',
      info: '#40c4ff',
      muted: '#546e7a',
      border: '#37474f',
      background: '#0d1b2a',
      surface: '#1b2838',
      text: '#e0f7fa',
      textDim: '#78909c',
      selection: '#1565c0',
    },
    border: { type: 'double', style: '═' },
    spacing: 1,
  },
  solarized: {
    name: 'Solarized',
    colors: {
      primary: '#268bd2',
      secondary: '#6c71c4',
      accent: '#dc322f',
      success: '#859900',
      warning: '#b58900',
      error: '#dc322f',
      info: '#2aa198',
      muted: '#657b83',
      border: '#073642',
      background: '#002b36',
      surface: '#073642',
      text: '#839496',
      textDim: '#586e75',
      selection: '#073642',
    },
    border: { type: 'single', style: '─' },
    spacing: 1,
  },
};

export type ThemeName = keyof typeof themes;

let currentTheme: Theme = themes.default;

export function setTheme(name: ThemeName): Theme {
  currentTheme = themes[name] || themes.default;
  return currentTheme;
}

export function getTheme(): Theme {
  return currentTheme;
}

export function getThemeNames(): ThemeName[] {
  return Object.keys(themes) as ThemeName[];
}

export function applyChalk(_theme: Theme): void {
  // chalk is configured globally - this is a no-op
  // colors are applied via c() helper below
}

export function c(colorKey: keyof ThemeColors, text: string): string {
  const hex = currentTheme.colors[colorKey];
  return chalk.hex(hex)(text);
}

export function styled(type: 'header' | 'label' | 'value' | 'dim' | 'error' | 'success' | 'warning' | 'info' | 'accent', text: string): string {
  switch (type) {
    case 'header': return chalk.hex(currentTheme.colors.primary).bold(text);
    case 'label': return chalk.hex(currentTheme.colors.secondary)(text);
    case 'value': return chalk.hex(currentTheme.colors.text)(text);
    case 'dim': return chalk.hex(currentTheme.colors.textDim)(text);
    case 'error': return chalk.hex(currentTheme.colors.error)(text);
    case 'success': return chalk.hex(currentTheme.colors.success)(text);
    case 'warning': return chalk.hex(currentTheme.colors.warning)(text);
    case 'info': return chalk.hex(currentTheme.colors.info)(text);
    case 'accent': return chalk.hex(currentTheme.colors.accent)(text);
    default: return text;
  }
}
