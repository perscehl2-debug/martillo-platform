'use client'
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Procedural placeholder car built from primitives.
// Replace with a real GLB by dropping car.glb in /public/models/ and using CarModel.tsx

interface CarPartProps {
  position: [number, number, number]
  rotation?: [number, number, number]
  scale?: [number, number, number]
  color?: string
  metalness?: number
  roughness?: number
  emissive?: string
  scrollProgress: number
  explodeVector: [number, number, number]
  explodeDelay?: number
  children?: React.ReactNode
}

function CarPart({
  position, rotation = [0,0,0], scale = [1,1,1],
  color = '#1a1a2e', metalness = 0.9, roughness = 0.1,
  emissive = '#000000', scrollProgress, explodeVector, explodeDelay = 0,
  children
}: CarPartProps) {
  const ref = useRef<THREE.Mesh>(null)
  const t = Math.max(0, scrollProgress - explodeDelay)

  const explodedX = position[0] + explodeVector[0] * t * 8
  const explodedY = position[1] + explodeVector[1] * t * 6
  const explodedZ = position[2] + explodeVector[2] * t * 8
  const rotX = rotation[0] + explodeVector[1] * t * Math.PI * 0.5
  const opacity = Math.max(0, 1 - t * 1.5)

  return (
    <mesh
      ref={ref}
      position={[explodedX, explodedY, explodedZ]}
      rotation={[rotX, rotation[1], rotation[2]]}
      scale={scale}
    >
      {children}
      <meshStandardMaterial
        color={color}
        metalness={metalness}
        roughness={roughness}
        emissive={emissive}
        transparent
        opacity={opacity}
      />
    </mesh>
  )
}

interface ProceduralCarProps {
  scrollProgress: number
  idleRotation?: boolean
}

