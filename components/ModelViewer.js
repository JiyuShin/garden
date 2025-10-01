import { useEffect, useRef } from 'react';

export default function ModelViewer({ src = '/yflower.glb', style, lookX = 0.5, handActive = false }) {
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

  // Update camera orbit based on horizontal hand position
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    try {
      // Map lookX [0,1] -> theta [-30deg, 30deg]
      const theta = (lookX - 0.5) * 60; // degrees
      // Keep phi and radius automatic; adjust only theta (azimuth)
      el.setAttribute('camera-orbit', `${theta.toFixed(2)}deg auto auto`);
      // Toggle auto-rotate depending on hand activity
      if (handActive && el.autoRotate) {
        el.autoRotate = false;
      } else if (!handActive && !el.autoRotate) {
        el.autoRotate = true;
      }
    } catch (_) {
      // no-op
    }
  }, [lookX, handActive]);

  const mergedStyle = {
    width: 'min(90vw, 640px)',
    height: 'min(80vh, 640px)',
    background: 'transparent',
    ...style,
  };

  return (
    <model-viewer
      ref={ref}
      src={src}
      alt="yflower 3D model"
      camera-controls
      auto-rotate
      autoplay
      ar
      exposure="1"
      shadow-intensity="1"
      style={mergedStyle}
    />
  );
}


