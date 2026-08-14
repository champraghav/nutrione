import React, { useRef, useState } from 'react';
import { api } from '@api/client';
import { Button } from '@components/Button';
import { Badge } from '@components/Badge';
import { chunkCsv } from '@utils/csvChunk';

interface Preview {
  kind: 'nutrition' | 'weight' | 'exercise';
  detectedFrom: string;
  totalRows: number;
  validRows: number;
  skipped: Array<{ line: number; reason: string }>;
  dateRange: { from: string; to: string } | null;
  sample: Array<Record<string, string | number>>;
  partial?: boolean;
  chunkCount?: number;
}

interface Result {
  imported: number;
  duplicatesSkipped: number;
  kind: string;
  datesTouched: string[];
}

const KIND_LABEL: Record<string, string> = {
  nutrition: 'Food diary',
  weight: 'Weight history',
  exercise: 'Exercise diary',
};

export function ImportPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [dayFirst, setDayFirst] = useState(true);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const analyse = async (text: string, useDayFirst: boolean) => {
    setBusy(true);
    setError(null);
    setResult(null);

    // Preview only the first chunk — enough to detect the format and show a
    // sample — so a huge export doesn't have to be uploaded just to look at it.
    const { chunks, totalDataRows } = chunkCsv(text);
    if (chunks.length === 0) {
      setBusy(false);
      setPreview(null);
      setError('That file appears to be empty.');
      return;
    }

    const res = await api.previewImport(chunks[0], useDayFirst);
    setBusy(false);
    if (res.success) {
      const p = res.data as Preview;
      const sampled = p.totalRows;
      setPreview({
        ...p,
        totalRows: totalDataRows,
        // Scale the estimate when we only inspected part of the file.
        validRows: chunks.length > 1 ? Math.round((p.validRows / Math.max(1, sampled)) * totalDataRows) : p.validRows,
        partial: chunks.length > 1,
        chunkCount: chunks.length,
      });
    } else {
      setPreview(null);
      setError(res.error?.message ?? 'Could not read that file.');
    }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsv(text);
    setFileName(file.name);
    analyse(text, dayFirst);
  };

  const onDayFirstChange = (v: boolean) => {
    setDayFirst(v);
    if (csv) analyse(csv, v);
  };

  const onCommit = async () => {
    if (!csv) return;
    setBusy(true);
    setError(null);

    const { chunks } = chunkCsv(csv);
    setProgress({ done: 0, total: chunks.length });

    let imported = 0;
    let duplicatesSkipped = 0;
    const dates = new Set<string>();
    let kind = '';

    for (let i = 0; i < chunks.length; i += 1) {
      const res = await api.commitImport(chunks[i], dayFirst);
      if (!res.success) {
        setBusy(false);
        setProgress(null);
        setError(
          `${res.error?.message ?? 'Import failed.'} ` +
            (imported > 0 ? `${imported} entries were imported before this point and have been kept.` : '')
        );
        return;
      }
      const d = res.data as Result;
      imported += d.imported;
      duplicatesSkipped += d.duplicatesSkipped;
      d.datesTouched?.forEach((x) => dates.add(x));
      kind = d.kind;
      setProgress({ done: i + 1, total: chunks.length });
    }

    setBusy(false);
    setProgress(null);
    setResult({ imported, duplicatesSkipped, kind, datesTouched: Array.from(dates) });
    setPreview(null);
    setCsv(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Import your data</h1>
        <p className="text-gray-500 text-sm">
          Bring your history over from MyFitnessPal, HealthifyMe, GoQii or any app that exports CSV.
        </p>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-3">How to get your file</h2>
        <ul className="text-sm text-gray-600 space-y-2 list-disc pl-5">
          <li>
            <span className="font-medium">MyFitnessPal</span> — on the website, Settings → Export Data (they email
            you CSV files for your food diary, exercise and measurements).
          </li>
          <li>
            <span className="font-medium">HealthifyMe / GoQii</span> — request a data export from the app's account
            or privacy settings, or from their support. Any CSV with a date column works.
          </li>
        </ul>
        <p className="text-xs text-gray-400 mt-3">
          None of these apps offer a public API to connect to directly, so a file export is the only reliable way to
          move your own data across.
        </p>
      </div>

      <div className="card space-y-4">
        <h2 className="text-lg font-semibold">Upload a CSV</h2>
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
        <div className="flex items-center gap-3 flex-wrap">
          <Button onClick={() => fileRef.current?.click()} disabled={busy}>
            {busy ? 'Reading…' : 'Choose CSV file'}
          </Button>
          {fileName && <span className="text-sm text-gray-500">{fileName}</span>}
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={dayFirst} onChange={(e) => onDayFirstChange(e.target.checked)} />
          Dates are day-first (14/08/2026). Untick for US-style month-first.
        </label>

        {error && <p className="text-sm text-danger-600 bg-danger-50 rounded-lg p-3">{error}</p>}
      </div>

      {preview && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-lg font-semibold">Preview</h2>
            <Badge variant="primary">{KIND_LABEL[preview.kind] ?? preview.kind}</Badge>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-500">Rows in file</p>
              <p className="text-xl font-semibold">{preview.totalRows}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Will import{preview.partial ? ' (est.)' : ''}</p>
              <p className="text-xl font-semibold text-success-600">{preview.validRows}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Skipped</p>
              <p className="text-xl font-semibold text-warning-600">{preview.skipped.length}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Dates</p>
              <p className="text-sm font-medium">
                {preview.dateRange ? `${preview.dateRange.from} → ${preview.dateRange.to}` : '—'}
              </p>
            </div>
          </div>

          {preview.sample.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-400">
                    {Object.keys(preview.sample[0]).map((k) => (
                      <th key={k} className="py-1 pr-3 font-medium whitespace-nowrap">
                        {k}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.sample.map((row, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      {Object.values(row).map((v, j) => (
                        <td key={j} className="py-1 pr-3 whitespace-nowrap text-gray-700">
                          {String(v)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {preview.skipped.length > 0 && (
            <details className="text-xs text-gray-500">
              <summary className="cursor-pointer">Why {preview.skipped.length} rows were skipped</summary>
              <ul className="mt-2 space-y-1">
                {preview.skipped.map((s, i) => (
                  <li key={i}>
                    Line {s.line}: {s.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {preview.partial && (
            <p className="text-xs text-gray-500">
              Large file — it'll be uploaded in {preview.chunkCount} batches. The preview above samples the first
              batch; every row still gets imported.
            </p>
          )}

          {progress && (
            <div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden mb-1">
                <div
                  className="h-full rounded-full bg-primary-600 transition-smooth"
                  style={{ width: `${(progress.done / progress.total) * 100}%` }}
                />
              </div>
              <p className="text-xs text-gray-500">
                Importing batch {progress.done} of {progress.total}…
              </p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button onClick={onCommit} loading={busy} disabled={preview.validRows === 0}>
              Import {preview.validRows} entries
            </Button>
            <Button variant="secondary" onClick={() => { setPreview(null); setCsv(null); setFileName(''); }}>
              Cancel
            </Button>
          </div>
          <p className="text-xs text-gray-400">
            Safe to re-run: entries that already exist for the same date are skipped rather than duplicated.
          </p>
        </div>
      )}

      {result && (
        <div className="card">
          <h2 className="text-lg font-semibold text-success-600 mb-2">Import complete</h2>
          <p className="text-sm text-gray-700">
            Imported <span className="font-semibold">{result.imported}</span> entries
            {result.duplicatesSkipped > 0 && ` · skipped ${result.duplicatesSkipped} already present`}
            {result.datesTouched.length > 0 && ` · covering ${result.datesTouched.length} days`}.
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Your history and health score now include this data. Use the day arrows on the Nutrition page to look back.
          </p>
        </div>
      )}
    </div>
  );
}
