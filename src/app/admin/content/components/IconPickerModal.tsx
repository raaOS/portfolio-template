import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Search, Loader2, Image as ImageIcon, RotateCcw } from 'lucide-react';
import AdminFileUpload from '@/app/admin/components/AdminFileUpload';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useConfirm } from '@/components/admin/ConfirmDialog';
import { useToast } from '@/contexts/ToastContext';

interface IconPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
  currentIcon?: string;
}

export default function IconPickerModal({
  isOpen,
  onClose,
  onSelect,
  currentIcon,
}: IconPickerModalProps) {
  const [icons, setIcons] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const { csrfToken } = useAdminAuth();
  const { confirm } = useConfirm();
  const { showError } = useToast();

  useEffect(() => {
    if (!isOpen) return;

    const fetchIcons = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/icons?v=${Date.now()}`);
        const data = await res.json();
        if (data.icons) setIcons(data.icons);
      } catch (e) {
        console.error('Failed to fetch icons', e);
      } finally {
        setLoading(false);
      }
    };

    fetchIcons();
  }, [isOpen, refreshTrigger]);

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleIconClick = (url: string) => {
    if (selectedUrl) return; // Prevent double clicks
    setSelectedUrl(url);
    // Delay to show animation
    setTimeout(() => {
      onSelect(url);
      setSelectedUrl(null); // Reset for next time
    }, 300);
  };

  const handleDelete = async (e: React.MouseEvent, url: string) => {
    e.stopPropagation();
    const ok = await confirm({
      title: 'Hapus ikon ini?',
      message: 'File ikon akan dihapus permanen dari Storage. Aksi ini tidak bisa di-undo.',
      confirmText: 'Hapus',
      cancelText: 'Batal',
      tone: 'danger',
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/admin/icons?url=${encodeURIComponent(url)}`, {
        method: 'DELETE',
        headers: {
          'x-csrf-token': csrfToken,
        },
      });
      if (res.ok) {
        setRefreshTrigger((prev) => prev + 1);
      } else {
        const data = await res.json();
        showError(`Gagal menghapus ikon: ${data.error || 'Permission Denied'}`);
      }
    } catch (e) {
      console.error('Delete error', e);
      showError('Terjadi kesalahan saat menghapus');
    }
  };

  if (!isOpen || typeof document === 'undefined') return null;

  const filteredIcons = icons.filter((icon) =>
    icon.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal Content */}
      <div className="animate-in fade-in zoom-in relative flex max-h-[85vh] min-h-0 w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 p-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Icon Library</h2>
            <p className="text-sm text-gray-500">Pilih dari koleksi atau upload ikon baru</p>
          </div>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
          {/* Sidebar / Upload Area */}
          <div className="flex max-h-[40vh] w-full shrink-0 flex-col gap-6 overflow-y-auto border-r border-gray-100 bg-gray-50/50 p-6 md:max-h-none md:w-72">
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Quick Upload
              </h3>
              <div className="group rounded-lg border-2 border-dashed border-gray-200 bg-white p-4 transition-all hover:border-blue-400">
                <AdminFileUpload
                  folder="assets/icons-library"
                  multiple={true}
                  accept="image/*,.icns"
                  onUpload={() => setRefreshTrigger((prev) => prev + 1)}
                />
              </div>
              <p className="text-[10px] leading-tight text-gray-400">
                Dukungan .icns, .png, .webp. Otomatis dikonversi & dioptimasi.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Search</h3>
                <button
                  onClick={() => setRefreshTrigger((prev) => prev + 1)}
                  className="inline-flex items-center justify-center rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-blue-500"
                  title="Refresh Library"
                >
                  <RotateCcw size={14} className={loading ? 'animate-spin' : ''} />
                </button>
              </div>
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  size={16}
                />
                <input
                  type="text"
                  placeholder="Cari ikon..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-10 pr-4 text-sm transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>
          </div>

          {/* Main Gallery Grid */}
          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-gray-400">
                <Loader2 className="animate-spin" size={32} />
                <p className="text-sm">Memuat galeri ikon...</p>
              </div>
            ) : filteredIcons.length > 0 ? (
              <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {filteredIcons.map((iconUrl, idx) => {
                  const isSelected = selectedUrl === iconUrl;
                  const isActive = currentIcon === iconUrl || isSelected;
                  const isBundledIcon = iconUrl.startsWith('/assets/icons-library/');

                  return (
                    <div
                      key={idx}
                      onClick={() => handleIconClick(iconUrl)}
                      className={`group relative flex aspect-square cursor-pointer items-center justify-center rounded-xl border-2 p-2 transition-all ${isActive ? 'border-emerald-500 bg-emerald-50/20' : 'border-gray-100 bg-white hover:border-emerald-200 hover:shadow-md'} ${isSelected ? 'scale-95 ring-4 ring-emerald-500/20' : ''} ${selectedUrl ? 'pointer-events-none opacity-50' : ''} `}
                    >
                      <img
                        src={iconUrl}
                        alt="icon"
                        className="h-full w-full object-contain drop-shadow-sm transition-transform group-hover:scale-110"
                      />
                      {isActive && (
                        <div className="animate-in zoom-in absolute -right-2 -top-2 z-20 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md duration-200">
                          <Check size={12} strokeWidth={3} />
                        </div>
                      )}

                      {/* Delete Button - Using X icon now, top-left */}
                      {!isBundledIcon && (
                        <button
                          onClick={(e) => handleDelete(e, iconUrl)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            handleDelete(e, iconUrl);
                          }}
                          className="absolute -left-2 -top-2 z-20 flex h-5 !min-h-0 w-5 !min-w-0 items-center justify-center rounded-full bg-red-500 p-0 text-white opacity-0 shadow-md transition-all duration-200 group-hover:opacity-100"
                          title="Hapus ikon (Klik kanan juga bisa)"
                          type="button"
                        >
                          <X size={12} strokeWidth={3} />
                        </button>
                      )}

                      <div className="absolute inset-0 rounded-xl bg-emerald-500/0 transition-colors group-hover:bg-emerald-500/5" />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-400">
                <ImageIcon size={48} className="opacity-20" />
                <p className="text-sm font-medium">Belum ada ikon di folder ini.</p>
                <p className="text-xs text-gray-500">Upload beberapa file untuk memulai.</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-gray-100 bg-gray-50 p-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-200 bg-white px-6 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