export function ProceduralCar({ scrollProgress, idleRotation = true }: ProceduralCarProps) {
  const groupRef = useRef<THREE.Group>(null)

  // Idle rotation on the whole car (only when not scrolling)
  useFrame((_, delta) => {
    if (!groupRef.current) return
    if (scrollProgress < 0.05 && idleRotation) {
      groupRef.current.rotation.y += delta * 0.3
    }
  })

  const bodyColor = '#0d0d1a'
  const accentColor = '#c8902a'
  const glassColor = '#1a3a5c'
  const wheelColor = '#111111'
  const rimColor = '#888888'

  return (
    <group ref={groupRef}>
      {/* ── CHASSIS / UNDERBODY ── */}
      <CarPart position={[0, 0, 0]} scale={[3.6, 0.25, 1.7]}
        color='#0a0a0a' metalness={0.6} roughness={0.4}
        scrollProgress={scrollProgress} explodeVector={[0, -1, 0]} explodeDelay={0.6}>
        <boxGeometry args={[1, 1, 1]} />
      </CarPart>

      {/* ── BODY LOWER ── */}
      <CarPart position={[0, 0.35, 0]} scale={[3.4, 0.5, 1.6]}
        color={bodyColor} metalness={0.95} roughness={0.05}
        scrollProgress={scrollProgress} explodeVector={[0, -0.3, 0]} explodeDelay={0.5}>
        <boxGeometry args={[1, 1, 1]} />
      </CarPart>

      {/* ── ROOF / CABIN ── */}
      <CarPart position={[0.1, 0.95, 0]} scale={[1.8, 0.6, 1.4]}
        color={bodyColor} metalness={0.95} roughness={0.05}
        scrollProgress={scrollProgress} explodeVector={[0, 1, 0]} explodeDelay={0.3}>
        <boxGeometry args={[1, 1, 1]} />
      </CarPart>

      {/* ── HOOD ── */}
      <CarPart position={[1.5, 0.55, 0]} scale={[1.4, 0.18, 1.55]}
        color={bodyColor} metalness={0.95} roughness={0.05}
        scrollProgress={scrollProgress} explodeVector={[0.5, 1.2, 0]} explodeDelay={0.15}>
        <boxGeometry args={[1, 1, 1]} />
      </CarPart>

      {/* ── TRUNK ── */}
      <CarPart position={[-1.4, 0.55, 0]} scale={[1.2, 0.2, 1.55]}
        color={bodyColor} metalness={0.95} roughness={0.05}
        scrollProgress={scrollProgress} explodeVector={[-0.5, 0.8, 0]} explodeDelay={0.2}>
        <boxGeometry args={[1, 1, 1]} />
      </CarPart>

      {/* ── DOOR FRONT LEFT ── */}
      <CarPart position={[0.55, 0.5, 0.86]} scale={[1.1, 0.85, 0.06]}
        color={bodyColor} metalness={0.95} roughness={0.05}
        scrollProgress={scrollProgress} explodeVector={[0.1, 0.3, 1.2]} explodeDelay={0.1}>
        <boxGeometry args={[1, 1, 1]} />
      </CarPart>

      {/* ── DOOR FRONT RIGHT ── */}
      <CarPart position={[0.55, 0.5, -0.86]} scale={[1.1, 0.85, 0.06]}
        color={bodyColor} metalness={0.95} roughness={0.05}
        scrollProgress={scrollProgress} explodeVector={[0.1, 0.3, -1.2]} explodeDelay={0.1}>
        <boxGeometry args={[1, 1, 1]} />
      </CarPart>

      {/* ── DOOR REAR LEFT ── */}
      <CarPart position={[-0.55, 0.5, 0.86]} scale={[1.0, 0.85, 0.06]}
        color={bodyColor} metalness={0.95} roughness={0.05}
        scrollProgress={scrollProgress} explodeVector={[-0.1, 0.3, 1.2]} explodeDelay={0.12}>
        <boxGeometry args={[1, 1, 1]} />
      </CarPart>

      {/* ── DOOR REAR RIGHT ── */}
      <CarPart position={[-0.55, 0.5, -0.86]} scale={[1.0, 0.85, 0.06]}
        color={bodyColor} metalness={0.95} roughness={0.05}
        scrollProgress={scrollProgress} explodeVector={[-0.1, 0.3, -1.2]} explodeDelay={0.12}>
        <boxGeometry args={[1, 1, 1]} />
      </CarPart>

      {/* ── WINDSHIELD ── */}
      <CarPart position={[0.95, 0.88, 0]} scale={[0.06, 0.55, 1.35]}
        color={glassColor} metalness={0.1} roughness={0.0} emissive='#0a1a2a'
        scrollProgress={scrollProgress} explodeVector={[0.8, 1, 0]} explodeDelay={0.25}>
        <boxGeometry args={[1, 1, 1]} />
      </CarPart>

      {/* ── REAR WINDOW ── */}
      <CarPart position={[-0.75, 0.88, 0]} scale={[0.06, 0.5, 1.3]}
        color={glassColor} metalness={0.1} roughness={0.0} emissive='#0a1a2a'
        scrollProgress={scrollProgress} explodeVector={[-0.8, 1, 0]} explodeDelay={0.25}>
        <boxGeometry args={[1, 1, 1]} />
      </CarPart>

      {/* ── FRONT BUMPER ── */}
      <CarPart position={[1.85, 0.25, 0]} scale={[0.15, 0.35, 1.65]}
        color='#1a1a1a' metalness={0.5} roughness={0.5}
        scrollProgress={scrollProgress} explodeVector={[1.5, 0, 0]} explodeDelay={0.18}>
        <boxGeometry args={[1, 1, 1]} />
      </CarPart>

      {/* ── REAR BUMPER ── */}
      <CarPart position={[-1.85, 0.25, 0]} scale={[0.15, 0.35, 1.65]}
        color='#1a1a1a' metalness={0.5} roughness={0.5}
        scrollProgress={scrollProgress} explodeVector={[-1.5, 0, 0]} explodeDelay={0.18}>
        <boxGeometry args={[1, 1, 1]} />
      </CarPart>

      {/* ── HEADLIGHTS ── */}
      <CarPart position={[1.76, 0.42, 0.55]} scale={[0.12, 0.18, 0.4]}
        color='#ffffff' metalness={0.2} roughness={0.0} emissive='#fffbe0'
        scrollProgress={scrollProgress} explodeVector={[1.2, 0.5, 0.5]} explodeDelay={0.22}>
        <boxGeometry args={[1, 1, 1]} />
      </CarPart>
      <CarPart position={[1.76, 0.42, -0.55]} scale={[0.12, 0.18, 0.4]}
        color='#ffffff' metalness={0.2} roughness={0.0} emissive='#fffbe0'
        scrollProgress={scrollProgress} explodeVector={[1.2, 0.5, -0.5]} explodeDelay={0.22}>
        <boxGeometry args={[1, 1, 1]} />
      </CarPart>

      {/* ── TAILLIGHTS ── */}
      <CarPart position={[-1.76, 0.42, 0.55]} scale={[0.12, 0.18, 0.4]}
        color='#ff2200' metalness={0.2} roughness={0.0} emissive='#ff1100'
        scrollProgress={scrollProgress} explodeVector={[-1.2, 0.5, 0.5]} explodeDelay={0.22}>
        <boxGeometry args={[1, 1, 1]} />
      </CarPart>
      <CarPart position={[-1.76, 0.42, -0.55]} scale={[0.12, 0.18, 0.4]}
        color='#ff2200' metalness={0.2} roughness={0.0} emissive='#ff1100'
        scrollProgress={scrollProgress} explodeVector={[-1.2, 0.5, -0.5]} explodeDelay={0.22}>
        <boxGeometry args={[1, 1, 1]} />
      </CarPart>

      {/* ── ENGINE BLOCK ── */}
      <CarPart position={[1.3, 0.55, 0]} scale={[0.9, 0.55, 1.1]}
        color='#333333' metalness={0.7} roughness={0.3}
        scrollProgress={scrollProgress} explodeVector={[0.2, 1.5, 0]} explodeDelay={0.35}>
        <boxGeometry args={[1, 1, 1]} />
      </CarPart>

      {/* ── WHEEL FL ── */}
      <WheelAssembly
        position={[1.15, 0, 0.95]}
        scrollProgress={scrollProgress}
        explodeVector={[0.3, -0.5, 1]}
        delay={0.08}
        wheelColor={wheelColor}
        rimColor={rimColor}
      />
      {/* ── WHEEL FR ── */}
      <WheelAssembly
        position={[1.15, 0, -0.95]}
        scrollProgress={scrollProgress}
        explodeVector={[0.3, -0.5, -1]}
        delay={0.08}
        wheelColor={wheelColor}
        rimColor={rimColor}
      />
      {/* ── WHEEL RL ── */}
      <WheelAssembly
        position={[-1.15, 0, 0.95]}
        scrollProgress={scrollProgress}
        explodeVector={[-0.3, -0.5, 1]}
        delay={0.1}
        wheelColor={wheelColor}
        rimColor={rimColor}
      />
      {/* ── WHEEL RR ── */}
      <WheelAssembly
        position={[-1.15, 0, -0.95]}
        scrollProgress={scrollProgress}
        explodeVector={[-0.3, -0.5, -1]}
        delay={0.1}
        wheelColor={wheelColor}
        rimColor={rimColor}
      />

      {/* ── EXHAUST PIPES ── */}
      <CarPart position={[-1.7, 0.1, 0.5]} rotation={[0, 0, Math.PI/2]} scale={[0.08, 0.4, 0.08]}
        color={rimColor} metalness={0.9} roughness={0.1}
        scrollProgress={scrollProgress} explodeVector={[-1, -0.5, 0.5]} explodeDelay={0.28}>
        <cylinderGeometry args={[1, 1, 1, 8]} />
      </CarPart>
      <CarPart position={[-1.7, 0.1, 0.65]} rotation={[0, 0, Math.PI/2]} scale={[0.08, 0.4, 0.08]}
        color={rimColor} metalness={0.9} roughness={0.1}
        scrollProgress={scrollProgress} explodeVector={[-1, -0.5, 0.6]} explodeDelay={0.28}>
        <cylinderGeometry args={[1, 1, 1, 8]} />
      </CarPart>

      {/* ── GOLD ACCENT STRIPE ── */}
      <CarPart position={[0, 0.61, 0.82]} scale={[3.2, 0.04, 0.04]}
        color={accentColor} metalness={0.8} roughness={0.1} emissive='#c8902a'
        scrollProgress={scrollProgress} explodeVector={[0, 0, 1.5]} explodeDelay={0.4}>
        <boxGeometry args={[1, 1, 1]} />
      </CarPart>
      <CarPart position={[0, 0.61, -0.82]} scale={[3.2, 0.04, 0.04]}
        color={accentColor} metalness={0.8} roughness={0.1} emissive='#c8902a'
        scrollProgress={scrollProgress} explodeVector={[0, 0, -1.5]} explodeDelay={0.4}>
        <boxGeometry args={[1, 1, 1]} />
      </CarPart>
    </group>
  )
}

