import React from 'react';
import Layout from '@theme-original/Layout';
import FontSizeControlMount from '../../components/FontSizeControlMount';

export default function LayoutWrapper(props: any): React.ReactElement {
  return (
    <>
      <Layout {...props} />
      <FontSizeControlMount />
    </>
  );
} 