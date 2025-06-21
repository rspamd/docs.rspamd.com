import React, { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import FontSizeControl from './FontSizeControl';

const FontSizeControlMount: React.FC = () => {
  const mountedRef = useRef(false);
  const rootRef = useRef<any>(null);

  useEffect(() => {
    const mountFontSizeControl = () => {
      const element = document.getElementById('font-size-control-mount');
      if (element && !element.hasChildNodes()) {
        // Clean up previous root if exists
        if (rootRef.current) {
          rootRef.current.unmount();
        }
        
        // Create new root and render
        rootRef.current = createRoot(element);
        rootRef.current.render(<FontSizeControl />);
        mountedRef.current = true;
      } else if (!element) {
        mountedRef.current = false;
        setTimeout(mountFontSizeControl, 100);
      }
    };

    const handleResize = () => {
      // Reset mounted state on resize to allow remounting if needed
      const element = document.getElementById('font-size-control-mount');
      if (!element || !element.hasChildNodes()) {
        mountedRef.current = false;
        setTimeout(mountFontSizeControl, 100);
      }
    };

    // Initial mount
    mountFontSizeControl();

    // Add resize listener
    window.addEventListener('resize', handleResize);
    
    // Also check periodically in case DOM changes without resize
    const interval = setInterval(() => {
      if (!mountedRef.current) {
        mountFontSizeControl();
      }
    }, 1000);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearInterval(interval);
      if (rootRef.current) {
        rootRef.current.unmount();
      }
    };
  }, []);

  return null;
};

export default FontSizeControlMount; 