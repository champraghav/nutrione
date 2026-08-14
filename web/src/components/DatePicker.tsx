import React from 'react';
import { friendlyDateLabel, isFuture, shiftDate, todayLocal } from '@utils/dates';

/**
 * Day navigator for the logging pages. Real daily use means sometimes
 * remembering last night's dinner the next morning, so every logging screen
 * needs to be able to step back a day.
 */
export function DatePicker({ date, onChange }: { date: string; onChange: (d: string) => void }) {
  const atToday = date === todayLocal();
  const nextDisabled = isFuture(shiftDate(date, 1));

  return (
    <div className="flex items-center gap-2">
      <button
        className="btn-secondary px-2 py-1 text-sm"
        onClick={() => onChange(shiftDate(date, -1))}
        aria-label="Previous day"
      >
        ‹
      </button>

      <div className="text-center min-w-[8rem]">
        <p className="text-sm font-medium text-gray-800">{friendlyDateLabel(date)}</p>
        <p className="text-xs text-gray-400">{date}</p>
      </div>

      <button
        className="btn-secondary px-2 py-1 text-sm disabled:opacity-40 disabled:pointer-events-none"
        onClick={() => onChange(shiftDate(date, 1))}
        disabled={nextDisabled}
        aria-label="Next day"
      >
        ›
      </button>

      {!atToday && (
        <button className="text-xs text-primary-600 hover:underline ml-1" onClick={() => onChange(todayLocal())}>
          Today
        </button>
      )}
    </div>
  );
}
