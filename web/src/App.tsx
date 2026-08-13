import React, { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useAppStore } from '@store/app.store';
import { Button } from '@components/Button';
import { getHealthScoreStatus } from '@utils/formatters';

function DashboardPage() {
  const { healthScore, healthScoreLoading, fetchHealthScore, user, logout } = useAppStore();

  useEffect(() => {
    fetchHealthScore();
  }, [fetchHealthScore]);

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Health OS</h1>
          {user && <Button variant="secondary" onClick={logout}>Log out</Button>}
        </header>

        <div className="card">
          <h2 className="text-lg font-semibold mb-2">Today's Health Score</h2>
          {healthScoreLoading && <p className="text-gray-500">Loading…</p>}
          {!healthScoreLoading && healthScore && (
            <div>
              <p className="text-4xl font-bold text-primary-600">{healthScore.overall_score}</p>
              <p className="text-sm text-gray-500 capitalize">
                {getHealthScoreStatus(healthScore.overall_score)} · trend {healthScore.trend}
              </p>
            </div>
          )}
          {!healthScoreLoading && !healthScore && (
            <p className="text-gray-500">No score yet. Log some data to see your score.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function AuthPage() {
  const { signin } = useAppStore();
  const navigate = useNavigate();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const ok = await signin(email, password);
    if (ok) navigate('/');
    else setError('Invalid email or password');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <form onSubmit={onSubmit} className="card w-full max-w-sm space-y-4">
        <h1 className="text-xl font-bold">Sign in to Health OS</h1>
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="label">Password</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p className="text-danger-600 text-sm">{error}</p>}
        <Button type="submit" className="w-full">
          Sign in
        </Button>
      </form>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactElement }) {
  const user = useAppStore((state) => state.user);
  const authLoading = useAppStore((state) => state.authLoading);
  if (authLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const fetchUser = useAppStore((state) => state.fetchUser);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
