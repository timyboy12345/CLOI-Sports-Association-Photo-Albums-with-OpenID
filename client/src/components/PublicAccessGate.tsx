import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import api from '../api';
import { Lock, Loader2, ShieldCheck } from 'lucide-react';
import { isAxiosError } from 'axios';

interface PublicAccessGateProps {
  children: ReactNode;
}

const PublicAccessGate = ({ children }: PublicAccessGateProps) => {
  const [loading, setLoading] = useState(true);
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const loadStatus = async () => {
      setLoading(true);
      try {
        const res = await api.get('/public-access/status');
        const { requiresMasterPassword, hasAccess } = res.data as { requiresMasterPassword: boolean; hasAccess: boolean };
        setRequiresPassword(Boolean(requiresMasterPassword) && !Boolean(hasAccess));
      } catch (err) {
        console.error('Failed to load public access status', err);
      } finally {
        setLoading(false);
      }
    };

    loadStatus();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await api.post('/public-access/verify', { password: password.trim() });
      setRequiresPassword(false);
      setPassword('');
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 403) {
        setError('Onjuist wachtwoord.');
      } else {
        setError('Kon wachtwoord niet controleren.');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-red-600" size={32} />
      </div>
    );
  }

  if (!requiresPassword) {
    return <>{children}</>;
  }

  return (
    <main className="min-h-screen w-full px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-3xl items-center justify-center">
        <div className="w-full rounded-3xl border border-gray-200 bg-white p-8 md:p-12">
          <div className="mb-8 text-center space-y-3">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-900">
              <ShieldCheck size={30} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">Voer je ledenwachtwoord in</h1>
            <p className="text-xs text-gray-500">
              Ledenwachtwoorden staan los van toegangscodes voor losse albums, weet je jouw ledenwachtwoord niet meer, of heb je er nog geen gekregen? Neem contact op met de beheerder.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="mx-auto max-w-md space-y-4">
            <label className="block text-sm font-medium text-gray-700">Ledenwachtwoord</label>
            <div className="relative">
              <Lock size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-gray-200 py-3 pl-11 pr-4 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-red-900 transition-all"
                placeholder="Voer hier je ledenwachtwoord in"
                required
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              className="w-full rounded-xl bg-red-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-red-700 cursor-pointer"
            >
              Inloggen
            </button>
          </form>
        </div>
      </div>
    </main>
  );
};

export default PublicAccessGate;
