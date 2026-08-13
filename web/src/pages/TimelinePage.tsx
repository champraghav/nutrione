import React, { useEffect, useState } from 'react';
import { api } from '@api/client';
import { formatDate, timeAgo } from '@utils/formatters';

interface TimelineEvent {
  id: string;
  event_type: string;
  title: string;
  occurred_at: string;
}

const ICONS: Record<string, string> = {
  meal_logged: '🍽️',
  workout_completed: '💪',
  sleep_logged: '🌙',
  score_calculated: '📊',
};

function groupByDay(events: TimelineEvent[]): Array<[string, TimelineEvent[]]> {
  const groups = new Map<string, TimelineEvent[]>();
  for (const event of events) {
    const day = event.occurred_at.slice(0, 10);
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day)!.push(event);
  }
  return Array.from(groups.entries());
}

export function TimelinePage() {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getHealthTimeline(100).then((res) => {
      if (res.success) setEvents(res.data as TimelineEvent[]);
      setLoading(false);
    });
  }, []);

  const groups = groupByDay(events);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Timeline</h1>
        <p className="text-gray-500 text-sm">Everything you've logged, in order.</p>
      </div>

      <div className="card">
        {loading && <p className="text-gray-500 text-sm">Loading…</p>}
        {!loading && events.length === 0 && <p className="text-gray-500 text-sm">Nothing logged yet.</p>}

        <div className="space-y-6">
          {groups.map(([day, dayEvents]) => (
            <div key={day}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{formatDate(day)}</p>
              <ul className="space-y-2">
                {dayEvents.map((event) => (
                  <li key={event.id} className="flex items-center gap-3">
                    <span className="text-lg">{ICONS[event.event_type] ?? '•'}</span>
                    <div className="flex-1">
                      <p className="text-sm text-gray-800">{event.title}</p>
                    </div>
                    <span className="text-xs text-gray-400">{timeAgo(event.occurred_at)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
