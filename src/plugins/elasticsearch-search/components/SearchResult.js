import React from 'react';
import styles from './SearchResult.module.css';

export function SearchResult({ result, isSelected, onClick }) {
  const getHighlightedText = (text, highlights) => {
    if (!highlights || highlights.length === 0) {
      return text;
    }
    
    // For simplicity, we'll use the first highlight
    const highlight = highlights[0];
    return <span dangerouslySetInnerHTML={{ __html: highlight }} />;
  };

  const getExcerpt = (content, maxLength = 200) => {
    if (!content || content.length <= maxLength) {
      return content;
    }
    
    const excerpt = content.substring(0, maxLength);
    const lastSpace = excerpt.lastIndexOf(' ');
    return lastSpace > 0 ? excerpt.substring(0, lastSpace) + '...' : excerpt + '...';
  };

  const getSectionBadge = (section) => {
    const sectionColors = {
      'about': '#2563eb',
      'tutorials': '#059669',
      'modules': '#dc2626',
      'configuration': '#7c2d12',
      'developers': '#7c3aed',
      'other': '#374151',
      'blog': '#ea580c',
      'root': '#4b5563'
    };

    const color = sectionColors[section] || sectionColors.root;
    
    return (
      <span 
        className={styles.sectionBadge}
        style={{ backgroundColor: color }}
      >
        {section}
      </span>
    );
  };

  const handleClick = (event) => {
    event.preventDefault();
    onClick(result);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick(result);
    }
  };

  return (
    <div
      className={`${styles.searchResult} ${isSelected ? styles.selected : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`Go to ${result.title}`}
    >
      <div className={styles.resultHeader}>
        <div className={styles.resultTitle}>
          {result.highlights?.title ? (
            <span dangerouslySetInnerHTML={{ __html: result.highlights.title[0] }} />
          ) : (
            result.title
          )}
        </div>
        <div className={styles.resultMeta}>
          {getSectionBadge(result.section)}
          <span className={styles.resultUrl}>{result.url}</span>
        </div>
      </div>

      <div className={styles.resultContent}>
        {result.highlights?.content ? (
          <div className={styles.highlightedContent}>
            {result.highlights.content.map((highlight, index) => (
              <div key={index} className={styles.highlight}>
                <span dangerouslySetInnerHTML={{ __html: highlight }} />
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.excerpt}>
            {getExcerpt(result.content)}
          </div>
        )}
      </div>

      {result.hierarchy && result.hierarchy.length > 0 && (
        <div className={styles.breadcrumbs}>
          {result.hierarchy.map((item, index) => (
            <span key={index} className={styles.breadcrumb}>
              {item.title}
              {index < result.hierarchy.length - 1 && (
                <span className={styles.breadcrumbSeparator}>›</span>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
} 