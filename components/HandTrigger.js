import { useEffect, useRef } from 'react';

// Props: onDetect(boolean) => void, onMove(xNorm in [0,1]) => void, onPinch(pinchNorm) => void, onPoint(xNorm,yNorm) => void, onPointingChange(boolean) => void, onArmedChange(boolean) => void, onPinchModeChange(boolean) => void, preview=false
export default function HandTrigger({ onDetect, onMove, onPinch, onPoint, onPointingChange, onArmedChange, onPinchModeChange, preview = false }) {
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
  const detectingRef = useRef(false);
  const keepAliveTimerRef = useRef(0);
  const streamRef = useRef(null);
  const lastDetectedRef = useRef(false);

  const FRAME_INTERVAL_MS = 16; // ~60fps for more responsive pinch/point updates
  const SMOOTH_ALPHA = 0.25; // EMA smoothing factor
  const MIN_DELTA = 0.01; // minimal change to notify
  // Movement arming by FIST (전체 손 오므리기)
  const FIST_THRESHOLD = 0.20; // 손 전체 크기가 이 값보다 작으면 주먹/오므린 손 (더 쉽게 감지)
  const ARM_ON_FRAMES = 2; // 오므린 손 유지 프레임 수 (빠르게 반응)
  const armedRef = useRef(false);
  const armOnStreakRef = useRef(0);
  const emaFistRef = useRef(null); // 손 크기 smoothing
  // Pinch mode hysteresis (size control only during pinch mode)
  const PINCH_ON = 0.10; // easier to enter pinch so size reacts sooner
  const PINCH_OFF = 0.16; // exit a bit later to avoid flicker
  const pinchModeRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function setup() {
      try {
        // 카메라 권한을 먼저 요청
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 60, max: 60 } }, audio: false });
        if (cancelled) return;
        
        // 비디오 준비될 때까지 대기
        if (videoRef.current) {
          const video = videoRef.current;
          streamRef.current = stream;
          video.srcObject = stream;
          video.muted = true;
          video.playsInline = true;
          
          // loadedmetadata 이벤트 대기
          await new Promise((resolve) => {
            video.onloadedmetadata = () => {
              video.play().then(resolve).catch(() => resolve());
            };
          });
        }

        // 카메라 시작 후 MediaPipe 라이브러리 로드
        const vision = await import('@mediapipe/tasks-vision');
        const { FilesetResolver, HandLandmarker } = vision;
        
        const filesetResolver = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );
        
        const handLandmarker = await HandLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: `${typeof window !== 'undefined' ? window.location.origin : ''}/hand_landmarker.task`,
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          numHands: 1,
        });
        
        if (cancelled) return;
        landmarkerRef.current = handLandmarker;

        // Keep-alive: ensure video keeps playing and tracks are live
        const ensureLive = async () => {
          const v = videoRef.current;
          const s = streamRef.current;
          try {
            if (v && v.paused) await v.play();
            const tracks = s ? s.getVideoTracks?.() : [];
            const ended = tracks && tracks.some(t => t.readyState !== 'live');
            if (ended) {
              const ns = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 60, max: 60 } }, audio: false });
              if (videoRef.current) {
                videoRef.current.srcObject = ns;
                streamRef.current = ns;
                await videoRef.current.play();
              }
            }
          } catch (_) {
            // ignore transient errors
          }
        };
        keepAliveTimerRef.current = setInterval(ensureLive, 15000);

        let renderStarted = false;
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
          const v = videoRef.current;
          // Ensure the video is ready and has dimensions
          if (v.readyState < 2 || !v.videoWidth || !v.videoHeight || detectingRef.current) {
            rafRef.current = requestAnimationFrame(render);
            return;
          }
          
          if (!renderStarted) {
            renderStarted = true;
          }
          let result = null;
          try {
            detectingRef.current = true;
            result = landmarkerRef.current.detectForVideo(v, nowInMs);
          } catch (err) {
            // 감지 에러 무시
          } finally {
            detectingRef.current = false;
          }
          // Consider detection successful if landmarks are present (more robust than handedness presence)
          const detected = !!(result && result.landmarks && result.landmarks[0] && result.landmarks[0].length > 0);
          
          // 감지 상태 변화 추적
          if (detected && !lastDetectedRef.current) {
            lastDetectedRef.current = true;
          } else if (!detected && lastDetectedRef.current) {
            lastDetectedRef.current = false;
          }
          
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
              
              // 항상 핀치 거리를 전달 (부드러운 크기 조절을 위해)
              onPinch?.(dist);
              
              emaPinchRef.current = emaPinchRef.current == null ? dist : (SMOOTH_ALPHA * dist + (1 - SMOOTH_ALPHA) * emaPinchRef.current);
              // Pinch mode hysteresis (disabled while pointing)
              const wasMode = pinchModeRef.current;
              if (pointingActiveRef.current) {
                // While pointing, never be in pinch mode
                if (wasMode) {
                  pinchModeRef.current = false;
                  onPinchModeChange?.(false);
                }
              } else {
                if (!wasMode && emaPinchRef.current < PINCH_ON) {
                  pinchModeRef.current = true;
                  onPinchModeChange?.(true);
                } else if (wasMode && emaPinchRef.current > PINCH_OFF) {
                  pinchModeRef.current = false;
                  onPinchModeChange?.(false);
                }
              }
            }
            
            // Arm movement when FIST is detected (손 전체를 오므림)
            // 손목에서 모든 손가락 끝까지의 평균 거리로 손 크기 측정
            const wrist = result.landmarks[0][0];
            const thumbTip = result.landmarks[0][4];
            const indexTip = result.landmarks[0][8];
            const middleTip = result.landmarks[0][12];
            const ringTip = result.landmarks[0][16];
            const pinkyTip = result.landmarks[0][20];
            
            if (wrist && thumbTip && indexTip && middleTip && ringTip && pinkyTip) {
              const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
              const avgDist = (
                dist(wrist, thumbTip) +
                dist(wrist, indexTip) +
                dist(wrist, middleTip) +
                dist(wrist, ringTip) +
                dist(wrist, pinkyTip)
              ) / 5;
              
              emaFistRef.current = emaFistRef.current == null ? avgDist : (SMOOTH_ALPHA * avgDist + (1 - SMOOTH_ALPHA) * emaFistRef.current);
              
              if (!armedRef.current) {
                if (emaFistRef.current < FIST_THRESHOLD) {
                  armOnStreakRef.current += 1;
                  if (armOnStreakRef.current >= ARM_ON_FRAMES) {
                    armedRef.current = true;
                    onArmedChange?.(true);
                    console.log('✊✊✊ 손 오므림 - Armed ON, 손 크기:', emaFistRef.current.toFixed(3));
                  }
                } else {
                  armOnStreakRef.current = 0;
                }
              } else {
                // Armed 모드 해제: 손을 펼쳤을 때
                if (emaFistRef.current > FIST_THRESHOLD * 1.5) {
                  armedRef.current = false;
                  armOnStreakRef.current = 0;
                  onArmedChange?.(false);
                  console.log('✋ 손 펼침 - Armed OFF, 손 크기:', emaFistRef.current.toFixed(3));
                }
              }
            }
            // Pointing position using index tip (8) relative to wrist (0) for translation-invariant pointing
            // wrist, indexTip은 위에서 이미 선언됨
            const idxMcp = result.landmarks[0][5];
            const idxPip = result.landmarks[0][6];
            const idxDip = result.landmarks[0][7];
            if (wrist && indexTip && idxMcp && typeof wrist.x === 'number' && typeof indexTip.x === 'number' && typeof idxMcp.x === 'number') {
              // Relative vector from wrist to index tip
              const vx = indexTip.x - wrist.x;
              const vy = indexTip.y - wrist.y;
              // Normalize by hand scale (wrist->index_mcp distance)
              const sx = idxMcp.x - wrist.x;
              const sy = idxMcp.y - wrist.y;
              const scale = Math.max(0.05, Math.hypot(sx, sy));
              let rx = vx / scale;
              let ry = vy / scale;
              // Clamp to [-1, 1]
              rx = Math.max(-1, Math.min(1, rx));
              ry = Math.max(-1, Math.min(1, ry));
              // Index straightness: chord / path length across MCP->PIP->DIP->TIP
              let straight = 0;
              if (idxPip && idxDip) {
                const dist = (a,b) => Math.hypot((a.x-b.x),(a.y-b.y));
                const seg = dist(idxMcp, idxPip) + dist(idxPip, idxDip) + dist(idxDip, indexTip);
                const chord = dist(idxMcp, indexTip);
                if (seg > 1e-6) straight = chord / seg; // 0..1
              }
              // Magnitude threshold to avoid whole-hand small jitters
              const mag = Math.hypot(rx, ry);
              // Stricter hysteresis: require clearer pointing (straight index) to turn ON
              // ON when (mag > 0.35 && straight > 0.9) for 4 frames; OFF when (mag < 0.18 || straight < 0.75) for 6 frames
              if (mag > 0.35 && straight > 0.9) {
                pointingOnStreakRef.current += 1;
                pointingOffStreakRef.current = 0;
              } else if (mag < 0.18 || straight < 0.75) {
                pointingOffStreakRef.current += 1;
                pointingOnStreakRef.current = 0;
              } else {
                pointingOnStreakRef.current = 0;
                pointingOffStreakRef.current = 0;
              }
              const wasActive = pointingActiveRef.current;
              if (!wasActive && pointingOnStreakRef.current >= 4) {
                pointingActiveRef.current = true;
                onPointingChange?.(true);
                console.log('👉 포인팅 ON');
              } else if (wasActive && pointingOffStreakRef.current >= 6) {
                pointingActiveRef.current = false;
                onPointingChange?.(false);
                console.log('포인팅 OFF');
              }
              // Do not emit pointing updates while in pinch mode
              if (pointingActiveRef.current && !pinchModeRef.current) {
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
        console.error('HandTrigger 초기화 에러:', e);
        // 초기화 실패해도 계속 진행 시도
        onDetect?.(false);
      }
    }
    setup();
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (keepAliveTimerRef.current) clearInterval(keepAliveTimerRef.current);
      const v = videoRef.current;
      if (v && v.srcObject) {
        const tracks = v.srcObject.getTracks?.() || [];
        tracks.forEach(t => t.stop());
      }
    };
  }, [onDetect]);

  const hiddenStyle = preview
    ? { position: 'fixed', right: 12, bottom: 12, width: 160, height: 120, borderRadius: 8, opacity: 0.2, pointerEvents: 'none' }
    : { position: 'fixed', left: -9999, top: -9999, width: 1, height: 1, opacity: 0, pointerEvents: 'none' };

  return (
    <video ref={videoRef} playsInline muted style={hiddenStyle} />
  );
}



