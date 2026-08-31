import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { COLOR_THEMES, getThemeFromSettings, getWritingSettingsFromSettings } from '../../lib/theme';
import type { PenStyle, ThemeSettings, WritingSettings } from '../../types';

export default function SettingsPicker() {
  const { user, updateSettings } = useAuth();
  const savedTheme = useMemo(() => getThemeFromSettings(user?.settings), [user?.settings]);
  const savedWritingSettings = useMemo(
    () => getWritingSettingsFromSettings(user?.settings),
    [user?.settings]
  );
  const [open, setOpen] = useState(false);
  const [draftTheme, setDraftTheme] = useState<ThemeSettings>(savedTheme);
  const [draftWritingSettings, setDraftWritingSettings] = useState<WritingSettings>(savedWritingSettings);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraftTheme(savedTheme);
  }, [savedTheme]);

  useEffect(() => {
    setDraftWritingSettings(savedWritingSettings);
  }, [savedWritingSettings]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  const selectedPreset = COLOR_THEMES.find(
    (theme) =>
      theme.primaryColor.toLowerCase() === draftTheme.primaryColor.toLowerCase() &&
      theme.secondaryColor.toLowerCase() === draftTheme.secondaryColor.toLowerCase()
  );
  const hasChanges =
    draftTheme.primaryColor.toLowerCase() !== savedTheme.primaryColor.toLowerCase() ||
    draftTheme.secondaryColor.toLowerCase() !== savedTheme.secondaryColor.toLowerCase() ||
    draftTheme.presetId !== savedTheme.presetId ||
    draftWritingSettings.penStyle !== savedWritingSettings.penStyle ||
    draftWritingSettings.brushSensitivity !== savedWritingSettings.brushSensitivity;

  const selectTheme = (theme: ThemeSettings) => {
    setDraftTheme(theme);
    setError('');
    setSavedMessage('');
  };

  const updateCustomColor = (colorKey: 'primaryColor' | 'secondaryColor', color: string) => {
    setDraftTheme((theme) => ({
      ...theme,
      presetId: 'custom',
      [colorKey]: color,
    }));
    setError('');
    setSavedMessage('');
  };

  const updatePenStyle = (penStyle: PenStyle) => {
    setDraftWritingSettings((settings) => ({ ...settings, penStyle }));
    setError('');
    setSavedMessage('');
  };

  const updateBrushSensitivity = (brushSensitivity: number) => {
    setDraftWritingSettings((settings) => ({ ...settings, brushSensitivity }));
    setError('');
    setSavedMessage('');
  };

  const saveSettings = async () => {
    setSaving(true);
    setError('');
    setSavedMessage('');

    try {
      await updateSettings({
        theme: {
          ...draftTheme,
          presetId: selectedPreset?.presetId ?? draftTheme.presetId,
        },
        writing: draftWritingSettings,
      });
      setSavedMessage('Saved');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative" ref={pickerRef}>
      <button
        type="button"
        onClick={() => setOpen((isOpen) => !isOpen)}
        className="flex items-center gap-2 text-xs tracking-wider uppercase text-ink-light hover:text-stamp-red transition-colors"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span
          className="block h-4 w-4 border border-border"
          style={{ background: draftTheme.primaryColor }}
          aria-hidden="true"
        />
        Settings
      </button>

      {open && (
        <div
          className="absolute right-0 mt-4 w-[min(24rem,calc(100vw-2rem))] bg-paper border-2 border-ink shadow-document-hover p-5 z-50"
          role="dialog"
          aria-label="Settings"
        >
          <div className="flex items-center gap-3 mb-4">
            <span className="field-label">Theme</span>
            <div className="flex-1 border-t border-dashed border-border" />
          </div>

          <div className="grid grid-cols-2 gap-2 mb-5">
            {COLOR_THEMES.map((theme) => {
              const active = selectedPreset?.presetId === theme.presetId;

              return (
                <button
                  key={theme.presetId}
                  type="button"
                  onClick={() => selectTheme(theme)}
                  className={`border-2 p-3 text-left transition-all ${
                    active
                      ? 'border-stamp-red bg-stamp-red-light/30'
                      : 'border-border hover:border-stamp-red'
                  }`}
                >
                  <span className="flex h-8 w-full border border-border mb-3" aria-hidden="true">
                    <span className="flex-1" style={{ background: theme.primaryColor }} />
                    <span className="flex-1" style={{ background: theme.secondaryColor }} />
                  </span>
                  <span className="block text-xs tracking-wider uppercase text-ink">
                    {theme.name}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="space-y-4">
            <ColorField
              id="theme-primary"
              label="Main Color"
              value={draftTheme.primaryColor}
              onChange={(color) => updateCustomColor('primaryColor', color)}
            />
            <ColorField
              id="theme-secondary"
              label="Background Color"
              value={draftTheme.secondaryColor}
              onChange={(color) => updateCustomColor('secondaryColor', color)}
            />
          </div>

          <div className="flex items-center gap-3 mt-6 mb-4">
            <span className="field-label">Writing</span>
            <div className="flex-1 border-t border-dashed border-border" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <PenStyleButton
              label="Smooth Pen"
              penStyle="smooth"
              active={draftWritingSettings.penStyle === 'smooth'}
              onSelect={updatePenStyle}
            />
            <PenStyleButton
              label="Brush Pen"
              penStyle="brush"
              active={draftWritingSettings.penStyle === 'brush'}
              onSelect={updatePenStyle}
            />
          </div>

          <label htmlFor="brush-sensitivity" className="block mt-4">
            <span className="flex items-center justify-between gap-3 mb-2">
              <span className="text-xs tracking-wider uppercase text-ink-light">
                Brush Sensitivity
              </span>
              <span className="text-xs text-ink-light font-mono">
                {draftWritingSettings.brushSensitivity}
              </span>
            </span>
            <input
              id="brush-sensitivity"
              type="range"
              min="1"
              max="100"
              step="1"
              value={draftWritingSettings.brushSensitivity}
              onChange={(event) => updateBrushSensitivity(Number(event.target.value))}
              className="w-full cursor-pointer accent-stamp-red"
            />
          </label>

          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              onClick={saveSettings}
              disabled={saving || !hasChanges}
              className="vintage-btn vintage-btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
            <button
              type="button"
              onClick={() => {
                selectTheme(savedTheme);
                setDraftWritingSettings(savedWritingSettings);
              }}
              disabled={!hasChanges || saving}
              className="vintage-btn px-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reset
            </button>
          </div>

          {(error || savedMessage) && (
            <div
              className={`mt-4 border p-3 text-xs tracking-wider uppercase ${
                error
                  ? 'border-stamp-red bg-stamp-red-light/30 text-stamp-red'
                  : 'border-border text-ink-light'
              }`}
            >
              {error || savedMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PenStyleButton({
  label,
  penStyle,
  active,
  onSelect,
}: {
  label: string;
  penStyle: PenStyle;
  active: boolean;
  onSelect: (penStyle: PenStyle) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(penStyle)}
      className={`border-2 p-3 text-left transition-all ${
        active
          ? 'border-stamp-red bg-stamp-red-light/30'
          : 'border-border hover:border-stamp-red'
      }`}
    >
      <span className="flex h-8 items-center mb-3" aria-hidden="true">
        <span
          className={`block bg-stamp-red ${
            penStyle === 'brush' ? 'h-5 w-16 rounded-[50%]' : 'h-2 w-16 rounded-full'
          }`}
          style={{
            transform: penStyle === 'brush' ? 'rotate(-8deg)' : undefined,
            opacity: penStyle === 'brush' ? 0.85 : 1,
          }}
        />
      </span>
      <span className="block text-xs tracking-wider uppercase text-ink">
        {label}
      </span>
    </button>
  );
}

function ColorField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <label htmlFor={id} className="grid grid-cols-[1fr_auto] items-center gap-3">
      <span className="text-xs tracking-wider uppercase text-ink-light">{label}</span>
      <span className="flex items-center gap-2">
        <span className="text-xs text-ink-light font-mono">{value.toUpperCase()}</span>
        <input
          id={id}
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-12 cursor-pointer p-1"
        />
      </span>
    </label>
  );
}
