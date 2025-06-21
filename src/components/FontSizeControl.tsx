import React, { useEffect, useState } from 'react';
import './FontSizeControl.css';

type FontSize = 'small' | 'medium' | 'large';

const FontSizeControl: React.FC = () => {
  const [fontSize, setFontSize] = useState<FontSize>('medium');

  useEffect(() => {
    // Load saved font size from localStorage
    const savedFontSize = (localStorage.getItem('rspamd-font-size') as FontSize) || 'medium';
    setFontSize(savedFontSize);
    document.documentElement.setAttribute('data-font-size', savedFontSize);
  }, []);

  const handleFontSizeChange = (size: FontSize) => {
    setFontSize(size);
    localStorage.setItem('rspamd-font-size', size);
    document.documentElement.setAttribute('data-font-size', size);
  };

  return (
    <div className="font-size-control">
      <div className="font-size-control__label">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M9 4v3h5v12h3V7h5V4H9zm-6 8h3v7h3v-7h3V9H3v3z"/>
        </svg>
      </div>
      <div className="font-size-control__buttons">
        <button
          className={`font-size-control__button ${fontSize === 'small' ? 'font-size-control__button--active' : ''}`}
          onClick={() => handleFontSizeChange('small')}
          title="Small font size"
          aria-label="Small font size"
        >
          A
        </button>
        <button
          className={`font-size-control__button ${fontSize === 'medium' ? 'font-size-control__button--active' : ''}`}
          onClick={() => handleFontSizeChange('medium')}
          title="Medium font size"
          aria-label="Medium font size"
        >
          A
        </button>
        <button
          className={`font-size-control__button ${fontSize === 'large' ? 'font-size-control__button--active' : ''}`}
          onClick={() => handleFontSizeChange('large')}
          title="Large font size"
          aria-label="Large font size"
        >
          A
        </button>
      </div>
    </div>
  );
};

export default FontSizeControl; 