import type { PenStyle, ThemeSettings, UserSettings, WritingSettings } from '../types';

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
const DEFAULT_WRITING_SETTINGS: WritingSettings = {
  penStyle: 'smooth',
  brushSensitivity: 75,
};
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const PEN_STYLES = new Set<PenStyle>(['smooth', 'brush']);

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

export function getWritingSettingsFromSettings(settings?: UserSettings | null): WritingSettings {
  const penStyle = settings?.writing?.penStyle;
  const brushSensitivity = settings?.writing?.brushSensitivity;

  return {
    penStyle: penStyle && PEN_STYLES.has(penStyle)
      ? penStyle
      : DEFAULT_WRITING_SETTINGS.penStyle,
    brushSensitivity: typeof brushSensitivity === 'number' && Number.isFinite(brushSensitivity)
      ? Math.min(100, Math.max(1, Math.round(brushSensitivity)))
      : DEFAULT_WRITING_SETTINGS.brushSensitivity,
  };
}

export function applyTheme(theme: ThemeSettings = DEFAULT_THEME) {
  const palette = buildPalette(theme.primaryColor, theme.secondaryColor);
  const root = document.documentElement;

  Object.entries(palette).forEach(([property, value]) => {
    root.style.setProperty(property, value);
  });

  window.dispatchEvent(new CustomEvent('app-theme-change'));
}

function buildPalette(primaryColor: string, secondaryColor: string) {
  const secondaryIsDark = luminance(hexToRgb(secondaryColor)) < 0.45;
  const ink = contrastRatio(secondaryColor, '#172033') >= contrastRatio(secondaryColor, '#f8fbff')
    ? '#172033'
    : '#f8fbff';
  const inkLight = mix(ink, secondaryColor, secondaryIsDark ? 0.08 : 0.16);
  const accent = ensureContrast(primaryColor, secondaryColor, ink, 4.5);
  const onAccent = contrastRatio(accent, '#172033') >= contrastRatio(accent, '#f8fbff')
    ? '#172033'
    : '#f8fbff';

  return {
    '--color-cream': mix(secondaryColor, primaryColor, 0.04),
    '--color-paper': secondaryColor,
    '--color-stamp-red': accent,
    '--color-stamp-red-dark': mix(accent, onAccent, 0.2),
    '--color-stamp-red-light': mix(accent, secondaryColor, 0.78),
    '--color-accent-contrast': onAccent,
    '--color-ink': ink,
    '--color-ink-light': inkLight,
    '--color-border': mix(ink, secondaryColor, secondaryIsDark ? 0.54 : 0.72),
    '--color-grid': mix(ink, secondaryColor, secondaryIsDark ? 0.74 : 0.88),
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

function ensureContrast(color: string, background: string, mixTarget: string, minimumRatio: number) {
  if (contrastRatio(color, background) >= minimumRatio) {
    return color;
  }

  for (let amount = 0.12; amount <= 1; amount += 0.08) {
    const candidate = mix(color, mixTarget, amount);
    if (contrastRatio(candidate, background) >= minimumRatio) {
      return candidate;
    }
  }

  return mixTarget;
}

function contrastRatio(first: string, second: string) {
  const firstLuminance = luminance(hexToRgb(first));
  const secondLuminance = luminance(hexToRgb(second));
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

function luminance({ r, g, b }: { r: number; g: number; b: number }) {
  const channels = [r, g, b].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}
