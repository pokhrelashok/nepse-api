import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    ezstandalone: any;
  }
}

interface EzoicAdProps {
  placeholderId: number;
}

const EzoicAd = ({ placeholderId }: EzoicAdProps) => {
  const adRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.ezstandalone && adRef.current) {
      try {
        window.ezstandalone.cmd.push(function () {
          window.ezstandalone.define(placeholderId);
          window.ezstandalone.showAds(placeholderId);
        });
      } catch (error) {
        console.error('Ezoic ad error:', error);
      }
    }

    // Cleanup if needed? Ezoic docs don't specify explicit cleanup for destroy usually, 
    // but in SPAs we might need to be careful. For now, we just show.
  }, [placeholderId]);

  return (
    <div className="flex justify-center my-4 overflow-hidden">
      <div id={`ezoic-pub-ad-placeholder-${placeholderId}`} ref={adRef}></div>
    </div>
  );
};

export default EzoicAd;
