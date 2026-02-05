import { useState, useRef, useCallback, useEffect } from 'react'
import { Canvas, useFrame, ThreeEvent } from '@react-three/fiber'
import { OrbitControls, Float, Environment, Stars } from '@react-three/drei'
import * as THREE from 'three'

// Gold nugget component
function GoldNugget({ position, onCollect, id }: { position: [number, number, number], onCollect: (id: number) => void, id: number }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const [collected, setCollected] = useState(false)
  const [scale, setScale] = useState(0)

  useFrame((state, delta) => {
    if (!collected) {
      meshRef.current.rotation.y += delta * 2
      meshRef.current.rotation.x += delta * 0.5
      // Grow in
      if (scale < 1) {
        setScale(Math.min(1, scale + delta * 3))
      }
    } else {
      // Fly up and shrink when collected
      meshRef.current.position.y += delta * 5
      setScale(Math.max(0, scale - delta * 3))
    }
  })

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (!collected) {
      setCollected(true)
      setTimeout(() => onCollect(id), 300)
    }
  }

  return (
    <Float speed={2} rotationIntensity={0.5} floatIntensity={0.3}>
      <mesh
        ref={meshRef}
        position={position}
        scale={scale * 0.3}
        onClick={handleClick}
        onPointerOver={() => document.body.style.cursor = 'pointer'}
        onPointerOut={() => document.body.style.cursor = 'auto'}
      >
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial
          color="#FFD700"
          metalness={0.9}
          roughness={0.1}
          emissive="#FF8C00"
          emissiveIntensity={0.3}
        />
      </mesh>
    </Float>
  )
}

// Dirt particle that flies out when digging
function DirtParticle({ position, velocity }: { position: THREE.Vector3, velocity: THREE.Vector3 }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const [opacity, setOpacity] = useState(1)

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.position.add(velocity.clone().multiplyScalar(delta))
      velocity.y -= delta * 15 // gravity
      setOpacity(Math.max(0, opacity - delta * 2))
    }
  })

  if (opacity <= 0) return null

  return (
    <mesh ref={meshRef} position={position} scale={0.08}>
      <boxGeometry />
      <meshStandardMaterial
        color={Math.random() > 0.5 ? "#8B4513" : "#654321"}
        transparent
        opacity={opacity}
      />
    </mesh>
  )
}

// Ground block that can be dug
function GroundBlock({
  position,
  depth,
  onDig,
  hasGold
}: {
  position: [number, number, number],
  depth: number,
  onDig: (pos: [number, number, number], hasGold: boolean) => void,
  hasGold: boolean
}) {
  const [dugLevel, setDugLevel] = useState(0)
  const meshRef = useRef<THREE.Mesh>(null!)
  const [hovered, setHovered] = useState(false)

  // Color based on depth
  const getColor = () => {
    if (depth < 2) return "#8B7355" // topsoil
    if (depth < 4) return "#654321" // brown dirt
    if (depth < 6) return "#4A3728" // dark earth
    return "#363636" // rock
  }

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (dugLevel < 3) {
      setDugLevel(dugLevel + 1)
      if (dugLevel === 2) {
        onDig(position, hasGold)
      }
    }
  }

  const scale = 1 - dugLevel * 0.25

  if (dugLevel >= 3) return null

  return (
    <mesh
      ref={meshRef}
      position={[position[0], position[1] - (1 - scale) * 0.5, position[2]]}
      scale={[1, scale, 1]}
      onClick={handleClick}
      onPointerOver={() => {
        setHovered(true)
        document.body.style.cursor = 'crosshair'
      }}
      onPointerOut={() => {
        setHovered(false)
        document.body.style.cursor = 'auto'
      }}
    >
      <boxGeometry args={[0.95, 0.95, 0.95]} />
      <meshStandardMaterial
        color={hovered ? "#A0522D" : getColor()}
        roughness={0.9}
        metalness={0.1}
      />
    </mesh>
  )
}

