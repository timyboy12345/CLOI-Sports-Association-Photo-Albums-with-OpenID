import { useState, useEffect } from 'react';
import {useNavigate} from 'react-router-dom';
import api from '../api';
import { LogIn, LogOut, Plus, FolderPlus, User as UserIcon, Loader2, Edit, Trash2, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';

interface User {
  id?: number;
  email?: string;
  name?: string;
  role?: string;
  last_login?: string;
}

interface MasterPassword {
  id: number;
  name: string;
  created_at: string;
}

const AdminDashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [albumName, setAlbumName] = useState('');
  const [albums, setAlbums] = useState<{ id: number; name: string; date: string; photo_count?: number }[]>([]);
  const [masterPasswords, setMasterPasswords] = useState<MasterPassword[]>([]);
  const [masterPasswordName, setMasterPasswordName] = useState('');
  const [newMasterPassword, setNewMasterPassword] = useState('');
  const [deletingAlbumId, setDeletingAlbumId] = useState<number | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null);
  const [deletingMasterPasswordId, setDeletingMasterPasswordId] = useState<number | null>(null);

  useEffect(() => {
    checkAuth();
    fetchAlbums();
    fetchUsers();
    fetchMasterPasswords();
  }, []);

  let navigate = useNavigate();

  const checkAuth = async () => {
    try {
      const res = await api.get('/auth/me');
      setUser(res.data);
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  document.title = 'Admin - Fotoalbum';

  const fetchAlbums = async () => {
    try {
      const res = await api.get('/albums');

      const sortedAlbums = res.data.sort((a: { date: string }, b: { date: string }) => {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
      setAlbums(sortedAlbums);
    } catch (err) {
      console.error('Failed to fetch albums', err);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data);
    } catch (err) {
      console.error('Failed to fetch users', err);
    }
  };

  const fetchMasterPasswords = async () => {
    try {
      const res = await api.get('/master-passwords');
      setMasterPasswords(res.data);
    } catch (err) {
      console.error('Failed to fetch master passwords', err);
    }
  };

  const handleLogin = () => {
    const API_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
    window.location.href = `${API_URL}/api/auth/login`;
  };

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout', {});
      window.location.reload();
    } catch (err) {
      console.error('Logout failed', err);
    }
  };

  const handleCreateAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/albums', {name: albumName});
      setAlbumName('');
      fetchAlbums();
      if (res.data?.id) {
        navigate(`/admin/edit/${res.data.id}`);
      }
    } catch (err) {
      alert('Failed to create album. Please ensure you are logged in.');
    }
  };

  const handleDeleteAlbum = async (albumId: number, photoCount = 0) => {
    if (photoCount > 0) {
      alert('Dit album kan niet verwijderd worden omdat het nog foto\'s bevat.');
      return;
    }

    if (!window.confirm('Weet je zeker dat je dit lege album wilt verwijderen?')) return;

    setDeletingAlbumId(albumId);
    try {
      await api.delete(`/albums/${albumId}`, { withCredentials: true });
      setAlbums((prev) => prev.filter((album) => album.id !== albumId));
    } catch (err: any) {
      const serverMessage = err?.response?.data?.error;
      alert(serverMessage || 'Failed to delete album.');
    } finally {
      setDeletingAlbumId(null);
    }
  };

  const handleUpdateRole = async (userId: number, newRole: string) => {
    setUpdatingUserId(userId);
    try {
      await api.patch(`/users/${userId}/role`, { role: newRole });
      await fetchUsers();
      // If updating self, we might want to refresh current user state, but since this is admin dashboard
      // and only admins can reach here, demoting self would kick you out on next reload/navigation
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update user role.');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleCreateMasterPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/master-passwords', { name: masterPasswordName, password: newMasterPassword });
      setMasterPasswordName('');
      setNewMasterPassword('');
      await fetchMasterPasswords();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to add master password.');
    }
  };

  const handleDeleteMasterPassword = async (id: number) => {
    if (!window.confirm('Weet je zeker dat je dit master wachtwoord wilt verwijderen?')) return;
    setDeletingMasterPasswordId(id);
    try {
      await api.delete(`/master-passwords/${id}`);
      setMasterPasswords((prev) => prev.filter((item) => item.id !== id));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete master password.');
    } finally {
      setDeletingMasterPasswordId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-red-600" size={32} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto mt-10">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 bg-red-50 text-red-900 rounded-full flex items-center justify-center mx-auto mb-6">
            <UserIcon size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Admin</h1>
          <p className="text-gray-500 mb-8">Log in om afbeeldingen te uploaden, albums aan te maken en meer.</p>
          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors cursor-pointer"
          >
            <LogIn size={20} />
            Login via Microsoft
          </button>
        </div>
      </div>
    );
  }

  if (user.role !== 'admin') {
    return (
      <div className="max-w-md mx-auto mt-10">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 bg-amber-50 text-amber-900 rounded-full flex items-center justify-center mx-auto mb-6">
            <UserIcon size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Toegang Geweigerd</h1>
          <p className="text-gray-500 mb-8">
            Je bent ingelogd als <strong>{user.email}</strong>, maar je hebt geen admin rechten.
            Vraag een bestaande admin om je account te activeren.
          </p>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-6 rounded-xl transition-colors cursor-pointer"
          >
            <LogOut size={20} />
            Uitloggen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center bg-white p-6 rounded-2xl border border-gray-200">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-red-50 text-red-900 rounded-full flex items-center justify-center font-bold text-xl">
            {(user.name || user.email || 'A')[0].toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Welkom, {user.name || user.email || 'Admin'}!</h1>
            <p className="text-sm text-gray-500">All In Fotobibliotheek</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="self-end md:self-auto flex items-center gap-2 cursor-pointer text-gray-500 hover:text-red-900 font-medium transition-colors"
        >
          <LogOut size={20} />
          Uitloggen
        </button>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {/* Create Album Section */}
        <section className="bg-white p-4 md:p-8 rounded-2xl border border-gray-200 space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-50 text-red-900 rounded-lg">
              <FolderPlus size={24} />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Nieuw Album Aanmaken</h2>
          </div>
          <form onSubmit={handleCreateAlbum} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Album naam</label>
              <input
                type="text"
                placeholder="Naam van album"
                value={albumName}
                onChange={(e) => setAlbumName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-900 focus:border-transparent transition-all"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 cursor-pointer bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
            >
              <Plus size={20} />
              Album aanmaken
            </button>
          </form>
        </section>
      </div>

      {/* Manage Albums Section */}
      <section className="bg-white p-4 md:p-8 rounded-2xl border border-gray-200 space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-50 text-red-900 rounded-lg">
            <Edit size={24} />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Beheer Albums</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {albums.map(a => (
            <div key={a.id} className="flex items-center gap-2 p-4 bg-gray-50 rounded-xl border border-gray-100">
              <Link to={`/admin/edit/${a.id}`} className="flex-1 min-w-0 hover:text-red-900 transition-colors group">
                <div className="truncate pr-4">
                  <p className="font-semibold truncate">{a.name}</p>
                  <p className="text-xs opacity-50">{new Date(a.date).toLocaleDateString()}</p>
                  <p className="text-xs opacity-50">{a.photo_count ?? 0} foto&apos;s</p>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => handleDeleteAlbum(a.id, a.photo_count ?? 0)}
                disabled={(a.photo_count ?? 0) > 0 || deletingAlbumId === a.id}
                className="p-2 rounded-lg cursor-pointer text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-gray-300"
                title={(a.photo_count ?? 0) > 0 ? 'Album bevat nog foto\'s' : 'Verwijder album'}
              >
                {deletingAlbumId === a.id ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
              </button>
            </div>
          ))}
          {albums.length === 0 && (
            <p className="col-span-full text-center py-6 text-gray-400 italic">No albums created yet.</p>
          )}
        </div>
      </section>

      {/* User Management Section */}
      <section className="bg-white p-4 md:p-8 rounded-2xl border border-gray-200 space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-50 text-red-900 rounded-lg">
            <UserIcon size={24} />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Beheer Gebruikers</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[600px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="pb-4 px-4 font-semibold text-gray-600 whitespace-nowrap">User</th>
                <th className="pb-4 px-4 font-semibold text-gray-600 whitespace-nowrap">Email</th>
                <th className="pb-4 px-4 font-semibold text-gray-600 whitespace-nowrap">Rol</th>
                <th className="pb-4 px-4 font-semibold text-gray-600 text-right whitespace-nowrap">Laatste login</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-4 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center font-medium text-xs">
                        {(u.name || u.email || 'U')[0].toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-900">{u.name}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-gray-500 whitespace-nowrap">{u.email}</td>
                  <td className="py-4 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                       <span className={`px-2 py-1 rounded-md text-xs font-bold uppercase ${u.role === 'admin' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600'}`}>
                         {u.role}
                       </span>
                       {u.id !== undefined && (
                         <button
                           onClick={() => handleUpdateRole(u.id!, u.role === 'admin' ? 'guest' : 'admin')}
                           disabled={updatingUserId === u.id}
                           className="text-xs text-red-600 hover:underline cursor-pointer disabled:opacity-50"
                         >
                           {updatingUserId === u.id ? 'Updating...' : u.role === 'admin' ? 'Maak guest' : 'Maak admin'}
                         </button>
                       )}
                    </div>
                  </td>
                  <td className="py-4 px-4 text-right text-gray-500 text-sm whitespace-nowrap">
                    {u.last_login ? new Date(u.last_login).toLocaleString() : 'Never'}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-10 text-center text-gray-400">
                    No users found in the system.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white p-4 md:p-8 rounded-2xl border border-gray-200 space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-50 text-red-900 rounded-lg">
            <Lock size={24} />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Master Wachtwoorden</h2>
        </div>

        <form onSubmit={handleCreateMasterPassword} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="text"
            value={masterPasswordName}
            onChange={(e) => setMasterPasswordName(e.target.value)}
            placeholder="Naam (bijv. Seizoen 2026)"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-900 focus:border-transparent transition-all"
            required
          />
          <input
            type="password"
            value={newMasterPassword}
            onChange={(e) => setNewMasterPassword(e.target.value)}
            placeholder="Nieuw master wachtwoord"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-900 focus:border-transparent transition-all"
            required
          />
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 cursor-pointer bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
          >
            <Plus size={20} />
            Toevoegen
          </button>
        </form>

        <div className="space-y-2">
          {masterPasswords.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 p-4">
              <div>
                <p className="font-semibold text-gray-900">{item.name}</p>
                <p className="text-xs text-gray-500">Aangemaakt: {new Date(item.created_at).toLocaleString()}</p>
              </div>
              <button
                type="button"
                disabled={deletingMasterPasswordId === item.id}
                onClick={() => handleDeleteMasterPassword(item.id)}
                className="p-2 rounded-lg cursor-pointer text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-gray-300"
                title="Verwijder master wachtwoord"
              >
                {deletingMasterPasswordId === item.id ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
              </button>
            </div>
          ))}
          {masterPasswords.length === 0 && (
            <p className="text-gray-400 italic">Nog geen master wachtwoorden ingesteld.</p>
          )}
        </div>
      </section>
    </div>
  );
};

export default AdminDashboard;
