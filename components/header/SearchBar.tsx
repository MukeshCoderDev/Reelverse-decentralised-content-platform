import React, { useRef, useEffect, useState } from 'react'
import { Icon } from '@iconify/react'

/**
 * YouTube-style SearchBar Component
 * Features keyboard shortcuts, accessibility support, and autocomplete
 */
export function SearchBar() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [isAutocompleteOpen, setIsAutocompleteOpen] = useState(false)

  // Keyboard shortcuts: "/" to focus search, "Escape" to clear and blur
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Focus search with "/" key (like YouTube)
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && document.activeElement !== inputRef.current) {
        e.preventDefault()
        inputRef.current?.focus()
      }
      
      // Clear and blur with Escape
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        setQuery('')
        setIsAutocompleteOpen(false)
        inputRef.current?.blur()
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      // TODO: Navigate to search results
      console.log('Search for:', query)
      setIsAutocompleteOpen(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)
    setIsAutocompleteOpen(value.length > 0)
  }

  return (
    <form 
      role="search" 
      aria-label="Site search" 
      className="relative"
      onSubmit={handleSubmit}
    >
      <div className="flex items-center gap-0 rounded-full bg-surface border border-border shadow-sm hover:border-text-3 focus-within:border-brand transition-colors">
        {/* Search input */}
        <label htmlFor="site-search" className="sr-only">
          Search videos, creators, and playlists
        </label>
        <input 
          ref={inputRef}
          id="site-search"
          type="search"
          value={query}
          onChange={handleInputChange}
          className="w-full bg-transparent outline-none text-[14px] placeholder:text-text-3 text-text px-4 py-2 rounded-l-full" 
          placeholder="Search"
          aria-label="Search videos and creators"
          aria-describedby="search-help"
          aria-expanded={isAutocompleteOpen}
          aria-haspopup="listbox"
          aria-autocomplete="list"
        />
        
        {/* Search button */}
        <button 
          type="submit" 
          aria-label="Search" 
          className="text-text-2 hover:text-text min-h-[44px] min-w-[44px] flex items-center justify-center rounded-r-full hover:bg-hover transition-colors border-l border-border"
        >
          <Icon icon="material-symbols:search" className="text-[20px]" aria-hidden="true" />
        </button>
      </div>
      
      {/* Screen reader help text */}
      <div id="search-help" className="sr-only">
        Search across videos, creators, and playlists. Use slash key to focus.
      </div>
      
      {/* Autocomplete dropdown (placeholder for future implementation) */}
      {isAutocompleteOpen && query.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-lg shadow-md z-50">
          <ul role="listbox" aria-label="Search suggestions" className="py-2">
            <li 
              role="option" 
              className="px-4 py-2 hover:bg-hover cursor-pointer text-[14px] text-text"
              onClick={() => {
                setQuery(`${query} videos`)
                setIsAutocompleteOpen(false)
              }}
            >
              <Icon icon="material-symbols:search" className="inline mr-2 text-text-2" />
              {query} videos
            </li>
            <li 
              role="option" 
              className="px-4 py-2 hover:bg-hover cursor-pointer text-[14px] text-text"
              onClick={() => {
                setQuery(`${query} creators`)
                setIsAutocompleteOpen(false)
              }}
            >
              <Icon icon="material-symbols:person-outline" className="inline mr-2 text-text-2" />
              {query} creators
            </li>
          </ul>
        </div>
      )}
    </form>
  )
}