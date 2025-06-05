import React from 'react';
import Layout from '@theme/Layout';
import Changelog from '../components/Changelog';

export default function ChangelogPage() {
  return (
    <Layout
      title="Changelog"
      description="View all changes and releases for this project"
    >
      <Changelog />
    </Layout>
  );
} 