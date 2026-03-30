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

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

interface Props {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function fromISO(iso: string): { date: string; hour: number; minute: number } {
  const d = new Date(iso);
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    hour: d.getHours(),
    minute: d.getMinutes(),
  };
}

function toISO(date: string, hour: number, minute: number): string {
  return new Date(`${date}T${pad(hour)}:${pad(minute)}:00`).toISOString();
}

function toComparable(date: string, hour: number, minute: number): number {
  return new Date(`${date}T${pad(hour)}:${pad(minute)}:00`).getTime();
}

const inputClass =
  'rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]';

const selectClass =
  'appearance-none rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] cursor-pointer';

export default function TimeRangeSelector({ value, onChange }: Props) {
  const [showPanel, setShowPanel] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [startHour, setStartHour] = useState(0);
  const [startMinute, setStartMinute] = useState(0);
  const [endDate, setEndDate] = useState('');
  const [endHour, setEndHour] = useState(23);
  const [endMinute, setEndMinute] = useState(55);
  const panelRef = useRef<HTMLDivElement>(null);

  const isCustom = isCustomRange(value);
  const hasStart = startDate !== '';
  const hasEnd = endDate !== '';
  const isValid =
    hasStart &&
    hasEnd &&
    toComparable(startDate, startHour, startMinute) <
      toComparable(endDate, endHour, endMinute);

  // Pre-fill from current custom range
  useEffect(() => {
    if (isCustomRange(value)) {
      const s = fromISO(value.start);
      const e = fromISO(value.end);
      setStartDate(s.date);
      setStartHour(s.hour);
      setStartMinute(s.minute);
      setEndDate(e.date);
      setEndHour(e.hour);
      setEndMinute(e.minute);
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
    onChange({
      start: toISO(startDate, startHour, startMinute),
      end: toISO(endDate, endHour, endMinute),
    });
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
        <div
          className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 shadow-lg sm:w-auto"
          style={{ colorScheme: 'dark' }}
        >
          <div className="flex flex-col gap-4">
            {/* From row */}
            <div>
              <div className="mb-1.5 text-[10px] font-medium text-[var(--color-text-secondary)]">From</div>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={inputClass}
                />
                <select
                  value={startHour}
                  onChange={(e) => setStartHour(Number(e.target.value))}
                  className={selectClass}
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h}>{pad(h)}</option>
                  ))}
                </select>
                <span className="text-xs text-[var(--color-text-secondary)]">:</span>
                <select
                  value={startMinute}
                  onChange={(e) => setStartMinute(Number(e.target.value))}
                  className={selectClass}
                >
                  {MINUTES.map((m) => (
                    <option key={m} value={m}>{pad(m)}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* To row */}
            <div>
              <div className="mb-1.5 text-[10px] font-medium text-[var(--color-text-secondary)]">To</div>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={inputClass}
                />
                <select
                  value={endHour}
                  onChange={(e) => setEndHour(Number(e.target.value))}
                  className={selectClass}
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h}>{pad(h)}</option>
                  ))}
                </select>
                <span className="text-xs text-[var(--color-text-secondary)]">:</span>
                <select
                  value={endMinute}
                  onChange={(e) => setEndMinute(Number(e.target.value))}
                  className={selectClass}
                >
                  {MINUTES.map((m) => (
                    <option key={m} value={m}>{pad(m)}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between">
              {hasStart && hasEnd && !isValid ? (
                <p className="text-[10px] text-[var(--color-bad)]">Start must be before end</p>
              ) : (
                <span />
              )}
              <button
                onClick={handleApply}
                disabled={!isValid}
                className="rounded-md bg-[var(--color-accent)] px-4 py-1.5 text-xs font-medium text-white transition-colors hover:opacity-90 disabled:opacity-40"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
