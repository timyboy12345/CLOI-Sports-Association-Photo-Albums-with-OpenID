import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Menu } from 'lucide-react';
import AlbumList from './components/AlbumList';
import PhotoGallery from './components/PhotoGallery';
import AdminDashboard from './components/AdminDashboard';
import EditAlbum from './components/EditAlbum';
import Sidebar from './components/Sidebar';
import PublicAccessGate from './components/PublicAccessGate';
import './index.css';

function App() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <Router>
      <div className="flex min-h-screen bg-white">
        <Sidebar
          isOpen={isMobileSidebarOpen}
          onClose={() => setIsMobileSidebarOpen(false)}
        />
        <div className="flex-1 md:ml-64 min-w-0">
          <header className="md:hidden flex flex-row sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-3">
            <button
              onClick={() => setIsMobileSidebarOpen((prev) => !prev)}
              className="inline-flex cursor-pointer items-center gap-2 text-gray-700 hover:text-red-900"
              aria-label="Open menu"
            >
              <Menu size={22} />
              <span className="font-semibold">Menu</span>
            </button>
          </header>
          <PublicAccessGate>
            <main className="p-4 md:p-8">
              <div className="max-w-6xl mx-auto">
                <Routes>
                  <Route path="/" element={<AlbumList />} />
                  <Route path="/album/:id" element={<PhotoGallery />} />
                  <Route path="/admin" element={<AdminDashboard />} />
                  <Route path="/admin/edit/:id" element={<EditAlbum />} />
                </Routes>
              </div>
            </main>
          </PublicAccessGate>
        </div>
      </div>
    </Router>
  );
}

export default App;
