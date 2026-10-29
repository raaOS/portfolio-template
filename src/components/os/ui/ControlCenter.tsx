import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { Wifi, Bluetooth, Airplay, Moon, Sun, Volume2 } from 'lucide-react';
import { useOSMedia } from '../context/OSSystemContext';
import { Z_LAYERS } from '../utils/zIndexLayers';
import { useDictionary } from '@/contexts/LanguageContext';
import MusicPlayerControlCard from './MusicPlayerControlCard';

interface ControlCenterProps {
  isOpen: boolean;
  onClose?: () => void;
}

export default function ControlCenter({ isOpen: _isOpen, onClose: _onClose }: ControlCenterProps) {
  const { brightness, setBrightness, volume, setVolume } = useOSMedia();
  const t = useDictionary();
  const [wifiState, setWifiState] = useState(true);
  const [bluetoothState, setBluetoothState] = useState(true);
  const [airdropState, setAirdropState] = useState(false);
  const [dndState, setDndState] = useState(false);

  // Apply brightness filter to the root element reactively.
  // Cleanup restores full brightness on unmount so the filter
  // doesn't leak and darken the entire page after ControlCenter closes.
  useEffect(() => {
    if (brightness < 100) {
      document.documentElement.style.filter = `brightness(${brightness / 100})`;
    } else {
      document.documentElement.style.removeProperty('filter');
    }
    return () => {
      document.documentElement.style.removeProperty('filter');
    };
  }, [brightness]);

  const handleBrightnessChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setBrightness(parseInt(e.target.value, 10));
    },
    [setBrightness]
  );

  return (
    <motion.div
      role="region"
      aria-label={t.controlCenter.label}
      initial={{ opacity: 0, width: 46, height: 46, filter: 'blur(4px)' }}
      animate={{ opacity: 1, width: 320, height: 'auto', filter: 'blur(0px)' }}
      exit={{ opacity: 0, width: 46, height: 46, filter: 'blur(4px)' }}
      transition={{
        type: 'spring',
        stiffness: 380,
        damping: 34,
        mass: 0.85,
        opacity: { duration: 0.16 },
        filter: { duration: 0.16 },
        width: { type: 'spring', stiffness: 430, damping: 34, mass: 0.85 },
        height: { type: 'spring', stiffness: 320, damping: 34, mass: 0.9 },
      }}
      style={{ zIndex: Z_LAYERS.POPOUT }}
      className="fixed right-2 top-12 flex flex-col items-end overflow-hidden rounded-2xl border border-white/20 bg-white/70 text-black backdrop-blur-3xl dark:border-white/10 dark:bg-black/70 dark:text-white sm:right-4"
    >
      <motion.div 
        className="w-[320px] shrink-0 p-4"
        initial={{ opacity: 0, x: 8, filter: 'blur(2px)' }}
        animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, x: 8, filter: 'blur(2px)' }}
        transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Grid 2x2 */}
        <div className="mb-3 grid grid-cols-2 gap-3">
          {/* Connections Block */}
          <div className="flex flex-col gap-3 rounded-xl border border-black/5 bg-white/50 p-3 dark:border-white/5 dark:bg-white/10">
            {/* Wifi */}
            <div
              className="group flex cursor-pointer items-center gap-2"
              onClick={() => setWifiState(!wifiState)}
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${wifiState ? 'bg-zinc-900 text-white dark:bg-white dark:text-black' : 'bg-gray-200 text-gray-500 dark:bg-white/10 dark:text-gray-300'}`}
              >
                <Wifi size={16} />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold">Wi-Fi</span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                  {wifiState ? t.controlCenter.home : t.common.off}
                </span>
              </div>
            </div>
            {/* Bluetooth */}
            <div
              className="group flex cursor-pointer items-center gap-2"
              onClick={() => setBluetoothState(!bluetoothState)}
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${bluetoothState ? 'bg-zinc-900 text-white dark:bg-white dark:text-black' : 'bg-gray-200 text-gray-500 dark:bg-white/10 dark:text-gray-300'}`}
              >
                <Bluetooth size={16} />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold">Bluetooth</span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                  {bluetoothState ? t.common.on : t.common.off}
                </span>
              </div>
            </div>
            {/* AirDrop */}
            <div
              className="group flex cursor-pointer items-center gap-2"
              onClick={() => setAirdropState(!airdropState)}
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${airdropState ? 'bg-zinc-900 text-white dark:bg-white dark:text-black' : 'bg-gray-200 text-gray-500 dark:bg-white/10 dark:text-gray-300'}`}
              >
                <Airplay size={16} />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold">AirDrop</span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                  {airdropState ? t.controlCenter.contactsOnly : t.controlCenter.everyone}
                </span>
              </div>
            </div>
          </div>

          {/* Right Side Buttons */}
          <div className="flex flex-col gap-3">
            {/* Focus/DND */}
            <div
              className={`flex flex-1 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-black/5 p-3 transition-colors dark:border-white/5 ${dndState ? 'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300' : 'bg-white/50 dark:bg-white/10'}`}
              onClick={() => setDndState(!dndState)}
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full ${dndState ? 'bg-indigo-500 text-white' : 'bg-gray-200 text-gray-600 dark:bg-white/10 dark:text-gray-200'}`}
              >
                <Moon size={16} fill={dndState ? 'currentColor' : 'none'} />
              </div>
              <span className="text-xs font-semibold">
                {dndState ? t.controlCenter.doNotDisturb : t.controlCenter.focus}
              </span>
            </div>
          </div>
        </div>

        <div className="mb-3">
          <MusicPlayerControlCard />
        </div>

        {/* Sliders Area */}
        <div className="space-y-3">
          {/* Brightness Display */}
          <div className="flex items-center gap-3 rounded-xl border border-black/5 bg-white/50 p-3 dark:border-white/5 dark:bg-white/10">
            <div className="flex min-w-[32px] flex-col items-center gap-1">
              <Sun size={16} className="text-gray-500 dark:text-gray-400" />
              <span className="text-[10px] font-medium opacity-70">{brightness}%</span>
            </div>
            <div className="relative h-6 flex-1 overflow-hidden rounded-full border border-black/5 bg-black/5 dark:border-white/10 dark:bg-white/10">
              <div
                className="absolute bottom-0 left-0 top-0 bg-zinc-900 transition-all duration-200 dark:bg-white"
                style={{ width: `${brightness}%` }}
              ></div>
              <input
                type="range"
                min="0"
                max="100"
                value={brightness}
                onChange={handleBrightnessChange}
                aria-label={t.common.brightness}
                aria-valuenow={brightness}
                aria-valuemin={0}
                aria-valuemax={100}
                className="absolute inset-0 w-full cursor-pointer opacity-0"
              />
            </div>
          </div>

          {/* Volume Display */}
          <div className="flex items-center gap-3 rounded-xl border border-black/5 bg-white/50 p-3 dark:border-white/5 dark:bg-white/10">
            <div className="flex min-w-[32px] flex-col items-center gap-1">
              <Volume2 size={16} className="text-gray-500 dark:text-gray-400" />
              <span className="text-[10px] font-medium opacity-70">{volume}%</span>
            </div>
            <div className="relative h-6 flex-1 overflow-hidden rounded-full border border-black/5 bg-black/5 dark:border-white/10 dark:bg-white/10">
              <div
                className="absolute bottom-0 left-0 top-0 bg-zinc-900 transition-all duration-200 dark:bg-white"
                style={{ width: `${volume}%` }}
              ></div>
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setVolume(val);
                }}
                aria-label={t.common.volume}
                aria-valuenow={volume}
                aria-valuemin={0}
                aria-valuemax={100}
                className="absolute inset-0 w-full cursor-pointer opacity-0"
              />
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
