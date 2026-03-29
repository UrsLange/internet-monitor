import { useState, useRef, useEffect } from 'react';
import type { TimeRange, PresetRange } from '../types';
import { isCustomRange } from '../types';

const presets: { value: PresetRange; label: string }[] = [
  { value: '1h', label: '1H' },
  { value: '6h', label: '6H' },
  { value: '24h', label: '24H' },
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: 'all', label: 'All' },
];

interface Props {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
}

function toLocalDatetime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function TimeRangeSelector({ value, onChange }: Props) {
  const [showPanel, setShowPanel] = useState(false);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  const isCustom = isCustomRange(value);
  const isValid = customStart !== '' && customEnd !== '' && customStart < customEnd;

  // Pre-fill from current custom range
  useEffect(() => {
    if (isCustomRange(value)) {
      setCustomStart(toLocalDatetime(value.start));
      setCustomEnd(toLocalDatetime(value.end));
    }
  }, [value]);

  // Close panel on click outside
  useEffect(() => {
    if (!showPanel) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowPanel(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPanel]);

  const handlePresetClick = (preset: PresetRange) => {
    setShowPanel(false);
    onChange(preset);
  };

  const handleApply = () => {
    if (!isValid) return;
    const start = new Date(customStart).toISOString();
    const end = new Date(customEnd).toISOString();
    onChange({ start, end });
    setShowPanel(false);
  };

  const btnBase = 'rounded-md px-3 py-1.5 text-xs font-medium transition-colors';
  const btnActive = 'bg-[var(--color-accent)] text-white';
  const btnInactive = 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]';

  return (
    <div className="relative" ref={panelRef}>
      <div className="flex gap-1 rounded-lg bg-[var(--color-bg-tertiary)] p-1">
        {presets.map((r) => (
          <button
            key={r.value}
            onClick={() => handlePresetClick(r.value)}
            className={`${btnBase} ${!isCustom && value === r.value ? btnActive : btnInactive}`}
          >
            {r.label}
          </button>
        ))}
        <button
          onClick={() => setShowPanel(!showPanel)}
          className={`${btnBase} ${isCustom || showPanel ? btnActive : btnInactive}`}
        >
          Custom
        </button>
      </div>

      {showPanel && (
        <div className="absolute right-0 z-50 mt-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 shadow-lg"
          style={{ colorScheme: 'dark' }}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-medium text-[var(--color-text-secondary)]">From</span>
              <input
                type="datetime-local"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2.5 py-1.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-medium text-[var(--color-text-secondary)]">To</span>
              <input
                type="datetime-local"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2.5 py-1.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]"
              />
            </label>
            <button
              onClick={handleApply}
              disabled={!isValid}
              className="rounded-md bg-[var(--color-accent)] px-4 py-1.5 text-xs font-medium text-white transition-colors hover:opacity-90 disabled:opacity-40"
            >
              Apply
            </button>
          </div>
          {customStart && customEnd && customStart >= customEnd && (
            <p className="mt-2 text-[10px] text-[var(--color-bad)]">
              Start must be before end
            </p>
          )}
        </div>
      )}
    </div>
  );
}
