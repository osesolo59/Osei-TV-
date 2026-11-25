import React, { useState, useEffect } from 'react';
import { X, UserPlus, LogIn } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const body = isLogin ? { email, password } : { email, password, username };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'OseiTV',
        },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Authentication failed');

      login(data.token, data.user);
      setEmail('');
      setPassword('');
      setUsername('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Could not complete request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/65 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200 flex flex-col">
        <div className="flex justify-between items-center px-5 py-3.5 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">
            {isLogin ? 'Sign in to Osei TV' : 'Create your Osei TV account'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sign in dialog"
            className="w-9 h-9 hover:bg-slate-100 rounded-full flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                {error}
              </div>
            )}

            {!isLogin && (
              <div>
                <label className="block text-xs font-semibold mb-1.5 text-slate-700">
                  Channel / Username
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={40}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. KofiCreates"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-slate-900"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold mb-1.5 text-slate-700">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5 text-slate-700">Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-slate-900"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 mt-1 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLogin ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              {submitting ? 'Please wait...' : isLogin ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <div className="mt-5 text-center text-sm text-slate-600">
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
              className="text-red-600 font-semibold hover:underline"
            >
              {isLogin ? 'Create account' : 'Sign in'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
