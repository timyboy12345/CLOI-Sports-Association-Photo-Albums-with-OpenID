import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import api from '../api';
import { Lock, Loader2 } from 'lucide-react';
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
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-red-600" size={32} />
      </div>
    );
  }

  if (!requiresPassword) {
    return <>{children}</>;
  }

  return (
    <main className="p-4 md:p-8">
      <div className="max-w-md mx-auto bg-white rounded-2xl border border-gray-200 p-8 space-y-6">
        <div className="text-center space-y-2">
          <Lock size={32} className="mx-auto text-red-900" />
          <h1 className="text-xl font-bold text-gray-900">Website beveiligd</h1>
          <p className="text-sm text-gray-500">
            Je moet een geldig ledenwachtwoord opgeven om deze site te bekijken.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-900 focus:border-transparent transition-all"
            placeholder="Ledenwachtwoord"
            required
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            className="w-full bg-red-600 hover:bg-red-700 cursor-pointer text-white font-semibold py-3 px-6 rounded-xl transition-colors"
          >
            Verder
          </button>
        </form>
      </div>
    </main>
  );
};

export default PublicAccessGate;
