import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { SearchBar } from './SearchBar'
import { ChipRow } from './ChipRow'
import { HeaderActions } from './HeaderActions'

/**
 * YouTube-style HeaderBar Component
 * Features a clean white header with centered search and actions
 * Implements route-aware behavior for immersive routes
 */
export function HeaderBar() {
  const { pathname } = useLocation()
  const immersive = /^\/(watch|live)\/[^\/]+$/.test(pathname)

  return (
    <header className="sticky top-0 header-z">
      {/* Main header row */}
      <div
        className="w-full"
        style={{
          background: 'var(--header-bg)',
          borderBottom: '1px solid var(--header-border)',
          height: 'var(--header-h)',
        }}
      >
        <div className="mx-auto max-w-[1600px] h-full flex items-center gap-4 px-4">
          {/* Logo/Brand */}
          <Link 
            to="/" 
            className="text-[20px] font-semibold tracking-tight text-text hover:text-brand transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 rounded"
          >
            Reelverse
          </Link>
          
          {/* Centered search bar */}
          <div className="mx-auto w-full max-w-[720px]">
            <SearchBar />
          </div>
          
          {/* Right actions */}
          <div className="ml-auto">
            <HeaderActions />
          </div>
        </div>
      </div>
      
      {/* Chip row for category navigation - hidden on immersive routes */}
      {!immersive && <div className="chips-z"><ChipRow /></div>}
    </header>
  )
}