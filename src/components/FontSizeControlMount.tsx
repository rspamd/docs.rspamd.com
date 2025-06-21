import React, { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import FontSizeControl from './FontSizeControl';

const FontSizeControlMount: React.FC = () => {
  const mountedRef = useRef(false);

  useEffect(() => {
    if (mountedRef.current) return;

    const mountFontSizeControl = () => {
      const element = document.getElementById('font-size-control-mount');
      if (element && !mountedRef.current) {
        const root = createRoot(element);
        root.render(<FontSizeControl />);
        mountedRef.current = true;
      } else if (!element) {
        setTimeout(mountFontSizeControl, 100);
      }
    };

    mountFontSizeControl();
  }, []);

  return null;
};

export default FontSizeControlMount; 