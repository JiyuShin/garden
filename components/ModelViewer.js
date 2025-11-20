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
      // Map lookX [0,1] -> theta [-60deg, 60deg] (wider range for better control)
      const theta = (lookX - 0.5) * 120; // degrees
      // Keep phi and radius automatic; adjust only theta (azimuth)
      el.setAttribute('camera-orbit', `${theta.toFixed(2)}deg auto auto`);
    } catch (_) {
      // no-op
    }
  }, [lookX]);

  const mergedStyle = {
    width: 'min(90vw, 640px)',
    height: 'min(80vh, 640px)',
    background: 'transparent',
    willChange: 'transform',
    ...style,
  };

  return (
    <model-viewer
      ref={ref}
      src={src}
      alt="yflower 3D model"
      camera-controls
      autoplay
      ar
      exposure="1.2"
      shadow-intensity="0.5"
      max-pixel-ratio="2"
      interaction-prompt="none"
      style={mergedStyle}
    />
  );
}


