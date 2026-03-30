import React from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import { marked } from 'marked';
import styles from './ChangelogReleasePage.module.css';

function getReleaseTypeInfo(type) {
  switch (type) {
    case 'major': return { color: '#e74c3c', icon: '\u{1F680}', label: 'Major Release' };
    case 'minor': return { color: '#3498db', icon: '\u2728', label: 'Feature Release' };
    case 'patch': return { color: '#27ae60', icon: '\u{1F41B}', label: 'Bug Fix Release' };
    default:      return { color: '#95a5a6', icon: '\u{1F4E6}', label: 'Release' };
  }
}

function getSectionStyle(section) {
  switch (section.toLowerCase()) {
    case 'breaking changes': return { color: '#dc3545', icon: '\u{1F4A5}' };
    case 'added':            return { color: '#27ae60', icon: '\u2705' };
    case 'changed':
    case 'improved':         return { color: '#3498db', icon: '\u{1F504}' };
    case 'fixed':            return { color: '#e67e22', icon: '\u{1F527}' };
    case 'security':         return { color: '#e74c3c', icon: '\u{1F6E1}\uFE0F' };
    case 'deprecated':       return { color: '#f39c12', icon: '\u26A0\uFE0F' };
    case 'removed':          return { color: '#95a5a6', icon: '\u274C' };
    default:                 return { color: '#7f8c8d', icon: '\u{1F4DD}' };
  }
}

function renderMarkdown(text) {
  marked.setOptions({ breaks: false, gfm: true });
  return marked.parse(text).replace(/^<p>|<\/p>\n?$/g, '');
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

export default function ChangelogReleasePage({ release }) {
  if (!release) return null;
  const typeInfo = getReleaseTypeInfo(release.type);

  return (
    <Layout
      title={`Rspamd ${release.version} — ${release.title}`}
      description={`Release notes for Rspamd ${release.version}: ${release.title}`}
    >
      <div className={styles.container}>
        <nav className={styles.backNav}>
          <Link to="/changelog">&larr; All releases</Link>
        </nav>

        <header className={styles.header}>
          <div className={styles.meta}>
            <span className={styles.badge} style={{ backgroundColor: typeInfo.color }}>
              {typeInfo.icon} {typeInfo.label}
            </span>
            <time className={styles.date}>{formatDate(release.date)}</time>
          </div>
          <h1 className={styles.version}>Rspamd {release.version}</h1>
          <p className={styles.title}>{release.title}</p>
        </header>

        <div className={styles.content}>
          {release.sections.map(section => {
            if (!section.items || section.items.length === 0) return null;
            const s = getSectionStyle(section.title);
            return (
              <section key={section.title} className={styles.section}>
                <h2 className={styles.sectionTitle} style={{ color: s.color }}>
                  <span>{s.icon}</span> {section.title}
                </h2>
                <ul className={styles.list}>
                  {section.items.map((item, i) => (
                    <li
                      key={i}
                      className={styles.item}
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(item) }}
                    />
                  ))}
                </ul>
              </section>
            );
          })}

          {release.summary && (
            <p className={styles.summary}>{release.summary}</p>
          )}
        </div>
      </div>
    </Layout>
  );
}
