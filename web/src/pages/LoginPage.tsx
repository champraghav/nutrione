import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '@store/app.store';
import { Button } from '@components/Button';
import { Input } from '@components/Input';

export function LoginPage() {
  const signin = useAppStore((state) => state.signin);
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const ok = await signin(email, password);
    setSubmitting(false);
    if (ok) navigate('/');
    else setError('Invalid email or password');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <form onSubmit={onSubmit} className="card w-full max-w-sm space-y-4">
        <div>
          <h1 className="text-xl font-bold">Sign in to Health OS</h1>
          <p className="text-sm text-gray-500">Track nutrition, fitness, sleep, and get AI coaching.</p>
        </div>
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="text-danger-600 text-sm">{error}</p>}
        <Button type="submit" loading={submitting} className="w-full">
          Sign in
        </Button>
        <p className="text-sm text-gray-500 text-center">
          No account?{' '}
          <Link to="/signup" className="text-primary-600 font-medium">
            Sign up
          </Link>
        </p>
      </form>
    </div>
  );
}
