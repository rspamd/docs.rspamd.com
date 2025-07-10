import React, { useState, useRef, useEffect } from 'react';
import { useSearch } from './SearchProvider';
import { SearchModal } from './SearchModal';

export function SearchBox() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const { performSearch, clearSearch } = useSearch();
  const inputRef = useRef(null);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Cmd/Ctrl + K to open search
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        setIsModalOpen(true);
      }
      
      // Escape to close search
      if (event.key === 'Escape' && isModalOpen) {
        setIsModalOpen(false);
        clearSearch();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, clearSearch]);

  const handleInputChange = (event) => {
    const value = event.target.value;
    setInputValue(value);
    
    if (value.length >= 2) {
      performSearch(value);
    } else {
      clearSearch();
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (inputValue.trim()) {
      performSearch(inputValue.trim());
      setIsModalOpen(true);
    }
  };

  const handleFocus = () => {
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setInputValue('');
    clearSearch();
  };

  return (
    <>
      <div className="elasticsearch-search-container">
        <form onSubmit={handleSubmit} className="elasticsearch-search-form">
          <div className="elasticsearch-search-input-container">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onFocus={handleFocus}
              placeholder="Search documentation..."
              className="elasticsearch-search-input"
              aria-label="Search documentation"
            />
            <div className="elasticsearch-search-shortcut">
              <span>⌘K</span>
            </div>
          </div>
        </form>
      </div>

      {isModalOpen && (
        <SearchModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          initialQuery={inputValue}
          onQueryChange={setInputValue}
        />
      )}
    </>
  );
} 