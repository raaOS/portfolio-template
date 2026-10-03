'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Check, ChevronDown, Search, Wifi, LogOut, Users } from 'lucide-react';
import { useOSOverlays } from '../context/OSSystemContext';
import { Z_LAYERS } from '../utils/zIndexLayers';
import { useReducedMotion } from 'motion/react';
import type { LottieRefCurrentProps } from 'lottie-react';
import logoAnimationData from '../../../../public/lottie/mata.json';
import LanguageSwitch from '@/components/shared/LanguageSwitch';
import { useLanguage } from '@/contexts/LanguageContext';
import MusicPlayerWidget from '../ui/MusicWidget';

const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

interface MenuBarProps {
  onSearch?: () => void;
  activeWindow?: string;
  onAbout?: () => void;
  availability?: {
    status: string;
    text: string;
  };
  isAdmin?: boolean;
  onLogout?: () => void;
  onToggleControlCenter?: () => void;
}

export default function MenuBar({
  onSearch,
  activeWindow = 'Finder',
  onAbout,
  availability,
  isAdmin,
  onLogout,
  onToggleControlCenter,
}: MenuBarProps) {
  // Ikon mata hanyalah branding/penanda identitas — tautan login klien
  // (`/{slug}/login` -> `/client/login`) sudah dihapus karena sistem login
  // klien itu sendiri sudah dibuang (commit 686f762) dan seluruh rutenya 404.
  const { showCalendar, setShowCalendar, showGhostCursors, toggleGhostCursors } = useOSOverlays();
  const { dictionary: t, meta } = useLanguage();
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const viewMenuRef = useRef<HTMLDivElement>(null);
  const [time, setTime] = useState(new Date());

  const prefersReducedMotion = useReducedMotion();
  const lottieRef = useRef<LottieRefCurrentProps | null>(null);

  useEffect(() => {
    const instance = lottieRef.current;
    return () => {
      instance?.destroy?.();
    };
  }, []);

  useEffect(() => {
    const updateClock = () => setTime(new Date());
    updateClock();

    const scheduleNextTick = () => {
      const now = new Date();
      const delay = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
      return window.setTimeout(
        () => {
          updateClock();
          timer = scheduleNextTick();
        },
        Math.max(delay, 250)
      );
    };

    let timer = scheduleNextTick();
    return () => window.clearTimeout(timer);
  }, []);

  // Close view menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (viewMenuRef.current && !viewMenuRef.current.contains(e.target as Node)) {
        setViewMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Format: "Sen 22 Jan 19:30"
  const formattedTime = time.toLocaleTimeString(meta.intlLocale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const formattedDate = time.toLocaleDateString(meta.intlLocale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  const localizedActiveWindow =
    activeWindow === 'Finder'
      ? t.windowTitles.finder
      : activeWindow === 'Finder: About Me'
        ? t.windowTitles.about
        : activeWindow === 'WhatsApp'
          ? t.windowTitles.whatsapp
          : activeWindow === 'Contact'
            ? t.windowTitles.contact
            : activeWindow === 'Finder: Projects'
              ? t.windowTitles.projects
              : activeWindow === 'Project Explorer'
                ? t.windowTitles.explorer
                : activeWindow === 'Recycle Bin'
                  ? t.windowTitles.trash
                  : activeWindow;
  const availabilityText =
    availability?.status === 'available'
      ? t.header.available
      : availability?.status === 'busy'
        ? t.header.busy
        : availability?.text;

  return (
    <div
      className="pointer-events-auto fixed left-0 right-0 top-0 flex h-9 select-none items-center justify-between gap-2 border-b border-gray-200 bg-white px-2 text-xs text-black sm:h-8 sm:px-3 lg:px-4 print:hidden"
      style={{ zIndex: Z_LAYERS.CHROME }}
    >
      {/* Left Side */}
      <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2 lg:gap-4">
        <div
          role="img"
          className="relative flex h-8 w-12 shrink-0 cursor-pointer items-center justify-center"
          aria-label={t.menuBar.portfolioOS}
        >
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <Lottie
              lottieRef={lottieRef}
              animationData={logoAnimationData}
              loop={!prefersReducedMotion}
              autoplay={!prefersReducedMotion}
              rendererSettings={{ preserveAspectRatio: 'xMidYMid meet' }}
              style={{ width: 96, height: 96 }}
              aria-hidden="true"
            />
          </div>
        </div>
        <div
          className="hidden max-w-[clamp(5rem,22vw,12rem)] cursor-pointer truncate whitespace-nowrap rounded px-2 py-1 font-bold transition-colors hover:bg-black/5 sm:block"
          onClick={onAbout}
          title={localizedActiveWindow}
        >
          {localizedActiveWindow}
        </div>
        {/* Menus (Hidden on mobile for simplicity) */}
        <div className="hidden items-center gap-1 font-medium lg:flex">
          <div className="cursor-default rounded px-2 py-1 transition-colors hover:bg-black/5 xl:px-3">
            {t.menuBar.file}
          </div>
          <div className="cursor-default rounded px-2 py-1 transition-colors hover:bg-black/5 xl:px-3">
            {t.menuBar.edit}
          </div>
          <div
            ref={viewMenuRef}
            className="relative"
            onClick={() => setViewMenuOpen(!viewMenuOpen)}
          >
            <div className="flex cursor-default items-center gap-1 rounded px-2 py-1 transition-colors hover:bg-black/5 xl:px-3">
              {t.menuBar.view}
              <ChevronDown size={10} aria-hidden="true" />
            </div>
            {viewMenuOpen && (
              <div className="absolute left-0 top-full z-[1000] mt-1 min-w-[140px] rounded border border-gray-200 bg-white py-1 shadow-lg">
                <div
                  className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-black/5"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleGhostCursors();
                  }}
                >
                  <Users
                    size={14}
                    className={`flex-shrink-0 ${
                      showGhostCursors ? 'text-emerald-500' : 'text-gray-400'
                    }`}
                    aria-hidden="true"
                  />
                  <span className="truncate">{t.menuBar.showGhostCursors}</span>
                  {showGhostCursors && (
                    <Check size={12} className="ml-auto text-emerald-500" aria-hidden="true" />
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="cursor-default rounded px-2 py-1 transition-colors hover:bg-black/5 xl:px-3">
            {t.menuBar.go}
          </div>
          <div className="cursor-default rounded px-2 py-1 transition-colors hover:bg-black/5 xl:px-3">
            {t.menuBar.window}
          </div>
          <div className="cursor-default rounded px-2 py-1 transition-colors hover:bg-black/5 xl:px-3">
            {t.menuBar.help}
          </div>
        </div>
      </div>

      {/* Center Area - Logout Button (Admin Only) */}
      {isAdmin && (
        <div className="pointer-events-none absolute inset-x-0 flex h-full items-center justify-center">
          <div className="pointer-events-auto flex items-center gap-2">
            <div className="animate-in fade-in slide-in-from-top-1 flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
              <span className="text-[9px] font-bold uppercase tracking-wider text-amber-700">
                {t.menuBar.adminMode}
              </span>
            </div>
            <button
              onClick={onLogout}
              className="group flex items-center gap-1.5 px-3 py-1 text-red-600 transition-all hover:text-red-700 active:scale-95"
              title={t.menuBar.exitAdmin}
            >
              <LogOut size={14} className="transition-transform group-hover:-translate-x-0.5" />
              <span className="text-[11px] font-bold uppercase tracking-tight">
                {t.menuBar.exitAdmin}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Right Side */}
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 lg:gap-3">
        {/* Availability Status */}
        {availability && (
          <div
            className={`hidden max-w-[13rem] items-center gap-2 rounded-full px-2 py-0.5 transition-colors lg:flex ${
              availability.status === 'available'
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-red-50 text-red-700'
            }`}
          >
            <div
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                availability.status === 'available' ? 'animate-pulse bg-emerald-500' : 'bg-red-500'
              }`}
            />
            <span className="truncate text-[10px] font-medium uppercase tracking-wide">
              {availabilityText}
            </span>
          </div>
        )}

        <MusicPlayerWidget />
        <LanguageSwitch className="hidden md:inline-grid" />

        {/* Icons */}
        <div
          className="flex cursor-pointer items-center gap-2 sm:gap-3"
          onClick={onToggleControlCenter}
        >
          <Search
            size={18}
            className="hover:text-gray-600 sm:h-[14px] sm:w-[14px]"
            onClick={(e) => {
              e.stopPropagation();
              if (onSearch) onSearch();
            }}
          />
          <Wifi size={18} className="hidden hover:text-gray-600 sm:block sm:h-[14px] sm:w-[14px]" />

          {/* Custom Battery 100% Green */}
          <span
            className="flex items-center gap-[1px]"
            title={t.menuBar.batteryFull}
            role="img"
            aria-label={t.menuBar.batteryFull}
          >
            <div className="flex h-[11px] w-[22px] items-center justify-center rounded-[2.5px] border border-[#16a34a] bg-[#22c55e]">
              <span
                className="pt-[0.5px] text-[7px] font-bold leading-none text-black"
                aria-hidden="true"
              >
                100
              </span>
            </div>
            <div className="h-[3.5px] w-[1.5px] rounded-r-[1px] bg-[#16a34a] opacity-80" />
          </span>
        </div>

        {/* Clock */}
        <div
          className="flex cursor-pointer items-center gap-1 rounded px-1.5 py-1 font-medium transition-colors hover:bg-black/5 sm:gap-2 sm:px-2"
          onClick={(e) => {
            e.stopPropagation();
            setShowCalendar(!showCalendar);
          }}
        >
          <span className="hidden lg:inline">{formattedDate}</span>
          <span>{formattedTime}</span>
        </div>
      </div>
    </div>
  );
}
