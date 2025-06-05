import React, { useState } from 'react';
import ChangelogEntry from './ChangelogEntry';
import styles from './Changelog.module.css';
import { changelogData } from '../data/changelogData';

function compareVersions(a, b) {
  const versionA = a.version.split('.').map(num => parseInt(num, 10));
  const versionB = b.version.split('.').map(num => parseInt(num, 10));
  
  for (let i = 0; i < 3; i++) {
    if (versionA[i] > versionB[i]) return -1;
    if (versionA[i] < versionB[i]) return 1;
  }
  return 0;
}

function getReleaseTypeInfo(type) {
  switch (type) {
    case 'major':
      return {
        color: '#e74c3c',
        icon: '🚀',
        label: 'Major Release',
        description: 'New features, breaking changes'
      };
    case 'minor':
      return {
        color: '#3498db',
        icon: '✨',
        label: 'Feature Release',
        description: 'New features, backward compatible'
      };
    case 'patch':
      return {
        color: '#27ae60',
        icon: '🐛',
        label: 'Bug Fix Release',
        description: 'Bug fixes, security patches'
      };
    default:
      return {
        color: '#95a5a6',
        icon: '📦',
        label: 'Release',
        description: 'General release'
      };
  }
}

export default function Changelog() {
  const [filter, setFilter] = useState('all');

  // Sort releases by version (newest first)
  const sortedReleases = [...changelogData].sort(compareVersions);

  const filteredReleases = sortedReleases.filter(release => 
    filter === 'all' || release.type === filter
  );

  const releaseTypes = ['all', 'major', 'minor', 'patch'];

  return (
    <div className={styles.changelog}>
      <div className={styles.header}>
        <h1>📋 Changelog</h1>
        <p className={styles.subtitle}>
          All notable changes to this project are documented here.
        </p>
      </div>

      <div className={styles.filters}>
        {releaseTypes.map(type => (
          <button
            key={type}
            className={`${styles.filterButton} ${filter === type ? styles.active : ''}`}
            onClick={() => setFilter(type)}
          >
            {type === 'all' ? '📦 All Releases' : `${getReleaseTypeInfo(type).icon} ${getReleaseTypeInfo(type).label}`}
          </button>
        ))}
      </div>

      <div className={styles.releases}>
        {filteredReleases.map((release) => (
          <ChangelogEntry
            key={release.version}
            release={release}
            typeInfo={getReleaseTypeInfo(release.type)}
          />
        ))}
      </div>

      {filteredReleases.length === 0 && (
        <div className={styles.noReleases}>
          No releases found for the selected filter.
        </div>
      )}
    </div>
  );
} 