// Main game scene
function GameScene({
  onGoldCollect,
  onDig
}: {
  onGoldCollect: () => void,
  onDig: () => void
}) {
  const [blocks, setBlocks] = useState<Array<{
    pos: [number, number, number],
    id: string,
    hasGold: boolean,
    depth: number
  }>>([])
  const [nuggets, setNuggets] = useState<Array<{
    pos: [number, number, number],
    id: number
  }>>([])
  const [particles, setParticles] = useState<Array<{
    id: number,
    pos: THREE.Vector3,
    vel: THREE.Vector3
  }>>([])
  const nuggetIdRef = useRef(0)
  const particleIdRef = useRef(0)

  // Initialize grid
  useEffect(() => {
    const newBlocks: typeof blocks = []
    for (let x = -4; x <= 4; x++) {
      for (let y = -5; y <= 0; y++) {
        for (let z = -4; z <= 4; z++) {
          const depth = -y
          // Gold chance increases with depth
          const goldChance = depth * 0.03 + 0.02
          newBlocks.push({
            pos: [x, y, z],
            id: `${x}-${y}-${z}`,
            hasGold: Math.random() < goldChance,
            depth
          })
        }
      }
    }
    setBlocks(newBlocks)
  }, [])

  const handleDig = useCallback((pos: [number, number, number], hasGold: boolean) => {
    onDig()

    // Spawn particles
    const newParticles: typeof particles = []
    for (let i = 0; i < 8; i++) {
      newParticles.push({
        id: particleIdRef.current++,
        pos: new THREE.Vector3(pos[0], pos[1] + 0.5, pos[2]),
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 8,
          Math.random() * 6 + 2,
          (Math.random() - 0.5) * 8
        )
      })
    }
    setParticles(prev => [...prev, ...newParticles])

    // Remove block and maybe spawn gold
    setBlocks(prev => prev.filter(b => b.id !== `${pos[0]}-${pos[1]}-${pos[2]}`))

    if (hasGold) {
      setNuggets(prev => [...prev, {
        pos: [pos[0], pos[1] + 0.5, pos[2]],
        id: nuggetIdRef.current++
      }])
    }
  }, [onDig])

  const handleCollectGold = useCallback((id: number) => {
    setNuggets(prev => prev.filter(n => n.id !== id))
    onGoldCollect()
  }, [onGoldCollect])

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[10, 15, 10]}
        intensity={1.5}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <pointLight position={[-5, 5, -5]} intensity={0.5} color="#FFB347" />

      {/* Stars in background */}
      <Stars radius={100} depth={50} count={1000} factor={4} saturation={0} fade speed={1} />

      {/* Ground blocks */}
      {blocks.map(block => (
        <GroundBlock
          key={block.id}
          position={block.pos}
          depth={block.depth}
          onDig={handleDig}
          hasGold={block.hasGold}
        />
      ))}

      {/* Gold nuggets */}
      {nuggets.map(nugget => (
        <GoldNugget
          key={nugget.id}
          id={nugget.id}
          position={nugget.pos}
          onCollect={handleCollectGold}
        />
      ))}

      {/* Dirt particles */}
      {particles.map(particle => (
        <DirtParticle
          key={particle.id}
          position={particle.pos}
          velocity={particle.vel}
        />
      ))}

      {/* Environment */}
      <Environment preset="sunset" />

      {/* Camera controls */}
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={5}
        maxDistance={25}
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI / 2.2}
      />
    </>
  )
}

