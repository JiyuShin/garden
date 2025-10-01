import { useEffect, useMemo } from 'react';

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
  const baseY = height - 10;

  const bladesData = useMemo(() => {
    const result = [];
    for (let i = 0; i < blades; i++) {
      const x = 30 + Math.random() * (width - 60);
      const h = 80 + Math.random() * 240;
      const curve = (Math.random() - 0.5) * 80;
      const swayAngleDeg = 2 + Math.random() * 6;
      const { path, length, swayAngle } = generateBladePath(x, baseY, h, curve, swayAngleDeg);
      const growDuration = (1.8 + Math.random() * 2.0).toFixed(2) + 's';
      const swayDuration = (2.5 + Math.random() * 2.5).toFixed(2) + 's';
      const delay = (Math.random() * 1.2).toFixed(2) + 's';
      result.push({ path, length, swayAngle, growDuration, swayDuration, delay });
    }
    return result.sort(() => Math.random() - 0.5);
  }, [width, height, blades]);

  useEffect(() => {}, []);

  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 1 }}>
      <div id="stage" aria-hidden>
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
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
        <div className="hud">
          <button onClick={() => window.location.reload()}>Regrow</button>
        </div>
      </div>
    </div>
  );
}


