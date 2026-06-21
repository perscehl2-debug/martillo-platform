'use client'
import { useRef, useEffect, useState, Suspense } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { Environment, ContactShadows, PerspectiveCamera, useGLTF } from '@react-three/drei'
import { EffectComposer, Bloom, ToneMapping } from '@react-three/postprocessing'
import * as THREE from 'three'
import { ProceduralCar } from './ProceduralCar'

// Tries to load /public/models/car.glb; falls back to ProceduralCar if missing
function CarModel({ scrollProgress }: { scrollProgress: number }) {
  const [hasGlb, setHasGlb] = useState(false)

  useEffect(() => {
    fetch('/models/car.glb', { method: 'HEAD' })
      .then(r => setHasGlb(r.ok))
      .catch(() => setHasGlb(false))
  }, [])

  if (!hasGlb) {
    return <ProceduralCar scrollProgress={scrollProgress} />
  }

  return (
    <Suspense fallback={<ProceduralCar scrollProgress={0} idleRotation={false} />}>
      <GlbCar scrollProgress={scrollProgress} />
    </Suspense>
  )
}

function GlbCar({ scrollProgress }: { scrollProgress: number }) {
  const { scene } = useGLTF('/models/car.glb')
  const groupRef = useRef<THREE.Group>(null)

  // Map named meshes by common part names and animate them
  useFrame(() => {
    if (!groupRef.current) return
    scene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return
      const name = obj.name.toLowerCase()

      const getT = (delay: number) => Math.max(0, scrollProgress - delay) * 8

      if (name.includes('door_l') || name.includes('door_fl')) {
        obj.position.z = getT(0.1)
        obj.position.y = getT(0.1) * 0.3
      } else if (name.includes('door_r') || name.includes('door_fr')) {
        obj.position.z = -getT(0.1)
        obj.position.y = getT(0.1) * 0.3
      } else if (name.includes('hood') || name.includes('bonnet')) {
        obj.position.z = getT(0.15) * 0.5
        obj.position.y = getT(0.15)
      } else if (name.includes('wheel_fl') || name.includes('tire_fl')) {
        obj.position.z = getT(0.08)
        obj.position.y = -getT(0.08) * 0.5
      } else if (name.includes('wheel_fr') || name.includes('tire_fr')) {
        obj.position.z = -getT(0.08)
        obj.position.y = -getT(0.08) * 0.5
      }

      // Fade out all parts at end
      if (obj.material instanceof THREE.MeshStandardMaterial) {
        obj.material.transparent = true
        obj.material.opacity = Math.max(0, 1 - Math.max(0, scrollProgress - 0.5) * 3)
      }
    })
  })

  return <primitive ref={groupRef} object={scene} />
}

// Camera movement: exterior orbit → moves through interior
function CinematicCamera({ scrollProgress }: { scrollProgress: number }) {
  const { camera } = useThree()

  useFrame(() => {
    const s = scrollProgress

    // Phase 1 (0–0.3): slight pull back + tilt
    if (s < 0.3) {
      const t = s / 0.3
      camera.position.set(
        THREE.MathUtils.lerp(5, 7, t),
        THREE.MathUtils.lerp(2.5, 3, t),
        THREE.MathUtils.lerp(8, 6, t)
      )
    }
    // Phase 2 (0.3–0.6): circle around the car
    else if (s < 0.6) {
      const t = (s - 0.3) / 0.3
      const angle = t * Math.PI * 0.5
      camera.position.set(
        Math.cos(angle) * 7,
        THREE.MathUtils.lerp(3, 2, t),
        Math.sin(angle) * 7
      )
    }
    // Phase 3 (0.6–1.0): fly through the car
    else {
      const t = (s - 0.6) / 0.4
      camera.position.set(
        THREE.MathUtils.lerp(0, 0, t),
        THREE.MathUtils.lerp(2, 0.5, t),
        THREE.MathUtils.lerp(5, -12, t)
      )
    }

    camera.lookAt(0, 0.5, 0)
  })

  return null
}

