import { useState, useRef } from 'react';
import dynamic from 'next/dynamic';

const ModelViewer = dynamic(() => import('../components/ModelViewer'), {
  ssr: false,
});

const StaticModel = dynamic(() => import('../components/StaticModel'), {
  ssr: false,
});

const HandTrigger = dynamic(() => import('../components/HandTrigger'), {
  ssr: false,
});

export default function Home() {
  // 고정된 꽃들 배열 (화면에 계속 남아있음)
  const [fixedFlowers, setFixedFlowers] = useState([]);
  
  // 현재 작업 중인 꽃 (노란색 또는 흰색)
  const [currentFlower, setCurrentFlower] = useState(null); // { type: 'yellow' | 'white', position, scale, lookX }
  
  const [handDetected, setHandDetected] = useState(false);
  const [isArmed, setIsArmed] = useState(false);
  const [isPinchMode, setIsPinchMode] = useState(false);
  const [isPointing, setIsPointing] = useState(false);
  
  const lastMoveXRef = useRef(0.5);
  const flowerCountRef = useRef(0); // 꽃 개수 추적

  return (
    <main style={{
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      backgroundColor: '#000000',
      position: 'relative'
    }}>
      {/* 화면 하단 잔디 - 왼쪽 */}
      <div className="grass-container grass-container-1" style={{ 
        position: 'fixed', 
        bottom: '-680px', 
        left: '50%',
        width: '500vw',
        height: '150vh',
        pointerEvents: 'none',
      }}>
        <StaticModel src='/grasses5.glb' cameraOrbit='0deg 80deg auto' />
      </div>
      
      {/* 화면 하단 잔디 - 오른쪽 (좌우반전) */}
      <div className="grass-container grass-container-2" style={{ 
        position: 'fixed', 
        bottom: '-680px', 
        left: '50%',
        width: '500vw',
        height: '150vh',
        pointerEvents: 'none',
      }}>
        <StaticModel src='/grasses5.glb' cameraOrbit='0deg 80deg auto' />
      </div>
      
      {/* 긴 풀들 - 왼쪽 영역 */}
      <div className="grass-container grass-container-3" style={{ 
        position: 'fixed', 
        bottom: '-680px', 
        left: '50%',
        width: '500vw',
        height: '150vh',
        pointerEvents: 'none',
        opacity: 0.9,
      }}>
        <StaticModel src='/grasses5.glb' cameraOrbit='0deg 80deg auto' />
      </div>
      
      <div className="grass-container grass-container-4" style={{ 
        position: 'fixed', 
        bottom: '-660px', 
        left: '50%',
        width: '500vw',
        height: '150vh',
        pointerEvents: 'none',
        opacity: 0.85,
      }}>
        <StaticModel src='/grasses5.glb' cameraOrbit='0deg 80deg auto' />
      </div>
      
      {/* 긴 풀들 - 오른쪽 영역 */}
      <div className="grass-container grass-container-5" style={{ 
        position: 'fixed', 
        bottom: '-640px', 
        left: '50%',
        width: '500vw',
        height: '150vh',
        pointerEvents: 'none',
        opacity: 0.9,
      }}>
        <StaticModel src='/grasses5.glb' cameraOrbit='0deg 80deg auto' />
      </div>
      
      <div className="grass-container grass-container-6" style={{ 
        position: 'fixed', 
        bottom: '-670px', 
        left: '50%',
        width: '500vw',
        height: '150vh',
        pointerEvents: 'none',
        opacity: 0.8,
      }}>
        <StaticModel src='/grasses5.glb' cameraOrbit='0deg 80deg auto' />
      </div>
      
      {/* 중앙 긴 풀 */}
      <div className="grass-container grass-container-7" style={{ 
        position: 'fixed', 
        bottom: '-700px', 
        left: '50%',
        width: '500vw',
        height: '150vh',
        pointerEvents: 'none',
        opacity: 0.75,
      }}>
        <StaticModel src='/grasses5.glb' cameraOrbit='0deg 80deg auto' />
      </div>
      
      {/* 고정된 꽃들 */}
      {fixedFlowers.map((flower, index) => (
        <div key={index} style={{ 
          position: 'absolute', 
          top: '50%', 
          left: '50%', 
          transform: `translate(calc(-50% + ${flower.position.x}px), calc(-50% + 140px + ${flower.position.y}px)) scale(${flower.scale})`,
          transformOrigin: 'center center',
          willChange: 'transform',
          backfaceVisibility: 'hidden',
        }}>
          <ModelViewer 
            src={flower.type === 'yellow' ? '/yflower.glb' : '/whitef.glb'} 
            lookX={flower.lookX} 
            handActive={false} 
          />
        </div>
      ))}
      
      {/* 현재 작업 중인 꽃 */}
      {currentFlower && (
        <div style={{ 
          position: 'absolute', 
          top: '50%', 
          left: '50%', 
          transform: `translate(calc(-50% + ${currentFlower.position.x}px), calc(-50% + 140px + ${currentFlower.position.y}px)) scale(${currentFlower.scale})`,
          transformOrigin: 'center center',
          transition: isArmed ? 'transform 0.1s ease-out' : 'transform 0.2s ease-out',
          willChange: 'transform',
          backfaceVisibility: 'hidden',
        }}>
          <ModelViewer 
            src={currentFlower.type === 'yellow' ? '/yflower.glb' : '/whitef.glb'} 
            lookX={currentFlower.lookX} 
            handActive={handDetected} 
          />
        </div>
      )}
      
      <HandTrigger 
        preview={false}
        onDetect={(detected) => {
          setHandDetected(detected);
          
          // 현재 꽃이 없고 아무 모드도 아닐 때 새 꽃 생성
          if (detected && !currentFlower && !isPinchMode && !isArmed && !isPointing) {
            const flowerType = flowerCountRef.current % 2 === 0 ? 'yellow' : 'white';
            setCurrentFlower({
              type: flowerType,
              position: { x: 0, y: 0 },
              scale: 1,
              lookX: 0.5
            });
          }
        }}
        onMove={(xNorm) => {
          if (!currentFlower) return;
          
          const deltaX = (xNorm - lastMoveXRef.current) * -2000;
          
          if (isArmed) {
            // Armed 모드: 위치 이동 (더 스무스하게 - 작은 변화도 반영)
            if (Math.abs(deltaX) > 1) {
              setCurrentFlower(prev => ({
                ...prev,
                position: { x: prev.position.x + deltaX, y: prev.position.y }
              }));
            }
          } else {
            // 일반 모드: 시선 방향 제어
            if (Math.abs(xNorm - lastMoveXRef.current) > 0.005) {
              setCurrentFlower(prev => ({
                ...prev,
                lookX: xNorm
              }));
            }
          }
          lastMoveXRef.current = xNorm;
        }}
        onPinch={(distance) => {
          if (!currentFlower || isArmed) return;
          
          const minDist = 0.02;
          const maxDist = 0.5;
          const minScale = 0.3;
          const maxScale = 3.0;
          const normalized = Math.max(0, Math.min(1, (distance - minDist) / (maxDist - minDist)));
          const newScale = minScale + (maxScale - minScale) * normalized;
          
          setCurrentFlower(prev => ({
            ...prev,
            scale: newScale
          }));
        }}
        onArmedChange={(active) => {
          if (active && !isArmed) {
            console.log(`✊ Armed 모드 ON - 현재 꽃: ${currentFlower?.type || 'none'}`);
            setIsArmed(true);
          } else if (!active && isArmed && currentFlower) {
            // Armed 모드 해제 시 현재 꽃을 자동으로 고정
            console.log(`🔒 Armed OFF - ${currentFlower.type} 꽃 자동 고정! (꽃 #${flowerCountRef.current})`);
            
            // 고정된 꽃 배열에 추가
            setFixedFlowers(prev => [...prev, currentFlower]);
            
            // 꽃 카운트 증가
            flowerCountRef.current += 1;
            
            // 다음 꽃 타입 결정
            const nextFlowerType = currentFlower.type === 'yellow' ? 'white' : 'yellow';
            
            console.log(`✨ ${nextFlowerType} 꽃 자동 생성!`);
            
            // 즉시 다음 꽃을 중앙에 생성
            setCurrentFlower({
              type: nextFlowerType,
              position: { x: 0, y: 0 },
              scale: 1,
              lookX: 0.5
            });
            
            // 상태 초기화
            setIsArmed(false);
            setIsPointing(false);
          }
        }}
        onPinchModeChange={(active) => {
          if (active && !isArmed) {
            setIsPinchMode(true);
          } else if (!active) {
            setIsPinchMode(false);
          }
        }}
        onPointingChange={(active) => {
          // Armed가 아닐 때만 포인팅 상태 저장
          if (!isArmed) {
            setIsPointing(active);
          }
        }}
      />
    </main>
  );
}


