import {useState, useEffect} from 'react';
import {Link} from 'react-router-dom';
import api, {getUploadsUrl} from '../api';
import {Calendar, ChevronRight, Image as ImageIcon, Lock} from 'lucide-react';

interface Album {
    id: number;
    name: string;
    date: string;
    cover_photo?: string;
    has_password?: number;
}

const AlbumList = () => {
    const [albums, setAlbums] = useState<Album[]>([]);

    useEffect(() => {
        api.get('/albums')
            .then(res => setAlbums(res.data))
            .catch(err => console.error('Failed to fetch albums', err));
    }, []);

    document.title = 'Fotoalbums - Fotoalbum';

    const albumsByYear = albums.reduce((acc, album) => {
        const year = new Date(album.date).getFullYear();
        if (!acc[year]) acc[year] = [];
        acc[year].push(album);
        return acc;
    }, {} as Record<number, Album[]>);

    const sortedYears = Object.keys(albumsByYear)
        .map(Number)
        .sort((a, b) => b - a);

    return (
        <div className="space-y-12">
            <div className="flex justify-between items-center pb-4">
                <h1 className="text-3xl font-bold text-gray-900">Fotoalbums</h1>
            </div>

            {sortedYears.map(year => (
                <section key={year} className="space-y-6">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                        <Calendar className="text-red-900" size={24} />
                        {year}
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {albumsByYear[year].map(album => (
                            <Link
                                to={`/album/${album.id}`}
                                key={album.id}
                                className="group rounded-xl border border-gray-200 overflow-hidden hover:border-gray-300 hover:bg-gray-50 transition-all duration-200 bg-gray-50/30"
                            >
                                <div
                                    className="aspect-video w-full bg-gray-100 relative overflow-hidden border-b border-gray-100">
                                    {album.cover_photo ? (
                                        <img
                                            src={getUploadsUrl(album.cover_photo)}
                                            alt={album.name}
                                            className="w-full h-full object-cover transition-transform duration-500"
                                        />

                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                                            <ImageIcon size={48}/>
                                        </div>
                                    )}
                                </div>
                                <div className="p-5">
                                    <div className="flex justify-between items-center mb-2">
                                        <h3 className="text-lg font-semibold text-gray-900 transition-colors truncate">
                                            {album.name}
                                        </h3>
                                        {Boolean(album.has_password) && (
                                            <span className="mr-2 inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
                                                <Lock size={12}/>
                                                Beveiligd
                                            </span>
                                        )}
                                        <ChevronRight size={20}
                                                      className="text-gray-400 transform group-hover:translate-x-1 transition-all flex-shrink-0"/>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-gray-500">
                                        <Calendar size={14}/>
                                        {new Date(album.date).toLocaleDateString(undefined, {
                                            month: 'long',
                                            day: 'numeric'
                                        })}
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>
            ))}

            {albums.length === 0 && (
                <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
                    <p className="text-gray-500">No albums found. Start by uploading some photos in the Admin panel.</p>
                </div>
            )}
        </div>
    );
};

export default AlbumList;
