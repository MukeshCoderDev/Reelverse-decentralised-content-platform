import React from 'react';
import { Link } from 'react-router-dom';
import { CenterNav } from '../header/CenterNav';
import { HeaderActions } from '../header/HeaderActions';
import { Sidebar } from '../Sidebar';
import Icon from '../Icon';

interface AppShellProps {
  children: React.ReactNode;
}

/**
 * AppShell - Main layout component with single sticky header
 * Implements the design pattern where CenterNav is the only sticky element
 * Eliminates duplicate page titles and provides clean content hierarchy
 */
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex h-screen bg-slate-950">
      {/* Sidebar for desktop */}
      <div className="hidden md:block">
        <Sidebar />
      </div>
      
      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-screen bg-slate-950">
        {/* Top header bar - NOT sticky */}
        <header className="flex-shrink-0 h-16 bg-slate-950/95 backdrop-blur-sm border-b border-slate-800 flex items-center justify-between px-6">
          {/* Left: Brand/Logo */}
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-red-500 rounded-lg flex items-center justify-center">
                <Icon name="video" size={20} className="text-white" />
              </div>
              <span className="text-xl font-bold text-white">Reelverse</span>
            </Link>
          </div>
          
          {/* Center: Search (placeholder for future implementation) */}
          <div className="flex-1 max-w-xl mx-8">
            <div className="relative">
              <input
                type="text"
                placeholder="Search creators, content..."
                className="w-full px-4 py-2 pl-10 bg-slate-800 border border-slate-700 rounded-full text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
              <Icon name="search" size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            </div>
          </div>
          
          {/* Right: Actions */}
          <HeaderActions />
        </header>
        
        {/* CenterNav - Single sticky header */}
        <CenterNav />
        
        {/* Main content - starts immediately after CenterNav with proper spacing */}
        <main className="flex-1 px-4 md:px-6 lg:px-8 pb-10">
          {children}
        </main>
      </div>
    </div>
  );
}