import React, { useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Sphere, useTexture } from "@react-three/drei";
import * as THREE from 'three';
import "./styles.css";

function Scene({ panoramaUrl }) {
  const texture = useTexture(panoramaUrl);
  return (
    <Sphere args={[500, 60, 40]} scale={[1, 1, -1]}>
      <meshBasicMaterial map={texture} side={THREE.BackSide} />
    </Sphere>
  );
}

function App() {
  const [scenes, setScenes] = useState([]);
  const [currentScene, setCurrentScene] = useState(null);

  useEffect(() => {
    fetch("/api/scenes") // Changed to the correct endpoint
      .then((res) => res.json())
      .then((data) => {
        setScenes(data);
        setCurrentScene(data[0]?.name);
      })
      .catch((err) => console.error("Erro ao carregar cenas:", err));
  }, []);

  const currentSceneData = scenes.find((s) => s.name === currentScene) || {};

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      {currentScene ? (
        <Canvas>
          <Scene panoramaUrl={currentSceneData.panorama} />
          <OrbitControls />
        </Canvas>
      ) : (
        <div>Carregando...</div>
      )}
    </div>
  );
}

export default App;
