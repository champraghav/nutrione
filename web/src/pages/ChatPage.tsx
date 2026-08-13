import React, { useState } from 'react';
import { api } from '@api/client';
import { Button } from '@components/Button';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [brief, setBrief] = useState<string | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const message = input.trim();
    if (!message) return;
    setMessages((prev) => [...prev, { role: 'user', content: message }]);
    setInput('');
    setSending(true);

    const res = await api.chatWithAI(message, conversationId);
    setSending(false);

    if (res.success) {
      const data = res.data as { conversationId: string; response: string };
      setConversationId(data.conversationId);
      setMessages((prev) => [...prev, { role: 'assistant', content: data.response }]);
    } else {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Sorry, something went wrong: ${res.error?.message}` },
      ]);
    }
  };

  const loadBrief = async () => {
    setBriefLoading(true);
    const res = await api.getDailyBrief();
    setBriefLoading(false);
    if (res.success) setBrief((res.data as { brief: string }).brief);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI Coach</h1>
        <p className="text-gray-500 text-sm">Ask about your nutrition, fitness, or sleep. Not a substitute for medical advice.</p>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">Daily brief</h2>
          <Button variant="secondary" onClick={loadBrief} loading={briefLoading}>
            Generate
          </Button>
        </div>
        {brief && <p className="text-sm text-gray-700 whitespace-pre-line">{brief}</p>}
        {!brief && <p className="text-sm text-gray-400">Generate a short summary of how today is going.</p>}
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Chat</h2>
        <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
          {messages.length === 0 && <p className="text-sm text-gray-400">Ask me anything about your health data.</p>}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-line ${
                  m.role === 'user' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-800'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {sending && <p className="text-sm text-gray-400">Thinking…</p>}
        </div>
        <form onSubmit={send} className="flex gap-2">
          <input
            className="input"
            placeholder="Ask your coach…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <Button type="submit" loading={sending}>
            Send
          </Button>
        </form>
      </div>
    </div>
  );
}
