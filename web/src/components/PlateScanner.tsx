import React, { useRef, useState } from 'react';
import { api } from '@api/client';
import { Button } from '@components/Button';
import { Badge } from '@components/Badge';

interface Nutrients {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  saturated_fat_g: number;
}

interface DetectedItem {
  detectedName: string;
  quantity: number;
  unit: string;
  confidence: number;
  match: { id: string; name: string; serving_unit: string } | null;
  nutrients: Nutrients | null;
}

interface Analysis {
  items: DetectedItem[];
  totals: Nutrients;
  unmatched: string[];
}

interface PlateScannerProps {
  date: string;
  mealType: string;
  onLogged: () => void;
  onClose: () => void;
}

function confidenceVariant(c: number): 'success' | 'warning' | 'gray' {
  if (c >= 0.8) return 'success';
  if (c >= 0.5) return 'warning';
  return 'gray';
}

export function PlateScanner({ date, mealType, onLogged, onClose }: PlateScannerProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [logging, setLogging] = useState(false);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setAnalysis(null);

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Could not read that file'));
      reader.readAsDataURL(file);
    });

    setPreview(dataUrl);
    setAnalyzing(true);
    const res = await api.analyzePhoto(dataUrl, file.type);
    setAnalyzing(false);

    if (res.success) {
      const data = res.data as Analysis;
      setAnalysis(data);
      const initial: Record<number, string> = {};
      data.items.forEach((item, i) => {
        initial[i] = String(item.quantity);
      });
      setQuantities(initial);
    } else {
      setError(res.error?.message ?? 'Could not analyse that photo.');
    }
  };

  const onLogAll = async () => {
    if (!analysis) return;
    const items = analysis.items
      .map((item, i) => ({ item, qty: Number(quantities[i]) }))
      .filter(({ item, qty }) => item.match && qty > 0)
      .map(({ item, qty }) => ({ foodId: item.match!.id, quantity: qty, unit: item.unit }));

    if (items.length === 0) return;

    setLogging(true);
    const res = await api.bulkLogMeals(date, items, mealType);
    setLogging(false);

    if (res.success) {
      onLogged();
      onClose();
    } else {
      setError(res.error?.message ?? 'Could not log those items.');
    }
  };

  const matchedCount = analysis?.items.filter((i) => i.match).length ?? 0;

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Scan your plate</h3>
        <button className="text-gray-400 hover:text-gray-600 text-sm" onClick={onClose}>
          Close
        </button>
      </div>

      {!analysis && (
        <>
          <p className="text-sm text-gray-500">
            Take a photo of your meal and it'll identify each item and work out the nutrition.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={onFile}
          />
          <Button onClick={() => fileRef.current?.click()} disabled={analyzing}>
            {analyzing ? 'Analysing…' : '📷 Take / choose photo'}
          </Button>
        </>
      )}

      {preview && (
        <img src={preview} alt="Meal preview" className="w-full max-h-64 object-cover rounded-lg" />
      )}

      {analyzing && <p className="text-sm text-gray-500">Identifying the food on your plate…</p>}

      {error && (
        <div className="text-sm text-danger-600 bg-danger-50 rounded-lg p-3">
          {error}
          <button
            className="block mt-2 text-primary-600 hover:underline"
            onClick={() => {
              setError(null);
              setPreview(null);
              fileRef.current?.click();
            }}
          >
            Try another photo
          </button>
        </div>
      )}

      {analysis && (
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Detected</p>
            {analysis.items.length === 0 && (
              <p className="text-sm text-gray-500">No food found in that photo. Try a clearer picture.</p>
            )}
            <ul className="divide-y divide-gray-100">
              {analysis.items.map((item, i) => (
                <li key={i} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{item.match?.name ?? item.detectedName}</p>
                        <Badge variant={confidenceVariant(item.confidence)}>
                          {Math.round(item.confidence * 100)}%
                        </Badge>
                      </div>
                      {item.nutrients ? (
                        <p className="text-xs text-gray-500 mt-1">
                          {item.nutrients.calories} kcal · {item.nutrients.protein_g}g protein ·{' '}
                          {item.nutrients.carbs_g}g carbs · {item.nutrients.fat_g}g fat ·{' '}
                          {item.nutrients.fiber_g}g fiber
                        </p>
                      ) : (
                        <p className="text-xs text-warning-600 mt-1">
                          Not in the food database — search for it by name instead.
                        </p>
                      )}
                    </div>
                    {item.match && (
                      <div className="flex items-center gap-1 shrink-0">
                        <input
                          type="number"
                          min="0"
                          className="input w-20 py-1 text-sm"
                          value={quantities[i] ?? ''}
                          onChange={(e) => setQuantities((q) => ({ ...q, [i]: e.target.value }))}
                          aria-label={`Quantity for ${item.match.name}`}
                        />
                        <span className="text-xs text-gray-400">{item.unit}</span>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {matchedCount > 0 && (
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Plate total</p>
              <p className="text-sm text-gray-700">
                <span className="font-semibold">{analysis.totals.calories} kcal</span> ·{' '}
                {analysis.totals.protein_g}g protein · {analysis.totals.carbs_g}g carbs · {analysis.totals.fat_g}g fat
                · {analysis.totals.fiber_g}g fiber · {analysis.totals.sodium_mg}mg sodium
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Portions are estimates from the photo — adjust the numbers above before logging.
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={onLogAll} loading={logging} disabled={matchedCount === 0}>
              Log {matchedCount} item{matchedCount === 1 ? '' : 's'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setAnalysis(null);
                setPreview(null);
                setError(null);
              }}
            >
              Retake
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
