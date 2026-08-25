import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@api/client';
import { Button } from '@components/Button';
import { Input } from '@components/Input';
import { Badge } from '@components/Badge';
import { todayLocal } from '@utils/dates';
import { ClientRow } from '../types/coaching';

export function ClientsPage() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  /** Invite code for a client just added, shown once so the coach can send it. */
  const [newCode, setNewCode] = useState<{ name: string; code: string } | null>(null);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const date = todayLocal();

  const load = async () => {
    const res = await api.getClients(date);
    if (res.success) setClients(res.data as ClientRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    api.getUnreadCounts().then((r) => r.success && setUnread(r.data as Record<string, number>));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const add = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError('');
    const res = await api.addClient({ name: name.trim(), email: email.trim() || null });
    setSaving(false);
    if (res.success) {
      const created = res.data as { client_name: string; invite_code: string };
      setNewCode({ name: created.client_name, code: created.invite_code });
      setName('');
      setEmail('');
      setAdding(false);
      load();
    } else {
      setError(res.error?.message ?? 'Could not add that client.');
    }
  };

  const active = clients.filter((c) => c.status === 'active');
  const pending = clients.filter((c) => c.status === 'pending');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-500 text-sm">
            {active.length} active{pending.length > 0 ? `, ${pending.length} waiting to accept` : ''}
          </p>
        </div>
        {!adding && <Button onClick={() => setAdding(true)}>+ Add client</Button>}
      </div>

      {newCode && (
        <div className="card bg-primary-50 border-primary-200">
          <p className="text-sm text-gray-700">
            Send this code to <span className="font-medium">{newCode.name}</span>. They enter it under
            {' '}<span className="font-medium">My Plan</span> in their own account.
          </p>
          <p className="text-2xl font-bold tracking-widest text-primary-700 my-2">{newCode.code}</p>
          <p className="text-xs text-gray-500">
            You will not see any of their data until they accept — that is their decision, not yours.
          </p>
          <button className="text-xs text-primary-700 hover:underline mt-2" onClick={() => setNewCode(null)}>
            Done
          </button>
        </div>
      )}

      {adding && (
        <div className="card space-y-3">
          <h2 className="font-semibold text-gray-900">New client</h2>
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Priya Sharma" />
          <Input
            label="Email (optional)"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="priya@example.com"
          />
          {error && <p className="text-sm text-danger-600">{error}</p>}
          <div className="flex gap-2">
            <Button onClick={add} disabled={saving || !name.trim()}>
              {saving ? 'Adding…' : 'Add client'}
            </Button>
            <Button variant="secondary" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : clients.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-4xl mb-2">👥</p>
          <p className="font-medium text-gray-800">No clients yet</p>
          <p className="text-sm text-gray-500">Add someone, then send them the invite code.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {clients.map((c) => {
            const stale = c.status === 'active' && c.last_logged_date !== null && c.last_logged_date < date;
            return (
              <div key={c.coach_client_id} className="card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {c.status === 'active' ? (
                        <Link
                          to={`/clients/${c.coach_client_id}`}
                          className="font-medium text-gray-900 hover:text-primary-700 truncate"
                        >
                          {c.client_name}
                        </Link>
                      ) : (
                        <span className="font-medium text-gray-500 truncate">{c.client_name}</span>
                      )}
                      {c.status === 'pending' && <Badge variant="warning">invite not accepted</Badge>}
                      {c.active_plans > 0 && <Badge variant="primary">{c.active_plans} plan</Badge>}
                      {unread[c.coach_client_id] > 0 && (
                        <Badge variant="danger">
                          {unread[c.coach_client_id]} new message{unread[c.coach_client_id] === 1 ? '' : 's'}
                        </Badge>
                      )}
                    </div>

                    {c.status === 'active' ? (
                      <p className="text-xs text-gray-500 mt-1">
                        {c.calories_today !== null
                          ? `${Math.round(Number(c.calories_today))} kcal today`
                          : 'Nothing logged today'}
                        {c.latest_weight_kg !== null && ` · ${Number(c.latest_weight_kg)} kg`}
                        {stale && ` · last logged ${c.last_logged_date}`}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400 mt-1">Waiting for them to enter the invite code</p>
                    )}
                  </div>

                  {c.status === 'active' && (
                    <Link to={`/clients/${c.coach_client_id}`} className="btn-secondary text-xs shrink-0">
                      Open
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
