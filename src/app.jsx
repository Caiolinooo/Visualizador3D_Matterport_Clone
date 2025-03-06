import React, { useState, useEffect, useRef } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, Sphere, useTexture, Html } from "@react-three/drei";
import * as THREE from 'three';
import "./styles.css";

// Componente de panorama 360°
function Panorama({ panoramaUrl }) {
  const texture = useTexture(panoramaUrl);
  
  return (
    <Sphere args={[90, 64, 32]} scale={[1, 1, -1]}>
      <meshBasicMaterial map={texture} side={THREE.BackSide} />
    </Sphere>
  );
}

// Componente para pontos de navegação entre cenas
function NavigationPoint({ position, name, onClick }) {
  const mesh = useRef();
  const [hovered, setHovered] = useState(false);
  
  // Efeito de hover
  useFrame(() => {
    if (mesh.current) {
      mesh.current.scale.x = mesh.current.scale.y = mesh.current.scale.z = 
        hovered ? 1.2 : 1;
    }
  });
  
  return (
    <group position={position}>
      <mesh
        ref={mesh}
        onClick={onClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshBasicMaterial color={hovered ? "#f39c12" : "#3498db"} transparent opacity={0.8} />
      </mesh>
      <Html position={[0, 0.5, 0]} center distanceFactor={10}>
        <div className="navigation-label">{name}</div>
      </Html>
    </group>
  );
}

// Componente para a planta baixa
function FloorPlan({ isVisible, imageUrl }) {
  if (!isVisible) return null;
  
  return (
    <div className="floor-plan">
      <img src={imageUrl} alt="Planta Baixa" />
    </div>
  );
}

// Componente principal da aplicação
function App() {
  const [scenes, setScenes] = useState([]);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showFloorPlan, setShowFloorPlan] = useState(false);
  const [measureMode, setMeasureMode] = useState(false);
  const [tagMode, setTagMode] = useState(false);
  const [dollhouseMode, setDollhouseMode] = useState(false);
  const [autoTourActive, setAutoTourActive] = useState(false);
  const autoTourRef = useRef(null);
  const controlsRef = useRef(null);

  // Carrega as cenas disponíveis
  useEffect(() => {
    setLoading(true);
    
    fetch("/api/matterport")
      .then((res) => res.json())
      .then((data) => {
        setScenes(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Erro ao carregar cenas:", err);
        setLoading(false);
      });
  }, []);

  // Controla o tour automático
  useEffect(() => {
    if (autoTourActive && scenes.length > 1) {
      autoTourRef.current = setInterval(() => {
        setCurrentSceneIndex((prevIndex) => (prevIndex + 1) % scenes.length);
      }, 10000); // 10 segundos por cena
    } else if (autoTourRef.current) {
      clearInterval(autoTourRef.current);
    }
    
    return () => {
      if (autoTourRef.current) {
        clearInterval(autoTourRef.current);
      }
    };
  }, [autoTourActive, scenes.length]);

  // Cena atual
  const currentScene = scenes[currentSceneIndex] || {};
  
  // Funcionalidades da UI
  const toggleFloorPlan = () => setShowFloorPlan(!showFloorPlan);
  const toggleMeasure = () => {
    setMeasureMode(!measureMode);
    if (tagMode) setTagMode(false); // Desabilita o modo tag quando ativa o modo de medição
  };
  const toggleTagMode = () => {
    setTagMode(!tagMode);
    if (measureMode) setMeasureMode(false); // Desabilita o modo de medição quando ativa o modo tag
  };
  const toggleDollhouse = () => setDollhouseMode(!dollhouseMode);
  const toggleAutoTour = () => setAutoTourActive(!autoTourActive);

  // Navegação para outra cena
  const navigateToScene = (index) => {
    setCurrentSceneIndex(index);
  };

  // Verifica se há uma panorâmica disponível
  const panoramaUrl = currentScene?.files?.panorama;
  
  // Verifica se há uma planta baixa disponível
  const floorPlanUrl = currentScene?.files?.floor_plan;

  // Componente para controlar a câmera
  const CameraController = () => {
    const { camera } = useThree();
    
    useEffect(() => {
      if (dollhouseMode && currentScene?.center) {
        // Posição da câmera para vista "dollhouse"
        const [x, y, z] = currentScene.center;
        camera.position.set(x, y + 15, z);
        camera.lookAt(x, y, z);
      } else {
        // Posição da câmera para vista normal
        if (currentScene?.center) {
          const [x, y, z] = currentScene.center;
          camera.position.set(x, y + 1.6, z);
          camera.lookAt(x, y, z - 1);
        }
      }
    }, [camera, dollhouseMode, currentScene]);
    
    return null;
  };

  // Componente para controlar o cursor
  const CursorController = () => {
    useEffect(() => {
      if (measureMode) {
        document.body.style.cursor = 'crosshair';
      } else if (tagMode) {
        document.body.style.cursor = 'cell';
      } else {
        document.body.style.cursor = 'grab';
      }
      
      return () => {
        document.body.style.cursor = 'auto';
      };
    }, [measureMode, tagMode]);
    
    return null;
  };

  return (
    <div className="visualizer-container">
      {/* Overlay de carregamento */}
      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
        </div>
      )}
      
      {/* Sidebar de navegação */}
      <div className="sidebar">
        <div className="sidebar-tab">≡</div>
        <h2>Visualizador 3D</h2>
        <div className="scenes-list">
          {scenes.map((scene, index) => (
            <div 
              key={scene.name}
              className={`scene-item ${index === currentSceneIndex ? 'active' : ''}`}
              onClick={() => navigateToScene(index)}
            >
              <h3>{scene.name}</h3>
              <p>Centro: {scene.center ? scene.center.map(c => Number(c).toFixed(2)).join(', ') : 'N/A'}</p>
            </div>
          ))}
        </div>
      </div>
      
      {/* Caixa de informações */}
      <div className="info-box">
        {currentScene?.name && `Cena atual: ${currentScene.name}`}
      </div>
      
      {/* Controles principais */}
      <div className="control-panel">
        <button 
          className={`btn ${dollhouseMode ? 'active' : ''}`} 
          onClick={toggleDollhouse}
          title="Vista Doll House"
        >
          🏠
        </button>
        <button 
          className={`btn ${showFloorPlan ? 'active' : ''}`} 
          onClick={toggleFloorPlan}
          title="Planta Baixa"
          disabled={!floorPlanUrl}
        >
          📐
        </button>
        <button 
          className={`btn ${measureMode ? 'active' : ''}`} 
          onClick={toggleMeasure}
          title="Medir"
        >
          📏
        </button>
        <button 
          className={`btn ${tagMode ? 'active' : ''}`} 
          onClick={toggleTagMode}
          title="Anotações"
        >
          🏷️
        </button>
        <button 
          className={`btn ${autoTourActive ? 'active' : ''}`} 
          onClick={toggleAutoTour}
          title="Tour Automático"
          disabled={scenes.length <= 1}
        >
          🔄
        </button>
      </div>
      
      {/* Visualizador 3D */}
      <div className="canvas-container">
        <Canvas>
          <CameraController />
          <CursorController />
          
          {/* Panorama */}
          {panoramaUrl && <Panorama panoramaUrl={panoramaUrl} />}
          
          {/* Pontos de navegação */}
          {scenes.map((scene, idx) => {
            if (idx !== currentSceneIndex && scene.center) {
              return (
                <NavigationPoint
                  key={scene.name}
                  position={scene.center}
                  name={scene.name}
                  onClick={() => navigateToScene(idx)}
                />
              );
            }
            return null;
          })}
          
          <OrbitControls 
            ref={controlsRef}
            enableDamping
            dampingFactor={0.05}
            minDistance={1}
            maxDistance={50}
          />
        </Canvas>
      </div>
      
      {/* Planta baixa */}
      {floorPlanUrl && <FloorPlan isVisible={showFloorPlan} imageUrl={floorPlanUrl} />}
      
      {/* Info de medição */}
      {measureMode && (
        <div className="measure-info">
          Clique para medir distâncias
        </div>
      )}
    </div>
  );
}

export default App;