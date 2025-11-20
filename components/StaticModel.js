import { useEffect, useRef } from 'react';

export default function StaticModel({ src, style, cameraOrbit = '0deg 75deg auto' }) {
  const ref = useRef(null);
  
  useEffect(() => {
    const loadComponent = async () => {
      try {
        await import('@google/model-viewer');
      } catch (error) {
        // ignore import errors during SSR or transient network issues
      }
    };
    loadComponent();
  }, []);

  const mergedStyle = {
    width: '100%',
    height: '100%',
    background: 'transparent',
    ...style,
  };

  return (
    <model-viewer
      ref={ref}
      src={src}
      alt="3D model"
      camera-orbit={cameraOrbit}
      autoplay
      exposure="1"
      shadow-intensity="1"
      style={mergedStyle}
    />
  );
}

