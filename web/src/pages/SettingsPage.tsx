import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@api/client';
import { useAppStore } from '@store/app.store';
import { Button } from '@components/Button';
import { Input } from '@components/Input';

export function SettingsPage() {
  const user = useAppStore((state) => state.user);
  const logout = useAppStore((state) => state.logout);
  const navigate = useNavigate();

  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDeleteAccount = async () => {
    setError(null);
    setDeleting(true);
    const res = await api.deleteMe();
    setDeleting(false);
    if (res.success) {
      await logout();
      navigate('/login');
    } else {
      setError(res.error?.message ?? 'Could not delete account.');
    }
  };

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm">Manage your account.</p>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-2">Account</h2>
        <p className="text-sm text-gray-600">Signed in as {user?.email}</p>
        <Button variant="secondary" className="mt-4" onClick={logout}>
          Log out
        </Button>
      </div>

      <div className="card border-danger-100">
        <h2 className="text-lg font-semibold text-danger-600 mb-2">Danger zone</h2>
        <p className="text-sm text-gray-600 mb-4">
          Deleting your account deactivates it and removes your access. This cannot be undone from the app.
        </p>
        <Input
          label='Type "DELETE" to confirm'
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
        />
        {error && <p className="text-danger-600 text-sm mt-2">{error}</p>}
        <button
          className="btn bg-danger-600 text-white hover:bg-danger-700 mt-4 disabled:opacity-50 disabled:pointer-events-none"
          disabled={confirmText !== 'DELETE' || deleting}
          onClick={onDeleteAccount}
        >
          {deleting ? 'Deleting…' : 'Delete account'}
        </button>
      </div>
    </div>
  );
}
