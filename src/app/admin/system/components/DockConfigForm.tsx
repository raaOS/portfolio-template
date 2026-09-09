import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Pencil, Image as ImageIcon } from 'lucide-react';
import IconPickerModal from '../../content/components/IconPickerModal';

interface DockItemConfig {
  label?: string;
  iconUrl?: string;
  isHidden?: boolean;
}

interface DockPreferences {
  [key: string]: DockItemConfig;
}

interface DockConfigFormProps {
  data?: DockPreferences;
  onUpdate: (data: DockPreferences) => void;
}

const DEFAULT_DOCK_ITEMS = [
  { id: 'about', defaultLabel: 'About Me' },
  { id: 'projects', defaultLabel: 'Projects' },
  { id: 'contact', defaultLabel: 'Contact' },
  { id: 'whatsapp', defaultLabel: 'WhatsApp' },
  { id: 'notes', defaultLabel: 'Notes' },
];

export default function DockConfigForm({ data, onUpdate }: DockConfigFormProps) {
  const [preferences, setPreferences] = useState<DockPreferences>(data || {});
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const isInitialMount = React.useRef(true);
  const lastSavedData = React.useRef<string>(JSON.stringify(data || {}));

  // Sync state with props in useEffect to avoid ref access during render
  useEffect(() => {
    if (data) {
      const dataString = JSON.stringify(data);
      if (dataString !== lastSavedData.current) {
        setPreferences(data);
        lastSavedData.current = dataString;
      }
    }
  }, [data]);

  // Debounced Save
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const currentString = JSON.stringify(preferences);
    if (currentString === lastSavedData.current) return; // No changes

    const handler = setTimeout(() => {
      onUpdate(preferences);
      lastSavedData.current = currentString;
    }, 1000); // 1 second debounce

    return () => {
      clearTimeout(handler);
    };
  }, [preferences, onUpdate]);

  const handleUpdateItem = (id: string, updates: Partial<DockItemConfig>) => {
    const newPreferences = {
      ...preferences,
      [id]: { ...(preferences[id] || {}), ...updates },
    };
    setPreferences(newPreferences);
  };

  const handleOpenPicker = (id: string) => {
    setActiveItemId(id);
    setIsPickerOpen(true);
  };

  const handleSelectIcon = (url: string) => {
    if (activeItemId) {
      handleUpdateItem(activeItemId, { iconUrl: url });
      setIsPickerOpen(false);
      setActiveItemId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 text-lg font-medium text-gray-900">Dock Configuration</h3>
        <p className="mb-6 text-sm text-gray-600">
          Klik ikon untuk mengganti. Perubahan disimpan secara otomatis (Auto-Save).
        </p>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {DEFAULT_DOCK_ITEMS.map((item) => {
            const config = preferences[item.id] || {};
            const label = config.label || item.defaultLabel;
            const isHidden = config.isHidden || false;

            return (
              <div
                key={item.id}
                className={`group relative rounded-xl border p-4 transition-all duration-200 ${
                  isHidden
                    ? 'border-gray-100 bg-gray-50 opacity-60 grayscale-[0.5]'
                    : 'border-gray-200 bg-white shadow-sm hover:border-blue-200 hover:shadow-md'
                } `}
              >
                {/* Visibility Toggle (Top Right) */}
                <button
                  onClick={() => handleUpdateItem(item.id, { isHidden: !isHidden })}
                  className={`absolute right-3 top-3 z-10 rounded-full p-1.5 transition-all ${
                    isHidden
                      ? 'bg-gray-100 text-gray-400 hover:text-gray-600'
                      : 'text-gray-300 opacity-0 hover:bg-gray-50 hover:text-blue-500 group-hover:opacity-100'
                  } `}
                  title={isHidden ? 'Show in Dock' : 'Hide from Dock'}
                >
                  {isHidden ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>

                <div className="flex flex-col items-center gap-3 pt-2 text-center">
                  {/* Large Icon Preview */}
                  <button
                    onClick={() => handleOpenPicker(item.id)}
                    aria-label={`Upload atau ganti ikon ${label}`}
                    title={`Upload atau ganti ikon ${label}`}
                    className="group/icon relative h-20 w-20 overflow-hidden rounded-[22px] transition-transform focus:outline-none focus:ring-4 focus:ring-blue-500/10 active:scale-95"
                  >
                    <div className="flex h-full w-full items-center justify-center bg-gray-50">
                      {config.iconUrl ? (
                        <img
                          src={config.iconUrl}
                          alt={label}
                          className="h-full w-full object-contain drop-shadow-sm transition-transform group-hover/icon:scale-110"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-gray-500 opacity-20">
                          <ImageIcon size={24} />
                          <span className="text-[9px] font-black uppercase tracking-tighter">
                            {item.id.slice(0, 3)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Edit Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 backdrop-blur-[2px] transition-all duration-200 group-hover/icon:opacity-100">
                      <Pencil
                        size={20}
                        className="scale-90 text-white drop-shadow-md transition-transform group-hover/icon:scale-100"
                      />
                    </div>

                    <span className="pointer-events-none absolute bottom-1.5 right-1.5 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg ring-2 ring-white transition-all duration-200 group-hover/icon:scale-95 group-hover/icon:opacity-0">
                      <Pencil size={12} strokeWidth={2.5} />
                    </span>
                  </button>

                  {/* Label Input */}
                  <div className="w-full space-y-1">
                    <input
                      type="text"
                      value={label}
                      onChange={(e) => handleUpdateItem(item.id, { label: e.target.value })}
                      className="w-full cursor-text border-none bg-transparent p-0 text-center text-sm font-semibold placeholder-gray-300 transition-colors hover:text-blue-600 focus:ring-0"
                      placeholder="Label"
                    />
                    <div className="mx-auto h-0.5 w-8 rounded-full bg-gray-100 transition-colors group-hover:bg-blue-100" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Icon Picker Modal */}
      <IconPickerModal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSelect={handleSelectIcon}
        currentIcon={activeItemId ? preferences[activeItemId]?.iconUrl : undefined}
      />
    </div>
  );
}
