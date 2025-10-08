import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';

const ModelViewer = dynamic(() => import('../components/ModelViewer'), {
  ssr: false,
});
const GrassStage = dynamic(() => import('../components/GrassStage'), {
  ssr: false,
});
const HandTrigger = dynamic(() => import('../components/HandTrigger'), {
  ssr: false,
});

export default function Home() {
  const [showFlower, setShowFlower] = useState(false);
  const [lookX, setLookX] = useState(0.5);
  const [basePinch, setBasePinch] = useState(null);
  const [scaleFactor, setScaleFactor] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 }); // displayed position
  const [targetOffset, setTargetOffset] = useState({ x: 0, y: 0 }); // desired position from gesture
  const offsetRef = useRef({ x: 0, y: 0 });
  const targetOffsetRef = useRef({ x: 0, y: 0 });
  const [lockCenter, setLockCenter] = useState(true);
  const [pointingActive, setPointingActive] = useState(false);
  const [armed, setArmed] = useState(false);
  const [pinchMode, setPinchMode] = useState(false);
  const lastPinchTsRef = useRef(0);

  // Animation/speed matching refs
  const rafRef = useRef(0);
  const lastTimeRef = useRef(0);
  const lastTargetRef = useRef({ x: 0, y: 0, t: 0 });
  const lastSpeedRef = useRef(0); // normalized units per second

  // Keep refs in sync with state (single source of truth for RAF loop)
  useEffect(() => {
    offsetRef.current = offset;
  }, [offset.x, offset.y]);
  useEffect(() => {
    targetOffsetRef.current = targetOffset;
  }, [targetOffset.x, targetOffset.y]);

  // Follow loop: move display offset toward target with speed tied to finger speed (single RAF loop)
  useEffect(() => {
    const loop = (ts) => {
      if (!lastTimeRef.current) lastTimeRef.current = ts;
      const dt = Math.max(0.001, (ts - lastTimeRef.current) / 1000);
      lastTimeRef.current = ts;

      // Compute desired step based on distance and recent finger speed
      const dx = targetOffsetRef.current.x - offsetRef.current.x;
      const dy = targetOffsetRef.current.y - offsetRef.current.y;
      const dist = Math.hypot(dx, dy);

      // Speed match: exponential smoothing toward target with speed tied to finger speed
      const baseSpeed = 0.8; // units/sec (normalized)
      const dyn = Math.min(3.0, lastSpeedRef.current * 1.2);
      const speed = baseSpeed + dyn; // higher when finger moves faster
      const rate = 1 - Math.exp(-speed * dt); // 0..1
      if (dist > 0.0005) {
        const nx = dx / (dist || 1);
        const ny = dy / (dist || 1);
        const step = dist * rate;
        // Update both state and ref to stay in sync
        const next = { x: offsetRef.current.x + nx * step, y: offsetRef.current.y + ny * step };
        offsetRef.current = next;
        setOffset(next);
      }

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);
  return (
    <main style={{minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif', position: 'relative'}}>
      {showFlower ? (
        <div style={{ position: 'absolute', zIndex: 999, top: '50%', left: '50%', transform: lockCenter ? `translate(-50%, -50%)` : `translate3d(calc(-50% + ${(offset.x * 150).toFixed(3)}vw), calc(-50% + ${(offset.y * 40).toFixed(3)}vh), 0)`, willChange: 'transform', pointerEvents: 'none' }}>
          <div style={{ transform: `scale(${scaleFactor})`, transformOrigin: 'center center' }}>
            <ModelViewer src="/yflower.glb" lookX={lookX} handActive />
          </div>
        </div>
      ) : null}
      <GrassStage />
      <HandTrigger preview={false} onMove={(x) => {
        // 이동 중에는 시선(lookX) 업데이트를 멈춰 크기 변화로 보이는 효과를 방지
        if (!armed || lockCenter) setLookX(x);
      }} onPinch={(dist) => {
        if (basePinch === null) {
          setBasePinch(dist);
          return;
        }
        const ratio = dist / (basePinch || 0.0001);
        const clamped = Math.max(0.5, Math.min(2.0, ratio));
        setScaleFactor(clamped);
        lastPinchTsRef.current = performance.now();
      }} onPoint={(x, y) => {
        // x,y already in [-1,1] (index tip relative to wrist, normalized)
        // Flip X to match mirrored webcam expectation; Y 그대로 사용
        const nx = -x;
        const ny = y;
        const clampX = (v) => Math.max(-0.9, Math.min(0.9, v));
        const clampY = (v) => Math.max(-0.3, Math.min(0.3, v));
        const now = performance.now();
        const suppressMs = 180; // ignore move shortly after pinch updates
        const suppress = now - (lastPinchTsRef.current || 0) < suppressMs;
        if (armed && pointingActive && !lockCenter && !pinchMode && !suppress) {
          const tx = clampX(nx);
          const ty = clampY(ny);
          // Update instantaneous finger speed for speed matching
          const now = performance.now();
          const last = lastTargetRef.current;
          if (last.t) {
            const dt = Math.max(0.001, (now - last.t) / 1000);
            const dv = Math.hypot(tx - last.x, ty - last.y);
            lastSpeedRef.current = dv / dt; // units/sec
          }
          lastTargetRef.current = { x: tx, y: ty, t: now };
          const nextTarget = { x: tx, y: ty };
          targetOffsetRef.current = nextTarget;
          setTargetOffset(nextTarget);
        }
      }} onDetect={(detected) => {
        if (detected && !showFlower) {
          // 최초 감지 시 중앙에서 시작
          const center = { x: 0, y: 0 };
          offsetRef.current = center;
          targetOffsetRef.current = center;
          setOffset(center);
          setTargetOffset(center);
          setShowFlower(true);
          setLockCenter(true);
        }
      }} onPointingChange={(active) => {
        setPointingActive(active);
      }} onArmedChange={(isArmed) => {
        setArmed(isArmed);
        if (isArmed && lockCenter) setLockCenter(false);
      }} onPinchModeChange={(active) => {
        setPinchMode(active);
      }} />
    </main>
  );
}


