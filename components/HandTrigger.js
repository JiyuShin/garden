import { useEffect, useRef } from 'react';

// Props: onDetect(boolean) => void, onMove(xNorm in [0,1]) => void, onPinch(pinchNorm) => void, onPoint(xNorm,yNorm) => void, onPointingChange(boolean) => void, onArmedChange(boolean) => void, preview=false
export default function HandTrigger({ onDetect, onMove, onPinch, onPoint, onPointingChange, onArmedChange, preview = false }) {
  const videoRef = useRef(null);
  const rafRef = useRef(0);
  const landmarkerRef = useRef(null);
  const lastTimeRef = useRef(0);
  const emaXRef = useRef(null); // for onMove (wrist x)
  const emaYRef = useRef(null); // reserved
  const emaPointXRef = useRef(null); // for onPoint (index vs wrist)
  const emaPointYRef = useRef(null);
  const emaPinchRef = useRef(null);
  const lastReportedMoveXRef = useRef(null);
  const lastReportedPointRef = useRef({ x: null, y: null });
  const lastReportedPinchRef = useRef(null);
  const pointingActiveRef = useRef(false);
  const pointingOnStreakRef = useRef(0);
  const pointingOffStreakRef = useRef(0);

  const FRAME_INTERVAL_MS = 33; // ~30fps
  const SMOOTH_ALPHA = 0.25; // EMA smoothing factor
  const MIN_DELTA = 0.01; // minimal change to notify
  // Movement arming by pinch-close (thumb-index together)
  const ARM_ON_DIST = 0.06; // normalized
  const ARM_ON_FRAMES = 10; // hold for consecutive frames
  const armedRef = useRef(false);
  const armOnStreakRef = useRef(0);

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

        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30, max: 30 } }, audio: false });
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
          if (nowInMs - lastTimeRef.current < FRAME_INTERVAL_MS) {
            rafRef.current = requestAnimationFrame(render);
            return;
          }
          lastTimeRef.current = nowInMs;
          const result = landmarkerRef.current.detectForVideo(videoRef.current, nowInMs);
          const detected = !!(result && result.handednesses && result.handednesses[0] && result.handednesses[0].length > 0);
          if (detected && result.landmarks && result.landmarks[0] && result.landmarks[0][0]) {
            // Use wrist or first landmark's x (range 0..videoWidth). Normalize to 0..1
            const x = result.landmarks[0][0].x; // already normalized 0..1 in Tasks API
            const nx = Math.min(1, Math.max(0, x));
            emaXRef.current = emaXRef.current == null ? nx : (SMOOTH_ALPHA * nx + (1 - SMOOTH_ALPHA) * emaXRef.current);
            if (lastReportedMoveXRef.current == null || Math.abs(emaXRef.current - lastReportedMoveXRef.current) > MIN_DELTA) {
              onMove?.(emaXRef.current);
              lastReportedMoveXRef.current = emaXRef.current;
            }
            // Pinch distance between thumb tip(4) and index tip(8)
            const thumb = result.landmarks[0][4];
            const index = result.landmarks[0][8];
            if (thumb && index && typeof thumb.x === 'number' && typeof index.x === 'number') {
              const dx = thumb.x - index.x;
              const dy = thumb.y - index.y;
              const dist = Math.sqrt(dx * dx + dy * dy); // normalized distance in 0..~1
              emaPinchRef.current = emaPinchRef.current == null ? dist : (SMOOTH_ALPHA * dist + (1 - SMOOTH_ALPHA) * emaPinchRef.current);
              if (lastReportedPinchRef.current == null || Math.abs(emaPinchRef.current - lastReportedPinchRef.current) > MIN_DELTA) {
                // Report pinch value; caller may ignore until armed
                onPinch?.(emaPinchRef.current);
                lastReportedPinchRef.current = emaPinchRef.current;
              }
              // Arm movement when pinch is held closed for ARM_ON_FRAMES
              if (!armedRef.current) {
                if (emaPinchRef.current < ARM_ON_DIST) {
                  armOnStreakRef.current += 1;
                  if (armOnStreakRef.current >= ARM_ON_FRAMES) {
                    armedRef.current = true;
                    onArmedChange?.(true);
                  }
                } else {
                  armOnStreakRef.current = 0;
                }
              }
            }
            // Pointing position using index tip (8) relative to wrist (0) for translation-invariant pointing
            const wrist = result.landmarks[0][0];
            const idxTip = index;
            const idxMcp = result.landmarks[0][5];
            if (wrist && idxTip && idxMcp && typeof wrist.x === 'number' && typeof idxTip.x === 'number' && typeof idxMcp.x === 'number') {
              // Relative vector from wrist to index tip
              const vx = idxTip.x - wrist.x;
              const vy = idxTip.y - wrist.y;
              // Normalize by hand scale (wrist->index_mcp distance)
              const sx = idxMcp.x - wrist.x;
              const sy = idxMcp.y - wrist.y;
              const scale = Math.max(0.05, Math.hypot(sx, sy));
              let rx = vx / scale;
              let ry = vy / scale;
              // Clamp to [-1, 1]
              rx = Math.max(-1, Math.min(1, rx));
              ry = Math.max(-1, Math.min(1, ry));
              // Magnitude threshold to avoid whole-hand small jitters
              const mag = Math.hypot(rx, ry);
              // Hysteresis: turn ON when mag > 0.22 for 3 frames; turn OFF when mag < 0.12 for 5 frames
              if (mag > 0.22) {
                pointingOnStreakRef.current += 1;
                pointingOffStreakRef.current = 0;
              } else if (mag < 0.12) {
                pointingOffStreakRef.current += 1;
                pointingOnStreakRef.current = 0;
              } else {
                pointingOnStreakRef.current = 0;
                pointingOffStreakRef.current = 0;
              }
              const wasActive = pointingActiveRef.current;
              if (!wasActive && pointingOnStreakRef.current >= 3) {
                pointingActiveRef.current = true;
                onPointingChange?.(true);
              } else if (wasActive && pointingOffStreakRef.current >= 5) {
                pointingActiveRef.current = false;
                onPointingChange?.(false);
              }
              if (pointingActiveRef.current) {
                emaPointXRef.current = emaPointXRef.current == null ? rx : (SMOOTH_ALPHA * rx + (1 - SMOOTH_ALPHA) * emaPointXRef.current);
                emaPointYRef.current = emaPointYRef.current == null ? ry : (SMOOTH_ALPHA * ry + (1 - SMOOTH_ALPHA) * emaPointYRef.current);
                const smx = emaPointXRef.current;
                const smy = emaPointYRef.current;
                const lr = lastReportedPointRef.current;
                if (lr.x == null || lr.y == null || Math.abs(smx - lr.x) > MIN_DELTA || Math.abs(smy - lr.y) > MIN_DELTA) {
                  onPoint?.(smx, smy);
                  lastReportedPointRef.current = { x: smx, y: smy };
                }
              }
            }
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


