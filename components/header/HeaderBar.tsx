import React from 'react'
import { Link } from 'react-router-dom'
import { SearchBar } from './SearchBar'
import { ChipRow } from './ChipRow'
import { HeaderActions } from './HeaderActions'

/**
 * YouTube-style HeaderBar Component
 * Features a clean white header with centered search and actions
 */
export function HeaderBar() {
  return (
    <header className="sticky top-0 z-50 bg-surface border-b border-border">
      {/* Main header row */}
      <div className="mx-auto max-w-container h-14 flex items-center gap-4 px-4">
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
      
      {/* Chip row for category navigation */}
      <ChipRow />
    </header>
  )
}