// Main App
export default function App() {
  const [gold, setGold] = useState(0)
  const [digs, setDigs] = useState(0)
  const [combo, setCombo] = useState(0)
  const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleGoldCollect = useCallback(() => {
    const bonus = Math.floor(combo / 3) + 1
    setGold(prev => prev + bonus)
    setCombo(prev => prev + 1)

    // Reset combo timer
    if (comboTimerRef.current) clearTimeout(comboTimerRef.current)
    comboTimerRef.current = setTimeout(() => setCombo(0), 2000)
  }, [combo])

  const handleDig = useCallback(() => {
    setDigs(prev => prev + 1)
  }, [])

  return (
    <div className="w-screen h-screen bg-gradient-to-b from-[#1a0f0a] via-[#2d1810] to-[#0d0705] overflow-hidden relative">
      {/* Noise overlay */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none z-10"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
        }}
      />

      {/* Header UI */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4 md:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-900/50">
              <span className="text-xl md:text-2xl">⛏️</span>
            </div>
            <div>
              <h1
                className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-200"
                style={{ fontFamily: "'Rye', serif" }}
              >
                GOLD RUSH
              </h1>
              <p
                className="text-amber-700/80 text-xs md:text-sm -mt-1"
                style={{ fontFamily: "'Crimson Text', serif" }}
              >
                Click to dig • Find the gold
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-3 md:gap-6">
            {/* Combo indicator */}
            {combo > 0 && (
              <div
                className="px-3 py-1 rounded-full bg-orange-500/30 border border-orange-400/50 animate-pulse"
                style={{ fontFamily: "'Crimson Text', serif" }}
              >
                <span className="text-orange-300 text-sm md:text-base">
                  🔥 x{combo} Combo!
                </span>
              </div>
            )}

            {/* Gold count */}
            <div
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-amber-900/60 to-amber-800/40 border border-amber-600/30 backdrop-blur-sm"
              style={{ fontFamily: "'Rye', serif" }}
            >
              <span className="text-2xl md:text-3xl">🪙</span>
              <span className="text-2xl md:text-3xl text-amber-300 font-bold">{gold}</span>
            </div>

            {/* Digs count */}
            <div
              className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg bg-stone-800/50 border border-stone-600/30 backdrop-blur-sm"
              style={{ fontFamily: "'Crimson Text', serif" }}
            >
              <span className="text-stone-400 text-sm">Digs:</span>
              <span className="text-stone-300 text-lg font-semibold">{digs}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Instructions overlay */}
      <div className="absolute left-4 md:left-6 bottom-16 md:bottom-20 z-20 max-w-xs">
        <div
          className="p-3 md:p-4 rounded-lg bg-stone-900/70 border border-stone-700/50 backdrop-blur-sm"
          style={{ fontFamily: "'Crimson Text', serif" }}
        >
          <p className="text-stone-300 text-sm md:text-base leading-relaxed">
            <span className="text-amber-400">Click blocks</span> to dig through layers.
            <br />
            <span className="text-yellow-400">Gold nuggets</span> appear in deeper layers!
            <br />
            <span className="text-orange-400">Collect quickly</span> for combo bonuses.
          </p>
        </div>
      </div>

      {/* Mobile dig counter */}
      <div
        className="sm:hidden absolute right-4 bottom-16 z-20 px-3 py-2 rounded-lg bg-stone-800/50 border border-stone-600/30 backdrop-blur-sm"
        style={{ fontFamily: "'Crimson Text', serif" }}
      >
        <span className="text-stone-400 text-xs">Digs: </span>
        <span className="text-stone-300 text-sm font-semibold">{digs}</span>
      </div>

      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [8, 8, 8], fov: 50 }}
        shadows
        className="w-full h-full"
      >
        <color attach="background" args={['#0d0705']} />
        <fog attach="fog" args={['#0d0705', 15, 40]} />
        <GameScene onGoldCollect={handleGoldCollect} onDig={handleDig} />
      </Canvas>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 z-20 p-3 text-center">
        <p
          className="text-stone-600 text-xs"
          style={{ fontFamily: "'Crimson Text', serif" }}
        >
          Requested by <span className="text-stone-500">@thoingu73733651</span> · Built by <span className="text-stone-500">@clonkbot</span>
        </p>
      </div>
    </div>
  )
}
