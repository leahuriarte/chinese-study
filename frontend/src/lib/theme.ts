import type { ThemeSettings, UserSettings } from '../types';

export interface ColorTheme extends ThemeSettings {
  name: string;
}

export const DEFAULT_THEME_ID = 'china-blue';

export const COLOR_THEMES: ColorTheme[] = [
  {
    presetId: DEFAULT_THEME_ID,
    name: 'China Blue',
    primaryColor: '#1d4ed8',
    secondaryColor: '#f8fbff',
  },
  {
    presetId: 'seal-red',
    name: 'Seal Red',
    primaryColor: '#c54b3c',
    secondaryColor: '#faf6ee',
  },
  {
    presetId: 'jade-paper',
    name: 'Jade Paper',
    primaryColor: '#0f766e',
    secondaryColor: '#f3fbf7',
  },
  {
    presetId: 'plum-ink',
    name: 'Plum Ink',
    primaryColor: '#8b1e5a',
    secondaryColor: '#fff7fb',
  },
];

const DEFAULT_THEME = COLOR_THEMES[0];
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export function getThemeFromSettings(settings?: UserSettings | null): ThemeSettings {
  const theme = settings?.theme;

  if (
    theme &&
    HEX_COLOR_PATTERN.test(theme.primaryColor) &&
    HEX_COLOR_PATTERN.test(theme.secondaryColor)
  ) {
    return theme;
  }

  return DEFAULT_THEME;
}

export function applyTheme(theme: ThemeSettings = DEFAULT_THEME) {
  const palette = buildPalette(theme.primaryColor, theme.secondaryColor);
  const root = document.documentElement;

  Object.entries(palette).forEach(([property, value]) => {
    root.style.setProperty(property, value);
  });
}

function buildPalette(primaryColor: string, secondaryColor: string) {
  const secondaryIsDark = luminance(hexToRgb(secondaryColor)) < 0.45;
  const ink = secondaryIsDark ? '#f8fbff' : '#172033';
  const inkLight = mix(ink, secondaryColor, secondaryIsDark ? 0.32 : 0.42);

  return {
    '--color-cream': mix(secondaryColor, primaryColor, 0.96),
    '--color-paper': secondaryColor,
    '--color-stamp-red': primaryColor,
    '--color-stamp-red-dark': mix(primaryColor, '#000000', 0.24),
    '--color-stamp-red-light': mix(primaryColor, secondaryColor, 0.8),
    '--color-ink': ink,
    '--color-ink-light': inkLight,
    '--color-border': mix(primaryColor, secondaryColor, 0.68),
    '--color-grid': mix(primaryColor, secondaryColor, 0.9),
  };
}

function hexToRgb(hex: string) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

function rgbToHex({ r, g, b }: { r: number; g: number; b: number }) {
  const channelToHex = (channel: number) =>
    Math.round(channel).toString(16).padStart(2, '0');

  return `#${channelToHex(r)}${channelToHex(g)}${channelToHex(b)}`;
}

function mix(from: string, to: string, amount: number) {
  const fromRgb = hexToRgb(from);
  const toRgb = hexToRgb(to);

  return rgbToHex({
    r: fromRgb.r + (toRgb.r - fromRgb.r) * amount,
    g: fromRgb.g + (toRgb.g - fromRgb.g) * amount,
    b: fromRgb.b + (toRgb.b - fromRgb.b) * amount,
  });
}

function luminance({ r, g, b }: { r: number; g: number; b: number }) {
  const channels = [r, g, b].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}
