import { useCallback, useState, type DragEvent } from 'react';
import { Upload } from 'lucide-react';

interface Props {
  onFileLoaded: (text: string) => void;
}

export default function FileDropZone({ onFileLoaded }: Props) {
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = () => onFileLoaded(reader.result as string);
        reader.readAsText(file);
      }
    },
    [onFileLoaded],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = () => onFileLoaded(reader.result as string);
        reader.readAsText(file);
      }
    },
    [onFileLoaded],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
        dragging
          ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
          : 'border-[var(--color-border)] hover:border-[var(--color-text-secondary)]'
      }`}
    >
      <Upload size={20} className="text-[var(--color-text-secondary)]" />
      <p className="text-sm text-[var(--color-text-secondary)]">
        Drop a <code className="rounded bg-[var(--color-bg-tertiary)] px-1 text-xs">connection-log.jsonl</code> file here, or{' '}
        <label className="cursor-pointer text-[var(--color-accent)] underline">
          browse
          <input type="file" accept=".jsonl,.json" onChange={handleFileInput} className="hidden" />
        </label>
      </p>
    </div>
  );
}
