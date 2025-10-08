import { useEffect, useMemo, useState } from 'react';

function generateBladePath(x, baseY, height, curve, swayAngleDeg) {
  const controlY = baseY - height * 0.6;
  const topY = baseY - height;
  const controlX = x + curve;
  const path = `M ${x} ${baseY} Q ${controlX} ${controlY} ${x} ${topY}`;
  const length = Math.hypot(curve, height) + height * 0.6; // rough length
  const swayAngle = `${swayAngleDeg}deg`;
  return { path, length, swayAngle };
}

export default function GrassStage({ width = 800, height = 600, blades = 80 }) {
  const [viewportWidth, setViewportWidth] = useState(null);
  useEffect(() => {
    const update = () => setViewportWidth(window.innerWidth || width);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [width]);

  const effectiveWidth = viewportWidth || width;
  const baseY = height - 10;

  const bladesData = useMemo(() => {
    const result = [];
    const w = effectiveWidth;
    // Ensure dense coverage: target spacing ~12px; include edges 0 and w
    const targetSpacing = 12;
    const minBlades = Math.max(blades, Math.floor(w / targetSpacing));
    const count = Math.max(minBlades, 60);
    const step = w / (count - 1);
    for (let i = 0; i < count; i++) {
      const jitter = (Math.random() - 0.5) * step * 0.4; // small jitter to avoid perfect grid
      let x = i * step + jitter;
      if (i === 0) x = 0; // left edge
      if (i === count - 1) x = w; // right edge
      if (x < 0) x = 0;
      if (x > w) x = w;
      const h = 120 + Math.random() * 220;
      const curve = (Math.random() - 0.5) * 70;
      const swayAngleDeg = 2 + Math.random() * 6;
      const { path, length, swayAngle } = generateBladePath(x, baseY, h, curve, swayAngleDeg);
      const growDuration = (1.8 + Math.random() * 2.0).toFixed(2) + 's';
      const swayDuration = (2.5 + Math.random() * 2.5).toFixed(2) + 's';
      const delay = (Math.random() * 1.2).toFixed(2) + 's';
      result.push({ path, length, swayAngle, growDuration, swayDuration, delay });
    }
    return result;
  }, [effectiveWidth, height, blades]);

  useEffect(() => {}, []);

  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 1 }}>
      <div id="stage" aria-hidden>
        <svg width={effectiveWidth} height={height} viewBox={`0 0 ${effectiveWidth} ${height}`}>
          {bladesData.map((b, idx) => (
            <g key={idx} className="grass-sway" style={{ '--angle': b.swayAngle, '--duration': b.swayDuration, '--delay': b.delay }}>
              <path
                className="grass-blade grass-grow"
                d={b.path}
                style={{ strokeDasharray: b.length, strokeDashoffset: b.length, '--path-length': b.length, '--growDuration': b.growDuration }}
              />
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}


