import { useEffect, useRef } from 'react';

// Props: onDetect(boolean) => void, onMove(xNorm in [0,1]) => void, preview=false
export default function HandTrigger({ onDetect, onMove, preview = false }) {
  const videoRef = useRef(null);
  const rafRef = useRef(0);
  const landmarkerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function setup() {
      try {
        const vision = await import('@mediapipe/tasks-vision');
        const { FilesetResolver, HandLandmarker } = vision;
        const filesetResolver = await FilesetResolver.forVisionTasks(
          // CDN base. Using relative path for model file in public.
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );
        const handLandmarker = await HandLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: '/hand_landmarker.task',
          },
          runningMode: 'VIDEO',
          numHands: 1,
        });
        if (cancelled) return;
        landmarkerRef.current = handLandmarker;

        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
        if (cancelled) return;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const render = () => {
          if (!videoRef.current || !landmarkerRef.current) {
            rafRef.current = requestAnimationFrame(render);
            return;
          }
          const nowInMs = performance.now();
          const result = landmarkerRef.current.detectForVideo(videoRef.current, nowInMs);
          const detected = !!(result && result.handednesses && result.handednesses[0] && result.handednesses[0].length > 0);
          if (detected && result.landmarks && result.landmarks[0] && result.landmarks[0][0]) {
            // Use wrist or first landmark's x (range 0..videoWidth). Normalize to 0..1
            const x = result.landmarks[0][0].x; // already normalized 0..1 in Tasks API
            onMove?.(Math.min(1, Math.max(0, x)));
          }
          onDetect?.(detected);
          rafRef.current = requestAnimationFrame(render);
        };
        rafRef.current = requestAnimationFrame(render);
      } catch (e) {
        console.error(e);
        onDetect?.(false);
      }
    }
    setup();
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const v = videoRef.current;
      if (v && v.srcObject) {
        const tracks = v.srcObject.getTracks?.() || [];
        tracks.forEach(t => t.stop());
      }
    };
  }, [onDetect]);

  return (
    <video ref={videoRef} playsInline muted style={{ display: preview ? 'block' : 'none', position: 'fixed', right: 12, bottom: 12, width: 160, height: 120, borderRadius: 8, opacity: 0.2, pointerEvents: 'none' }} />
  );
}


