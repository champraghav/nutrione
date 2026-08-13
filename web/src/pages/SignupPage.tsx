import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '@store/app.store';
import { Button } from '@components/Button';
import { Input } from '@components/Input';

export function SignupPage() {
  const signup = useAppStore((state) => state.signup);
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const ok = await signup(email, password, firstName, lastName);
    setSubmitting(false);
    if (ok) navigate('/');
    else setError('Could not create account. That email may already be in use.');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <form onSubmit={onSubmit} className="card w-full max-w-sm space-y-4">
        <div>
          <h1 className="text-xl font-bold">Create your account</h1>
          <p className="text-sm text-gray-500">Start tracking your health today.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          <Input label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input
          label="Password"
          type="password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="text-danger-600 text-sm">{error}</p>}
        <Button type="submit" loading={submitting} className="w-full">
          Create account
        </Button>
        <p className="text-sm text-gray-500 text-center">
          Already have an account?{' '}
          <Link to="/login" className="text-primary-600 font-medium">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
