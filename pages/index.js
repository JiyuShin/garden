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
  const [lockCenter, setLockCenter] = useState(true);
  const [pointingActive, setPointingActive] = useState(false);
  const [armed, setArmed] = useState(false);

  // Animation/speed matching refs
  const rafRef = useRef(0);
  const lastTimeRef = useRef(0);
  const lastTargetRef = useRef({ x: 0, y: 0, t: 0 });
  const lastSpeedRef = useRef(0); // normalized units per second

  // Follow loop: move display offset toward target with speed tied to finger speed
  useEffect(() => {
    const loop = (ts) => {
      if (!lastTimeRef.current) lastTimeRef.current = ts;
      const dt = Math.max(0.001, (ts - lastTimeRef.current) / 1000);
      lastTimeRef.current = ts;

      // Compute desired step based on distance and recent finger speed
      const dx = targetOffset.x - offset.x;
      const dy = targetOffset.y - offset.y;
      const dist = Math.hypot(dx, dy);

      // Base follow speed and extra boost from recent finger speed
      const baseSpeed = 0.9; // units/sec (normalized space)
      const speed = baseSpeed + Math.min(2.5, lastSpeedRef.current * 0.8);
      const maxStep = speed * dt;

      if (dist > 0.0005) {
        const step = Math.min(dist, maxStep);
        const nx = dx / dist;
        const ny = dy / dist;
        setOffset((prev) => ({ x: prev.x + nx * step, y: prev.y + ny * step }));
      }

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [targetOffset.x, targetOffset.y, offset.x, offset.y]);
  return (
    <main style={{minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif', position: 'relative'}}>
      {showFlower ? (
        <div style={{ position: 'absolute', zIndex: 999, top: '50%', left: '50%', transform: lockCenter ? `translate(-50%, -50%) scale(${scaleFactor})` : `translate3d(calc(-50% + ${(offset.x * 150).toFixed(3)}vw), calc(-50% + ${(offset.y * 40).toFixed(3)}vh), 0) scale(${scaleFactor})`, willChange: 'transform', pointerEvents: 'none' }}>
          <ModelViewer src="/yflower.glb" lookX={lookX} handActive />
        </div>
      ) : null}
      <GrassStage />
      <HandTrigger preview={false} onMove={(x) => {
        setLookX(x);
      }} onPinch={(dist) => {
        if (basePinch === null) {
          setBasePinch(dist);
          return;
        }
        const ratio = dist / (basePinch || 0.0001);
        const clamped = Math.max(0.5, Math.min(2.0, ratio));
        setScaleFactor(clamped);
      }} onPoint={(x, y) => {
        // x,y already in [-1,1] (index tip relative to wrist, normalized)
        // Flip X to match mirrored webcam expectation; Y 그대로 사용
        const nx = -x;
        const ny = y;
        const clampX = (v) => Math.max(-0.9, Math.min(0.9, v));
        const clampY = (v) => Math.max(-0.3, Math.min(0.3, v));
        if (armed && pointingActive && !lockCenter) {
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
          setTargetOffset({ x: tx, y: ty });
        }
      }} onDetect={(detected) => {
        if (detected && !showFlower) {
          // 최초 감지 시 중앙에서 시작
          setOffset({ x: 0, y: 0 });
          setTargetOffset({ x: 0, y: 0 });
          setShowFlower(true);
          setLockCenter(true);
        }
      }} onPointingChange={(active) => {
        setPointingActive(active);
      }} onArmedChange={(isArmed) => {
        setArmed(isArmed);
        if (isArmed && lockCenter) setLockCenter(false);
      }} />
    </main>
  );
}


