import React, { useEffect, useRef, useState } from 'react';
import { api } from '@api/client';
import { Button } from '@components/Button';

interface Message {
  id: string;
  body: string;
  created_at: string;
  sender_name: string | null;
  mine: boolean;
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/**
 * The conversation between a coach and one client. Used unchanged from both
 * sides — the API resolves who you are from the coaching link, so neither
 * side needs its own component or its own idea of who "me" is.
 */
export function MessageThread({ coachClientId, title }: { coachClientId: string; title: string }) {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const res = await api.getMessages(coachClientId);
    if (res.success) setMessages(res.data as Message[]);
    else setMessages([]);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coachClientId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages]);

  const send = async () => {
    const text = draft.trim();
    if (!text) return;
    setSending(true);
    setError('');
    const res = await api.sendMessage(coachClientId, text);
    setSending(false);
    if (res.success) {
      setMessages(res.data as Message[]);
      setDraft('');
    } else {
      setError(res.error?.message ?? 'Could not send that message.');
    }
  };

  return (
    <div className="card space-y-3">
      <h2 className="font-semibold text-gray-900">{title}</h2>

      <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
        {messages === null && <p className="text-sm text-gray-500">Loading…</p>}
        {messages?.length === 0 && (
          <p className="text-sm text-gray-500">No messages yet. Say hello.</p>
        )}
        {messages?.map((m) => (
          <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                m.mine ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-800'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
              <p className={`text-[11px] mt-0.5 ${m.mine ? 'text-primary-100' : 'text-gray-400'}`}>
                {m.mine ? 'You' : m.sender_name || 'Them'} · {timeLabel(m.created_at)}
              </p>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="flex items-end gap-2">
        <textarea
          className="input min-h-[2.75rem] max-h-32 flex-1"
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends; Shift+Enter makes a new line, as in every chat app.
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Write a message…"
          aria-label="Message"
        />
        <Button onClick={send} disabled={sending || !draft.trim()}>
          Send
        </Button>
      </div>

      {error && <p className="text-sm text-danger-600">{error}</p>}
    </div>
  );
}
