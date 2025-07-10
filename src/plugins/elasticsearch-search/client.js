import React from 'react';

export function onRouteDidUpdate({ location, previousLocation }) {
  // Clear search on route change
  if (typeof window !== 'undefined' && window.clearSearch) {
    window.clearSearch();
  }
}

export function onRouteUpdate({ location, previousLocation }) {
  // Handle search parameter in URL
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(location.search);
    const searchQuery = urlParams.get('q');
    
    if (searchQuery && window.performSearch) {
      window.performSearch(searchQuery);
    }
  }
}

export default function Client() {
  React.useEffect(() => {
    // Initialize search functionality
    if (typeof window !== 'undefined') {
      const config = window.SEARCH_BACKEND_CONFIG || {};
      
      // Set up global search functions
      window.searchConfig = {
        endpoint: config.endpoint || 'http://localhost:3001',
        ...config
      };
    }
  }, []);

  return null;
} 