function SceneContent({ scrollProgress }: { scrollProgress: number }) {
  return (
    <>
      <CinematicCamera scrollProgress={scrollProgress} />

      <ambientLight intensity={0.2} />
      <directionalLight position={[5, 10, 5]} intensity={1.5} color='#ffffff' castShadow />
      <directionalLight position={[-5, 5, -5]} intensity={0.8} color='#c8902a' />
      <pointLight position={[0, 5, 0]} intensity={0.5} color='#4040ff' />
      <spotLight position={[0, 8, 4]} angle={0.4} penumbra={0.5} intensity={2} color='#ffffff' />

      <Suspense fallback={null}>
        <Environment preset="studio" background={false} />
      </Suspense>

      <Suspense fallback={<ProceduralCar scrollProgress={0} idleRotation={false} />}>
        <CarModel scrollProgress={scrollProgress} />
      </Suspense>

      <ContactShadows
        position={[0, -0.5, 0]}
        opacity={0.6}
        scale={12}
        blur={2.5}
        far={4}
        color='#000000'
      />

      <Suspense fallback={null}>
        <EffectComposer>
          <Bloom
            intensity={0.4}
            luminanceThreshold={0.8}
            luminanceSmoothing={0.2}
            mipmapBlur
          />
          <ToneMapping />
        </EffectComposer>
      </Suspense>
    </>
  )
}

// Mobile degradation detection
function isMobileLowEnd(): boolean {
  if (typeof window === 'undefined') return false
  const isMobile = /iPhone|Android/i.test(navigator.userAgent)
  const isLowCores = navigator.hardwareConcurrency !== undefined && navigator.hardwareConcurrency <= 4
  return isMobile && isLowCores
}

interface CarSceneProps {
  onScrollComplete?: () => void
}

export function CarScene({ onScrollComplete }: CarSceneProps) {
  const [scrollProgress, setScrollProgress] = useState(0)
  const [isMobile, setIsMobile] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const hasCompleted = useRef(false)

  useEffect(() => {
    setIsMobile(isMobileLowEnd())
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY
      const sceneHeight = window.innerHeight * 4 // 400vh scene
      const progress = Math.min(1, scrollY / sceneHeight)
      setScrollProgress(progress)

      if (progress >= 0.95 && !hasCompleted.current) {
        hasCompleted.current = true
        onScrollComplete?.()
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [onScrollComplete])

  // Fallback image for low-end mobile
  if (isMobile) {
    return (
      <div className="relative h-screen flex items-center justify-center bg-black">
        <img
          src="https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1200&q=85"
          alt="Martillo Remates"
          className="absolute inset-0 w-full h-full object-cover opacity-60"
        />
        <div className="relative z-10 text-center">
          <h1 className="text-4xl font-bold text-white">MARTILLO</h1>
          <p className="text-gold mt-2">Subastas Premium</p>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative" style={{ height: '500vh' }}>
      <div className="sticky top-0 h-screen overflow-hidden bg-black">
        <Canvas
          gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
          dpr={[1, 1.5]}
          shadows
          className="w-full h-full"
        >
          <color attach="background" args={['#050508']} />
          <fog attach="fog" args={['#050508', 20, 60]} />
          <PerspectiveCamera makeDefault position={[5, 2.5, 8]} fov={45} />
          <SceneContent scrollProgress={scrollProgress} />
        </Canvas>

        {/* HUD Overlay */}
        <div
          className="absolute inset-0 pointer-events-none flex flex-col items-center justify-end pb-16"
          style={{ opacity: Math.max(0, 1 - scrollProgress * 4) }}
        >
          <div className="text-center">
            <p className="text-xs tracking-[0.4em] text-gold/60 uppercase mb-3">Scroll para explorar</p>
            <div className="w-px h-12 bg-gradient-to-b from-gold/60 to-transparent mx-auto animate-pulse" />
          </div>
        </div>

        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 h-0.5 bg-gold/30 transition-all duration-100"
          style={{ width: `${scrollProgress * 100}%` }} />

        {/* Phase labels */}
        <div className="absolute top-8 left-8 pointer-events-none"
          style={{ opacity: Math.max(0, 1 - scrollProgress * 8) }}>
          <div className="text-5xl font-black text-white tracking-tighter">MARTILLO</div>
          <div className="text-sm tracking-[0.3em] text-gold uppercase mt-1">Plataforma de Remates Premium</div>
        </div>
      </div>
    </div>
  )
}
