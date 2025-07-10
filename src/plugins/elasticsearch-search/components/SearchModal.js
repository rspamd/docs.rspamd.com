import React, { useState, useEffect, useRef } from 'react';
import { useSearch } from './SearchProvider';
import { SearchResult } from './SearchResult';

export function SearchModal({ isOpen, onClose, initialQuery, onQueryChange }) {
  const [query, setQuery] = useState(initialQuery || '');
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const { results, loading, error, performSearch, clearSearch } = useSearch();
  const inputRef = useRef(null);
  const resultsRef = useRef(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
    }
  }, [initialQuery]);

  const handleInputChange = (event) => {
    const value = event.target.value;
    setQuery(value);
    onQueryChange(value);
    setSelectedIndex(-1);
    
    if (value.length >= 2) {
      performSearch(value);
    } else {
      clearSearch();
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      onClose();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((prev) => 
        prev < results.length - 1 ? prev + 1 : prev
      );
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((prev) => prev > 0 ? prev - 1 : -1);
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (selectedIndex >= 0 && results[selectedIndex]) {
        window.location.href = results[selectedIndex].url;
        onClose();
      }
    }
  };

  const handleResultClick = (result) => {
    window.location.href = result.url;
    onClose();
  };

  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="elasticsearch-modal-backdrop" onClick={handleBackdropClick}>
      <div className="elasticsearch-modal-container">
        <div className="elasticsearch-search-header">
          <div className="elasticsearch-search-input-container-modal">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Search documentation..."
              className="elasticsearch-search-input-modal"
              aria-label="Search documentation"
            />
            <button
              onClick={onClose}
              className="elasticsearch-close-button"
              aria-label="Close search"
            >
              ×
            </button>
          </div>
        </div>

        <div className="elasticsearch-search-body">
          {loading && (
            <div className="elasticsearch-loading-container">
              <div className="elasticsearch-loading-spinner" />
              <span>Searching...</span>
            </div>
          )}

          {error && (
            <div className="elasticsearch-error-container">
              <span>Error: {error}</span>
            </div>
          )}

          {!loading && !error && query && results.length === 0 && (
            <div className="elasticsearch-no-results-container">
              <span>No results found for "{query}"</span>
            </div>
          )}

          {!loading && !error && query && results.length > 0 && (
            <div className="elasticsearch-results-container" ref={resultsRef}>
              <div className="elasticsearch-results-header">
                <span>{results.length} result{results.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="elasticsearch-results-list">
                {results.map((result, index) => (
                  <SearchResult
                    key={result.id}
                    result={result}
                    isSelected={index === selectedIndex}
                    onClick={() => handleResultClick(result)}
                  />
                ))}
              </div>
            </div>
          )}

          {!query && (
            <div className="elasticsearch-empty-state-container">
              <div className="elasticsearch-empty-state">
                <h3>Search Documentation</h3>
                <p>Start typing to search through the documentation...</p>
                <div className="elasticsearch-search-tips">
                  <h4>Search Tips:</h4>
                  <ul>
                    <li>Use quotation marks for exact phrases</li>
                    <li>Try different keywords if you don't find what you're looking for</li>
                    <li>Use ⌘K (Mac) or Ctrl+K (Windows/Linux) to open search</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="elasticsearch-search-footer">
          <div className="elasticsearch-search-shortcuts">
            <span><kbd>↑</kbd><kbd>↓</kbd> to navigate</span>
            <span><kbd>Enter</kbd> to select</span>
            <span><kbd>Esc</kbd> to close</span>
          </div>
        </div>
      </div>
    </div>
  );
} 