function WheelAssembly({ position, scrollProgress, explodeVector, delay, wheelColor, rimColor }: {
  position: [number, number, number]
  scrollProgress: number
  explodeVector: [number, number, number]
  delay: number
  wheelColor: string
  rimColor: string
}) {
  const t = Math.max(0, scrollProgress - delay)
  const ex = position[0] + explodeVector[0] * t * 8
  const ey = position[1] + explodeVector[1] * t * 6
  const ez = position[2] + explodeVector[2] * t * 8
  const opacity = Math.max(0, 1 - t * 1.5)

  return (
    <group position={[ex, ey, ez]}>
      {/* Tire */}
      <mesh rotation={[Math.PI/2, 0, 0]}>
        <torusGeometry args={[0.37, 0.16, 12, 24]} />
        <meshStandardMaterial color={wheelColor} metalness={0.1} roughness={0.9} transparent opacity={opacity} />
      </mesh>
      {/* Rim */}
      <mesh rotation={[Math.PI/2, 0, 0]}>
        <cylinderGeometry args={[0.22, 0.22, 0.12, 16]} />
        <meshStandardMaterial color={rimColor} metalness={0.9} roughness={0.1} transparent opacity={opacity} />
      </mesh>
      {/* Spokes */}
      {[0,1,2,3,4].map(i => (
        <mesh key={i} rotation={[Math.PI/2, 0, (i * Math.PI * 2) / 5]}>
          <boxGeometry args={[0.04, 0.38, 0.04]} />
          <meshStandardMaterial color={rimColor} metalness={0.9} roughness={0.1} transparent opacity={opacity} />
        </mesh>
      ))}
    </group>
  )
}
