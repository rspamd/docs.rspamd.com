import React from 'react';
import { SearchProvider } from '@site/src/plugins/elasticsearch-search/components/SearchProvider';

// Wrap the entire app with SearchProvider
export default function Root({children}) {
  return (
    <SearchProvider>
      {children}
    </SearchProvider>
  );
} 