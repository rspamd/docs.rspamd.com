import React from 'react';
import styles from './RssLinks.module.css';

export default function RssLinks() {
  return (
    <div className={styles.rssLinks}>
      <a 
        href="/rss/changelog.xml" 
        className={styles.rssLink}
        title="Subscribe to Rspamd Releases RSS Feed"
        target="_blank"
        rel="noopener noreferrer"
      >
        <svg 
          className={styles.rssIcon} 
          xmlns="http://www.w3.org/2000/svg" 
          viewBox="0 0 24 24" 
          fill="currentColor"
        >
          <path d="M6.18 15.64a2.18 2.18 0 0 1 2.18 2.18C8.36 19 7.38 20 6.18 20C5 20 4 19 4 17.82a2.18 2.18 0 0 1 2.18-2.18M4 4.44A15.56 15.56 0 0 1 19.56 20h-2.83A12.73 12.73 0 0 0 4 7.27V4.44m0 5.66a9.9 9.9 0 0 1 9.9 9.9h-2.83A7.07 7.07 0 0 0 4 12.93V10.1z"/>
        </svg>
        Changelog RSS
      </a>
      <a 
        href="/blog/rss.xml" 
        className={styles.rssLink}
        title="Subscribe to Rspamd Blog RSS Feed"
        target="_blank"
        rel="noopener noreferrer"
      >
        <svg 
          className={styles.rssIcon} 
          xmlns="http://www.w3.org/2000/svg" 
          viewBox="0 0 24 24" 
          fill="currentColor"
        >
          <path d="M6.18 15.64a2.18 2.18 0 0 1 2.18 2.18C8.36 19 7.38 20 6.18 20C5 20 4 19 4 17.82a2.18 2.18 0 0 1 2.18-2.18M4 4.44A15.56 15.56 0 0 1 19.56 20h-2.83A12.73 12.73 0 0 0 4 7.27V4.44m0 5.66a9.9 9.9 0 0 1 9.9 9.9h-2.83A7.07 7.07 0 0 0 4 12.93V10.1z"/>
        </svg>
        Blog RSS
      </a>
      <a 
        href="/blog/atom.xml" 
        className={styles.rssLink}
        title="Subscribe to Rspamd Blog Atom Feed"
        target="_blank"
        rel="noopener noreferrer"
      >
        <svg 
          className={styles.rssIcon} 
          xmlns="http://www.w3.org/2000/svg" 
          viewBox="0 0 24 24" 
          fill="currentColor"
        >
          <path d="M6.18 15.64a2.18 2.18 0 0 1 2.18 2.18C8.36 19 7.38 20 6.18 20C5 20 4 19 4 17.82a2.18 2.18 0 0 1 2.18-2.18M4 4.44A15.56 15.56 0 0 1 19.56 20h-2.83A12.73 12.73 0 0 0 4 7.27V4.44m0 5.66a9.9 9.9 0 0 1 9.9 9.9h-2.83A7.07 7.07 0 0 0 4 12.93V10.1z"/>
        </svg>
        Blog Atom
      </a>
    </div>
  );
}

