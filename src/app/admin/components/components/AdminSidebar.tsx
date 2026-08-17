'use client';

import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Eye,
  LogOut,
  ChevronDown,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { NAV_ITEMS, type NavItem } from '../AdminConstants';
import { prefetchAdminRoute } from '../../lib/adminQueries';

interface AdminSidebarProps {
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  expandedMenus: Record<string, boolean>;
  toggleMenu: (href: string) => void;
  isActive: (href: string) => boolean;
  handleLogout: () => Promise<void>;
}

const NavIcon = ({ icon: IconComponent, className }: { icon: LucideIcon; className?: string }) => {
  return <IconComponent className={className || ''} aria-hidden="true" />;
};

function isVirtualGroupHref(href: string) {
  return href.endsWith('-group') || href === '/admin/os-config';
}

export const AdminSidebar = ({
  isMobileMenuOpen,
  setIsMobileMenuOpen,
  sidebarCollapsed,
  setSidebarCollapsed,
  expandedMenus,
  toggleMenu,
  isActive,
  handleLogout,
}: AdminSidebarProps) => {
  const router = useRouter();
  const queryClient = useQueryClient();

  const warmRoute = (href: string) => {
    if (isVirtualGroupHref(href)) return;
    void prefetchAdminRoute(queryClient, href);
  };

  const renderNavItem = (item: NavItem, depth = 0) => {
    const active = isActive(item.href);
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedMenus[item.href];
    const isVirtualGroup = isVirtualGroupHref(item.href);

    // Determine padding based on depth - we keep it simple for admin
    const depthPadding = depth * 12;

    const itemClass = `
      group flex items-center justify-between py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer
      ${active && !hasChildren ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900 ' + item.bg}
    `;

    const itemStyle = { paddingLeft: `${sidebarCollapsed ? '0' : '12px'}`, paddingRight: '12px' };

    const renderInner = () => (
      <>
        <div className="flex min-w-0 flex-1 items-center overflow-hidden">
          <div className="flex w-[56px] shrink-0 items-center justify-center">
            <NavIcon
              icon={item.icon}
              className={`h-4.5 w-4.5 ${active ? item.color : 'text-gray-400 group-hover:text-gray-600'}`}
            />
          </div>
          <span
            className={`truncate transition-all duration-300 ${sidebarCollapsed ? 'pointer-events-none w-0 opacity-0' : 'ml-1 w-auto opacity-100'} `}
            style={{ paddingLeft: !sidebarCollapsed ? `${depthPadding}px` : '0px' }}
          >
            {item.label}
          </span>
        </div>

        {hasChildren && !sidebarCollapsed && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleMenu(item.href);
            }}
            className="ml-1 flex items-center justify-center rounded-md p-1 transition-colors hover:bg-black/5"
          >
            {isExpanded ? (
              <ChevronDown size={14} className="text-gray-400" />
            ) : (
              <ChevronRight size={14} className="text-gray-400" />
            )}
          </button>
        )}
      </>
    );

    return (
      <div key={item.href} className="mb-0.5">
        {isVirtualGroup ? (
          // Virtual group: button-only, klik = expand/collapse, tidak navigate
          <div
            role="button"
            tabIndex={0}
            className={itemClass}
            style={itemStyle}
            onMouseEnter={() => warmRoute(item.href)}
            onFocus={() => warmRoute(item.href)}
            onClick={() => {
              if (sidebarCollapsed) {
                setSidebarCollapsed(false);
                return;
              }
              if (hasChildren) toggleMenu(item.href);
              setIsMobileMenuOpen(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (sidebarCollapsed) {
                  setSidebarCollapsed(false);
                  return;
                }
                if (hasChildren) toggleMenu(item.href);
              }
            }}
          >
            {renderInner()}
          </div>
        ) : (
          // Leaf / parent dengan route nyata: pakai <Link> agar Next.js
          // melakukan automatic prefetch (intersection-observer based) +
          // RSC payload caching → transisi antar menu CRUD jauh lebih cepat.
          <Link
            href={item.href}
            prefetch
            className={itemClass}
            style={itemStyle}
            onMouseEnter={() => warmRoute(item.href)}
            onFocus={() => warmRoute(item.href)}
            onClick={(e) => {
              if (sidebarCollapsed) {
                e.preventDefault();
                setSidebarCollapsed(false);
                return;
              }
              if (hasChildren) toggleMenu(item.href);
              setIsMobileMenuOpen(false);
            }}
          >
            {renderInner()}
          </Link>
        )}

        {hasChildren && isExpanded && !sidebarCollapsed && (
          <div className="mt-0.5 space-y-0.5">
            {item.children!.map((child) => renderNavItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Sidebar width classes
  const sidebarWidth = sidebarCollapsed ? 'w-[72px]' : 'w-64';
  const headerJustify = sidebarCollapsed ? 'justify-center' : 'justify-start';
  const footerJustify = sidebarCollapsed ? 'justify-center' : 'justify-start';

  return (
    <aside
      onClick={() => sidebarCollapsed && setSidebarCollapsed(false)}
      className={`fixed bottom-0 left-0 top-0 ${sidebarWidth} z-50 transform overflow-hidden border-r border-gray-200 bg-white transition-all duration-300 ease-in-out md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} ${sidebarCollapsed ? 'cursor-pointer hover:bg-gray-50/50' : ''} `}
    >
      <div className="flex h-full flex-col">
        {/* Sidebar Header */}
        <div className="flex h-16 items-center border-b border-gray-200">
          <div className={`flex min-w-0 items-center px-4 ${headerJustify} w-full overflow-hidden`}>
            <div className="flex w-[40px] shrink-0 justify-center">
              <LayoutDashboard className="h-6 w-6 shrink-0 text-gray-800" />
            </div>
            <span
              className={`ml-2 truncate text-xl font-bold text-gray-900 transition-all duration-300 ${sidebarCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}
            >
              Portfolio Admin
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="custom-scrollbar flex-1 overflow-y-auto py-4">
          {NAV_ITEMS.map((item) => renderNavItem(item))}
        </nav>

        {/* Sidebar Footer */}
        <div className={`space-y-1 border-t border-gray-200 p-4 ${footerJustify} overflow-hidden`}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push('/');
            }}
            className={`flex items-center rounded-lg text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900 ${sidebarCollapsed ? 'w-full justify-center' : 'w-full justify-start px-3 py-2'} `}
          >
            <div className="flex w-[40px] shrink-0 justify-center py-2">
              <Eye className="h-4 w-4 shrink-0" />
            </div>
            <span
              className={`overflow-hidden transition-all duration-300 ${sidebarCollapsed ? 'w-0 opacity-0' : 'ml-3 w-auto opacity-100'}`}
            >
              View Site
            </span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleLogout();
            }}
            className={`flex items-center rounded-lg text-sm font-medium text-red-600 transition-colors hover:bg-red-50 ${sidebarCollapsed ? 'w-full justify-center' : 'w-full justify-start px-3 py-2'} `}
          >
            <div className="flex w-[40px] shrink-0 justify-center py-2">
              <LogOut className="h-4 w-4 shrink-0" />
            </div>
            <span
              className={`overflow-hidden transition-all duration-300 ${sidebarCollapsed ? 'w-0 opacity-0' : 'ml-3 w-auto opacity-100'}`}
            >
              Log Out
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
};
