import React, { useState } from 'react'

interface OptimizedImageProps {
  src: string
  alt: string
  className?: string
  sizes?: string
  priority?: boolean
  width?: number
  height?: number
}

/**
 * OptimizedImage Component
 * Provides better image loading with error handling and performance optimizations
 */
export function OptimizedImage({ 
  src, 
  alt, 
  className = '',
  sizes = "100vw",
  priority = false,
  width,
  height
}: OptimizedImageProps) {
  const [error, setError] = useState(false)
  const [loaded, setLoaded] = useState(false)
  
  // Fallback image URL
  const fallbackSrc = '/placeholder-video.jpg'
  
  return (
    <img
      src={error ? fallbackSrc : src}
      alt={alt}
      className={`${className} ${!loaded ? 'opacity-0' : 'opacity-100'} transition-opacity duration-200`}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      sizes={sizes}
      width={width}
      height={height}
      onLoad={() => setLoaded(true)}
      onError={() => setError(true)}
    />
  )
}