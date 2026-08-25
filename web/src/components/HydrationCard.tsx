import React, { useEffect, useState } from 'react';
import { api } from '@api/client';

interface HydrationEntry {
  id: string;
  amount_ml: number;
  logged_at: string;
}

interface HydrationDay {
  total_ml: number;
  target_ml: number;
  remaining_ml: number;
  entries: HydrationEntry[];
}

const QUICK_ADDS = [
  { ml: 200, label: 'Glass', icon: '🥛' },
  { ml: 330, label: 'Can', icon: '🥤' },
  { ml: 500, label: 'Bottle', icon: '💧' },
  { ml: 1000, label: 'Litre', icon: '🍶' },
];

export function HydrationCard({ date, onChange }: { date: string; onChange?: () => void }) {
  const [data, setData] = useState<HydrationDay | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const res = await api.getHydration(date);
    if (res.success) setData(res.data as HydrationDay);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const add = async (ml: number) => {
    setBusy(true);
    const res = await api.addWater(ml, date);
    setBusy(false);
    if (!res.success) return;

    // A queued write carries no server data. Assigning it would blank the card
    // — taking the buttons with it — so the total is advanced locally instead.
    // It is guaranteed to be delivered, so this is a preview, not a guess.
    if (res.queued) {
      setData((prev) =>
        prev
          ? { ...prev, total_ml: prev.total_ml + ml, remaining_ml: Math.max(0, prev.remaining_ml - ml) }
          : prev
      );
    } else {
      setData(res.data as HydrationDay);
    }
    onChange?.();
  };

  const undo = async (id: string) => {
    setBusy(true);
    await api.removeWaterEntry(id);
    setBusy(false);
    await load();
    onChange?.();
  };

  const pct = data && data.target_ml > 0 ? Math.min(100, (data.total_ml / data.target_ml) * 100) : 0;
  const met = data ? data.total_ml >= data.target_ml : false;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Water</h2>
        {data && (
          <span className={`text-sm font-medium ${met ? 'text-success-600' : 'text-gray-500'}`}>
            {data.total_ml} / {data.target_ml} ml
          </span>
        )}
      </div>

      {!data && <p className="text-gray-500 text-sm">Loading…</p>}

      {data && (
        <>
          <div className="h-3 rounded-full bg-gray-100 overflow-hidden mb-2">
            <div
              className={`h-full rounded-full transition-smooth ${met ? 'bg-success-500' : 'bg-primary-600'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mb-4">
            {met ? "You've hit your target for today 🎉" : `${data.remaining_ml} ml to go`}
          </p>

          <div className="grid grid-cols-4 gap-2 mb-4">
            {QUICK_ADDS.map((q) => (
              <button
                key={q.ml}
                onClick={() => add(q.ml)}
                disabled={busy}
                className="btn-secondary flex-col py-2 h-auto disabled:opacity-50"
              >
                <span className="text-lg leading-none">{q.icon}</span>
                <span className="text-xs mt-1">{q.ml}ml</span>
              </button>
            ))}
          </div>

          {data.entries.length > 0 && (
            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Today</p>
              <ul className="flex flex-wrap gap-2">
                {data.entries.map((e) => (
                  <li key={e.id}>
                    <button
                      onClick={() => undo(e.id)}
                      disabled={busy}
                      title="Remove this entry"
                      className="text-xs bg-gray-50 hover:bg-danger-50 hover:text-danger-600 text-gray-600 rounded-full px-2.5 py-1 transition-smooth"
                    >
                      {e.amount_ml}ml ✕
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
