import React, { useState } from 'react';
import styles from './ChangelogEntry.module.css';

export default function ChangelogEntry({ release, typeInfo }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const renderChangeSection = (sectionName, items) => {
    if (!items || items.length === 0) return null;

    const getSectionStyle = (section) => {
      switch (section.toLowerCase()) {
        case 'breaking changes':
          return { color: '#dc3545', icon: '💥' };
        case 'added':
          return { color: '#27ae60', icon: '✅' };
        case 'changed':
        case 'improved':
          return { color: '#3498db', icon: '🔄' };
        case 'fixed':
          return { color: '#e67e22', icon: '🔧' };
        case 'security':
          return { color: '#e74c3c', icon: '🛡️' };
        case 'deprecated':
          return { color: '#f39c12', icon: '⚠️' };
        case 'removed':
          return { color: '#95a5a6', icon: '❌' };
        default:
          return { color: '#7f8c8d', icon: '📝' };
      }
    };

    const sectionStyle = getSectionStyle(sectionName);

    return (
      <div key={sectionName} className={styles.changeSection}>
        <h4 className={styles.sectionTitle} style={{ color: sectionStyle.color }}>
          <span className={styles.sectionIcon}>{sectionStyle.icon}</span>
          {sectionName}
        </h4>
        <ul className={styles.changeList}>
          {items.map((item, index) => (
            <li key={index} className={styles.changeItem}>
              {item}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div className={styles.releaseCard}>
      <div className={styles.releaseHeader} onClick={() => setIsExpanded(!isExpanded)}>
        <div className={styles.releaseInfo}>
          <div className={styles.versionSection}>
            <span 
              className={styles.releaseType} 
              style={{ backgroundColor: typeInfo.color }}
            >
              {typeInfo.icon} {typeInfo.label}
            </span>
            <h2 className={styles.version}>v{release.version}</h2>
            <span className={styles.date}>{formatDate(release.date)}</span>
          </div>
          <div className={styles.titleSection}>
            <h3 className={styles.title}>{release.title}</h3>
            <p className={styles.description}>{typeInfo.description}</p>
          </div>
        </div>
        <div className={styles.expandButton}>
          <span className={`${styles.arrow} ${isExpanded ? styles.expanded : ''}`}>
            ▼
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className={styles.releaseContent}>
          <div className={styles.changes}>
            {release.sections.map(section => 
              renderChangeSection(section.title, section.items)
            )}
          </div>
        </div>
      )}
    </div>
  );
} 