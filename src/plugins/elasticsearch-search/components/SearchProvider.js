import React, { createContext, useContext, useReducer } from 'react';

// Search context
const SearchContext = createContext();

// Search reducer
const searchReducer = (state, action) => {
  switch (action.type) {
    case 'SET_QUERY':
      return { ...state, query: action.payload };
    case 'SET_RESULTS':
      return { ...state, results: action.payload, loading: false };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    case 'CLEAR_SEARCH':
      return { ...state, query: '', results: [], loading: false, error: null };
    default:
      return state;
  }
};

// Initial state
const initialState = {
  query: '',
  results: [],
  loading: false,
  error: null,
};

// Search provider component
export function SearchProvider({ children }) {
  const [state, dispatch] = useReducer(searchReducer, initialState);

  const performSearch = async (query) => {
    if (!query || query.length < 2) {
      dispatch({ type: 'CLEAR_SEARCH' });
      return;
    }

    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_QUERY', payload: query });

    try {
      // Get configuration with fallbacks
      const searchBackendConfig = window.SEARCH_BACKEND_CONFIG || {};
      const config = {
        endpoint: searchBackendConfig.endpoint || 'http://localhost:3001'
      };
      
      const response = await fetch(`${config.endpoint}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: {
            bool: {
              should: [
                {
                  multi_match: {
                    query: query,
                    fields: ['title^3', 'headings^2', 'content'],
                    type: 'best_fields',
                    fuzziness: 'AUTO',
                  },
                },
                {
                  wildcard: {
                    title: {
                      value: `*${query}*`,
                      boost: 2,
                    },
                  },
                },
              ],
            },
          },
          highlight: {
            fields: {
              title: {},
              content: {
                fragment_size: 150,
                number_of_fragments: 3,
              },
              headings: {},
            },
          },
          size: 20,
          _source: ['title', 'content', 'url', 'section', 'hierarchy'],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Search request failed');
      }

      const data = await response.json();
      const results = data.hits.hits.map((hit) => ({
        id: hit._id,
        title: hit._source.title,
        content: hit._source.content,
        url: hit._source.url,
        section: hit._source.section,
        hierarchy: hit._source.hierarchy,
        score: hit._score,
        highlights: hit.highlight,
      }));

      dispatch({ type: 'SET_RESULTS', payload: results });
    } catch (error) {
      console.error('Search error:', error);
      dispatch({ type: 'SET_ERROR', payload: error.message });
    }
  };

  const clearSearch = () => {
    dispatch({ type: 'CLEAR_SEARCH' });
  };

  // Set up global functions
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      window.performSearch = performSearch;
      window.clearSearch = clearSearch;
    }
  }, []);

  const value = {
    ...state,
    performSearch,
    clearSearch,
  };

  return (
    <SearchContext.Provider value={value}>
      {children}
    </SearchContext.Provider>
  );
}

// Custom hook to use search context
export function useSearch() {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearch must be used within a SearchProvider');
  }
  return context;
} 