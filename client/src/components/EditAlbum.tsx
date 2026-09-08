import {useState, useEffect} from 'react';
import {useParams, Link} from 'react-router-dom';
import api, {getUploadsUrl} from '../api';
import {
    ArrowLeft,
    Trash2,
    Save,
    Calendar as CalendarIcon,
    Loader2,
    Image as ImageIcon,
    Upload,
    LogOut,
    User as UserIcon
} from 'lucide-react';

interface Photo {
    id: number;
    filename: string;
}

interface AlbumData {
    album: { id: number; name: string; date: string; has_password?: number };
    photos: Photo[];
}

interface User {
    id?: number;
    email?: string;
    name?: string;
    role?: string;
}

const EditAlbum = () => {
    const {id} = useParams<{ id: string }>();
    const [data, setData] = useState<AlbumData | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [albumDate, setAlbumDate] = useState('');
    const [albumName, setAlbumName] = useState('');
    const [albumPassword, setAlbumPassword] = useState('');
    const [removePassword, setRemovePassword] = useState(false);
    const [hasPassword, setHasPassword] = useState(false);
    const [files, setFiles] = useState<FileList | null>(null);
    const [uploadTotal, setUploadTotal] = useState(0);
    const [uploadedCount, setUploadedCount] = useState(0);
    const [uploadMessage, setUploadMessage] = useState<string | null>(null);
    const [collapsed, setCollapsed] = useState(true);
    const [selectedPhotoIds, setSelectedPhotoIds] = useState<number[]>([]);
    const [isDragging, setIsDragging] = useState(false);

    useEffect(() => {
        const init = async () => {
            await Promise.all([fetchAlbum(), checkAuth()]);
        };
        init();
    }, [id]);

    useEffect(() => {
        if (data?.album.name) {
            document.title = `Bewerk ${data.album.name} / Fotoalbum`;
        }
    }, [data]);

    const checkAuth = async () => {
        try {
            const res = await api.get('/auth/me');
            setUser(res.data);
        } catch (err) {
            setUser(null);
        }
    };

    const handleLogout = async () => {
        try {
            await api.post('/auth/logout', {});
            window.location.href = '/admin';
        } catch (err) {
            console.error('Logout failed', err);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            setFiles(e.dataTransfer.files);
        }
    };

    const fetchAlbum = async () => {
        try {
            const res = await api.get(`/albums/${id}`);
            setData(res.data);
            setAlbumDate(new Date(res.data.album.date).toISOString().split('T')[0]);
            setAlbumName(res.data.album.name);
            setHasPassword(Boolean(res.data.album.has_password));
            setAlbumPassword('');
            setRemovePassword(false);
            setSelectedPhotoIds([]);
        } catch (err) {
            console.error('Failed to fetch album', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload: { name: string; date: string; password?: string } = {
                name: albumName,
                date: albumDate
            };

            if (removePassword) {
                payload.password = '';
            } else if (albumPassword.trim()) {
                payload.password = albumPassword;
            }

            await api.patch(`/albums/${id}`, {
                ...payload
            }, {withCredentials: true});
            if (removePassword) {
                setHasPassword(false);
            } else if (albumPassword.trim()) {
                setHasPassword(true);
            }
            setAlbumPassword('');
            setRemovePassword(false);
            alert('Album updated successfully!');
        } catch (err) {
            alert('Failed to update album.');
        } finally {
            setSaving(false);
        }
    };

    const removePhotosFromState = (photoIds: number[]) => {
        const idSet = new Set(photoIds);
        setData(prev => prev ? {
            ...prev,
            photos: prev.photos.filter(p => !idSet.has(p.id))
        } : null);
        setSelectedPhotoIds(prev => prev.filter(id => !idSet.has(id)));
    };

    const deletePhotos = async (photoIds: number[]) => {
        await Promise.all(photoIds.map((photoId) => api.delete(`/photos/${photoId}`, {withCredentials: true})));
        removePhotosFromState(photoIds);
    };

    const handleDeletePhoto = async (photoId: number) => {
        if (!window.confirm('Are you sure you want to delete this photo?')) return;
        try {
            await deletePhotos([photoId]);
        } catch (err) {
            alert('Failed to delete photo.');
        }
    };

    const handleDeleteSelectedPhotos = async () => {
        if (selectedPhotoIds.length === 0) return;
        if (!window.confirm(`Are you sure you want to delete ${selectedPhotoIds.length} selected photo(s)?`)) return;
        try {
            await deletePhotos(selectedPhotoIds);
        } catch (err) {
            alert('Failed to delete selected photos.');
        }
    };

    const togglePhotoSelection = (photoId: number) => {
        setSelectedPhotoIds(prev =>
            prev.includes(photoId)
                ? prev.filter(id => id !== photoId)
                : [...prev, photoId]
        );
    };

    const toggleSelectAll = () => {
        if (!data) return;
        if (selectedPhotoIds.length === data.photos.length) {
            setSelectedPhotoIds([]);
        } else {
            setSelectedPhotoIds(data.photos.map(photo => photo.id));
        }
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!files || files.length === 0) return;

        setUploading(true);
        setUploadTotal(files.length);
        setUploadedCount(0);

        try {
            for (let i = 0; i < files.length; i++) {
                const formData = new FormData();
                formData.append('photos', files[i]);

                await api.post(`/albums/${id}/upload`, formData, {
                    headers: {'Content-Type': 'multipart/form-data'},
                    withCredentials: true
                });

                setUploadedCount(i + 1);
            }

            await fetchAlbum();
            setFiles(null);
            setUploadMessage('Foto\'s geupload!');
        } catch (err) {
            alert('Upload failed. Please ensure you are logged in.');
        } finally {
            setUploading(false);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="animate-spin text-red-900" size={32}/>
        </div>
    );

    if (!user || user.role !== 'admin') {
        return (
            <div className="max-w-md mx-auto mt-10">
                <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
                    <div
                        className="w-16 h-16 bg-amber-50 text-amber-900 rounded-full flex items-center justify-center mx-auto mb-6">
                        <UserIcon size={32}/>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Toegang Geweigerd</h1>
                    <p className="text-gray-500 mb-8">
                        {user
                            ? <>Je bent ingelogd als <strong>{user.email}</strong>, maar je hebt geen admin rechten.</>
                            : <>Log in om dit album te bewerken.</>
                        }
                    </p>
                    <button
                        onClick={user ? handleLogout : () => window.location.href = '/admin'}
                        className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-6 rounded-xl transition-colors cursor-pointer"
                    >
                        {user ? <><LogOut size={20}/> Uitloggen</> : 'Naar login'}
                    </button>
                </div>
            </div>
        );
    }

    if (!data) return <div className="text-center py-10">Album not found.</div>;

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-4">
                <Link
                    to="/admin"
                    className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-red-900 transition-colors w-fit"
                >
                    <ArrowLeft size={16}/>
                    Back to Admin
                </Link>
                <h1 className="text-3xl font-bold text-gray-900">Album aanpassen: {data.album.name}</h1>
            </div>

            <section className="bg-white p-4 rounded-2xl border border-gray-200">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold">Album Instellingen & Uploaden</h2>
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className="text-sm cursor-pointer font-medium text-gray-500 hover:text-red-900"
                    >
                        {collapsed ? 'Uitvouwen' : 'Invouwen'}
                    </button>
                </div>
                {!collapsed && (
                    <div className="space-y-6 mt-6 lg:flex lg:space-y-0 lg:space-x-6">
                        <form onSubmit={handleSave} className="space-y-6 lg:flex-1">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Album Name</label>
                                    <input
                                        type="text"
                                        value={albumName}
                                        onChange={(e) => setAlbumName(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-900 focus:border-transparent transition-all"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Event Date</label>
                                    <div className="relative">
                                        <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                                                      size={18}/>
                                        <input
                                            type="date"
                                            value={albumDate}
                                            onChange={(e) => setAlbumDate(e.target.value)}
                                            className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-900 focus:border-transparent transition-all"
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <label className="text-sm font-medium text-gray-700">Toegangscode</label>
                                    <input
                                        type="password"
                                        value={albumPassword}
                                        onChange={(e) => {
                                            setAlbumPassword(e.target.value);
                                            if (e.target.value) setRemovePassword(false);
                                        }}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-900 focus:border-transparent transition-all"
                                        placeholder={hasPassword ? 'Laat leeg om huidige wachtwoord te behouden' : 'Stel een wachtwoord in (optioneel)'}
                                    />
                                    {hasPassword && (
                                        <label className="inline-flex items-center gap-2 text-sm text-gray-600">
                                            <input
                                                type="checkbox"
                                                checked={removePassword}
                                                onChange={(e) => {
                                                    setRemovePassword(e.target.checked);
                                                    if (e.target.checked) setAlbumPassword('');
                                                }}
                                                className="h-4 w-4 accent-red-600"
                                            />
                                            Verwijder huidig wachtwoord
                                        </label>
                                    )}
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={saving}
                                className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 cursor-pointer text-white font-semibold py-3 px-8 rounded-xl transition-colors disabled:bg-red-300"
                            >
                                {saving ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>}
                                Aanpassingen opslaan
                            </button>
                        </form>

                        <form onSubmit={handleUpload} className="lg:flex-1 flex flex-col min-h-[300px]">
                            <div
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                className={`flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-2xl transition-all ${
                                    isDragging
                                        ? 'border-red-600 bg-red-50 shadow-inner'
                                        : files && files.length > 0
                                            ? 'border-green-500 bg-green-50'
                                            : 'border-gray-200 hover:border-red-900 hover:bg-gray-50'
                                }`}
                            >
                                <input
                                    type="file"
                                    multiple
                                    id="file-upload"
                                    accept="image/*,video/*"
                                    onChange={(e) => setFiles(e.target.files)}
                                    className="hidden"
                                />
                                <label
                                    htmlFor="file-upload"
                                    className="w-full h-full flex flex-col items-center justify-center cursor-pointer p-6 text-center"
                                >
                                    <Upload
                                        size={48}
                                        className={`mb-4 transition-colors ${
                                            isDragging ? 'text-red-600' : files && files.length > 0 ? 'text-green-600' : 'text-gray-400'
                                        }`}
                                    />
                                    <div className="space-y-1">
                                        <p className="text-lg font-semibold text-gray-900">
                                            {files && files.length > 0
                                                ? `${files.length} bestand(en) geselecteerd`
                                                : "Sleep foto's hierheen"}
                                        </p>
                                        <p className="text-sm text-gray-500">
                                            of klik om bestanden te selecteren
                                        </p>
                                    </div>
                                </label>
                            </div>

                            {(files && files.length > 0 || uploading) && (
                                <div className="mt-4 space-y-4">
                                    {uploading && uploadTotal > 0 && (
                                        <div className="space-y-2">
                                            <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-red-600 transition-all"
                                                    style={{width: `${(uploadedCount / uploadTotal) * 100}%`}}
                                                />
                                            </div>
                                            <p className="text-sm text-gray-600">
                                                {uploadedCount}/{uploadTotal} foto's geüpload ·
                                                Nog {uploadTotal - uploadedCount} te gaan
                                            </p>
                                        </div>
                                    )}
                                    <button
                                        type="submit"
                                        className="w-full flex cursor-pointer items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-semibold py-3 px-6 rounded-xl transition-colors shadow-sm"
                                        disabled={uploading}
                                    >
                                        {uploading ? (
                                            <>
                                                <Loader2 className="animate-spin" size={20}/>
                                                Bezig met uploaden... ({uploadedCount}/{uploadTotal})
                                            </>
                                        ) : (
                                            <>
                                                <Upload size={20}/>
                                                Start Upload
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}
                            {uploadMessage && (
                                <p className="mt-2 text-sm text-green-600 text-center font-medium">{uploadMessage}</p>
                            )}
                        </form>
                    </div>
                )}
            </section>

            <section className="space-y-4">
                <div className="flex flex-col md:flex-row gap-2 md:items-center md:justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            <ImageIcon size={24} className="text-red-900"/>
                            Manage Photos ({data.photos.length})
                        </h2>
                    </div>
                    <div>
                        {data.photos.length > 0 && (
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={toggleSelectAll}
                                    className="px-3 py-2 cursor-pointer text-sm rounded-lg border border-gray-200 hover:bg-gray-50"
                                >
                                    {selectedPhotoIds.length === data.photos.length ? 'Deselect all' : 'Select all'}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDeleteSelectedPhotos}
                                    disabled={selectedPhotoIds.length === 0}
                                    className="px-3 py-2 cursor-pointer text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed"
                                >
                                    Delete selected ({selectedPhotoIds.length})
                                </button>
                            </div>
                        )}
                    </div>
                </div>


                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-1">
                    {data.photos.map(photo => (
                        <div key={photo.id}
                             className="group relative aspect-square overflow-hidden bg-gray-50"
                             onClick={() => togglePhotoSelection(photo.id)}
                        >
                            <label className="absolute top-2 left-2 z-10">
                                <input
                                    type="checkbox"
                                    checked={selectedPhotoIds.includes(photo.id)}
                                    onChange={() => togglePhotoSelection(photo.id)}
                                    className="h-4 w-4 cursor-pointer accent-red-600"
                                />
                            </label>
                            <img
                                src={getUploadsUrl(photo.filename)}
                                alt={`Foto ${photo.id}`}
                                className="w-full h-full object-cover text-center leading-[150px]"
                            />
                            <div
                                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeletePhoto(photo.id)
                                    }}
                                    className="p-3 cursor-pointer bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
                                    title="Delete Photo"
                                >
                                    <Trash2 size={20}/>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {data.photos.length === 0 && (
                    <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
                        <p className="text-gray-500">Dit album heeft nog geen foto's.</p>
                    </div>
                )}
            </section>
        </div>
    );
};

export default EditAlbum;
