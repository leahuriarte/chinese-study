import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { COLOR_THEMES, getThemeFromSettings } from '../../lib/theme';
import type { ThemeSettings } from '../../types';

export default function ThemePicker() {
  const { user, updateSettings } = useAuth();
  const savedTheme = useMemo(() => getThemeFromSettings(user?.settings), [user?.settings]);
  const [open, setOpen] = useState(false);
  const [draftTheme, setDraftTheme] = useState<ThemeSettings>(savedTheme);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraftTheme(savedTheme);
  }, [savedTheme]);

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
    draftTheme.presetId !== savedTheme.presetId;

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

  const saveTheme = async () => {
    setSaving(true);
    setError('');
    setSavedMessage('');

    try {
      await updateSettings({
        theme: {
          ...draftTheme,
          presetId: selectedPreset?.presetId ?? draftTheme.presetId,
        },
      });
      setSavedMessage('Saved');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save theme');
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
        Theme
      </button>

      {open && (
        <div
          className="absolute right-0 mt-4 w-[min(22rem,calc(100vw-2rem))] bg-paper border-2 border-ink shadow-document-hover p-5 z-50"
          role="dialog"
          aria-label="Theme settings"
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

          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              onClick={saveTheme}
              disabled={saving || !hasChanges}
              className="vintage-btn vintage-btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Theme'}
            </button>
            <button
              type="button"
              onClick={() => selectTheme(savedTheme)}
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
