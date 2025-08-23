import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface RedirectProps {
  to: string;
}

/**
 * Redirect component for handling legacy routes
 * Supports both normal routes and hash routes
 * Seamlessly redirects users from deprecated URLs to new locations
 */
export default function Redirect({ to }: RedirectProps) {
  const navigate = useNavigate();
  const location = useLocation();
  
  useEffect(() => {
    // Handle hash routes like /#/wallet or /#/buy-crypto
    const hash = window.location.hash.replace(/^#/, '');
    const path = location.pathname && location.pathname !== '/' ? location.pathname : hash;
    
    if (path) {
      // Replace instead of push to avoid back button issues
      navigate(to, { replace: true });
    }
  }, [navigate, location, to]);
  
  // Return null since this is just a redirect handler
  return null;
}