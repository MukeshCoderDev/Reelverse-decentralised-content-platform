import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { HeaderBar } from '../header/HeaderBar';
import { Sidebar } from '../Sidebar';
import '../../../styles/theme.css';

interface AppShellProps {
  children: React.ReactNode;
}

/**
 * YouTube-style AppShell - Main layout component with light theme
 * Implements intelligent sidebar hiding on immersive routes
 * Features the new HeaderBar with SearchBar and ChipRow
 */
export function AppShell({ children }: AppShellProps) {
  const { pathname } = useLocation();
  const immersive = /^\/(watch|live)\/[^\/]+$/.test(pathname); // Hide sidebar on watch/live routes

  return (
    <div className="min-h-screen bg-bg text-text">
      {/* YouTube-style HeaderBar with search and chips */}
      <HeaderBar />
      
      <div className="flex">
        {/* Sidebar - hidden on immersive routes and mobile */}
        {!immersive && (
          <aside className="hidden md:block w-64 shrink-0">
            <Sidebar />
          </aside>
        )}
        
        {/* Main content area */}
        <main className={`flex-1 min-h-screen ${immersive ? 'px-0' : ''}`}>
          {children}
        </main>
      </div>
    </div>
  );
}