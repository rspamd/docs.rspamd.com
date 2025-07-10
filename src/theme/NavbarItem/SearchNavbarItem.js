import React from 'react';
import { SearchBox } from '@site/src/plugins/elasticsearch-search/components/SearchBox';

export default function SearchNavbarItem({mobile, className}) {
  if (mobile) {
    return null;
  }
  return (
    <div className={className}>
      <SearchBox />
    </div>
  );
}
