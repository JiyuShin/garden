import { useState } from 'react';
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
  return (
    <main style={{minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif', position: 'relative'}}>
      {showFlower ? <ModelViewer src="/yflower.glb" lookX={lookX} handActive /> : null}
      <GrassStage />
      <HandTrigger preview={false} onMove={(x) => {
        setLookX(x);
      }} onDetect={(detected) => {
        if (detected && !showFlower) setShowFlower(true);
      }} />
    </main>
  );
}


