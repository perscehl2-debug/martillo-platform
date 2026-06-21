'use client'
import { useEffect, useRef, useState } from 'react'

// Hero cinematográfico usando imágenes reales generadas con Kling AI
// Secuencia: auto cerrado → apertura → vista explosión → transición al contenido

const CAR_SEQUENCE = [
  { src: '/images/cars/car_rear.png',  label: 'Ferrari 458 Italia',    phase: 'closed' },
  { src: '/images/cars/car_1.png',     label: 'Luces traseras',         phase: 'lights' },
  { src: '/images/cars/car_2.png',     label: 'Vista lateral',          phase: 'side'   },
  { src: '/images/cars/car_3.png',     label: 'Ángulo trasero',         phase: 'rear'   },
  { src: '/images/cars/car_4.png',     label: 'Vista explosión',        phase: 'explode'},
]

interface KlingHeroProps {
  onScrollComplete?: () => void
}

export function KlingHero({ onScrollComplete }: KlingHeroProps) {
  const [scrollProgress, setScrollProgress] = useState(0)
  const [activeIdx, setActiveIdx] = useState(0)
  const [videoSrc, setVideoSrc] = useState<string | null>(null)
  const hasCompleted = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Check if Kling video exists
  useEffect(() => {
    fetch('/videos/cars/car_hero.mp4', { method: 'HEAD' })
      .then(r => { if (r.ok) setVideoSrc('/videos/cars/car_hero.mp4') })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const handler = () => {
      const sceneHeight = window.innerHeight * 4
      const progress = Math.min(1, window.scrollY / sceneHeight)
      setScrollProgress(progress)
      // Map scroll progress to image sequence
      const idx = Math.min(CAR_SEQUENCE.length - 1, Math.floor(progress * CAR_SEQUENCE.length))
      setActiveIdx(idx)
      if (progress >= 0.95 && !hasCompleted.current) {
        hasCompleted.current = true
        onScrollComplete?.()
      }
    }
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [onScrollComplete])

  const scale = 1 + scrollProgress * 0.15
  const opacity = activeIdx === CAR_SEQUENCE.length - 1
    ? Math.max(0, 1 - (scrollProgress - 0.8) * 5)
    : 1

  return (
    <div ref={containerRef} style={{ height: '500vh' }} className="relative">
      <div className="sticky top-0 h-screen overflow-hidden bg-black">

        {/* Video background (when Kling video is ready) */}
        {videoSrc && scrollProgress < 0.15 && (
          <video
            src={videoSrc}
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 w-full h-full object-cover opacity-90"
            style={{ transform: `scale(${scale})` }}
          />
        )}

        {/* Image sequence */}
        {CAR_SEQUENCE.map((frame, i) => (
          <div
            key={frame.src}
            className="absolute inset-0 transition-opacity"
            style={{
              opacity: i === activeIdx ? opacity : 0,
              transitionDuration: i === activeIdx ? '800ms' : '400ms',
              transitionTimingFunction: 'ease-in-out',
            }}
          >
            <img
              src={frame.src}
              alt={frame.label}
              className="w-full h-full object-cover"
              style={{
                transform: `scale(${i === activeIdx ? scale : 1})`,
                transition: 'transform 0.1s linear',
              }}
            />
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40" />
          </div>
        ))}

        {/* Particle overlay for the exploded view */}
        {activeIdx === CAR_SEQUENCE.length - 1 && (
          <div className="absolute inset-0 pointer-events-none">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="absolute w-1 h-1 rounded-full bg-amber-400"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  opacity: Math.random() * 0.6 + 0.2,
                  animation: `float-particle ${2 + Math.random() * 3}s ease-in-out infinite alternate`,
                  animationDelay: `${Math.random() * 2}s`,
                }}
              />
            ))}
          </div>
        )}

        {/* HUD - Headline */}
        <div
          className="absolute inset-0 flex flex-col justify-end pb-20 px-8 md:px-16 pointer-events-none"
          style={{ opacity: Math.max(0, 1 - scrollProgress * 3) }}
        >
          <div>
            <p className="text-xs tracking-[0.4em] text-amber-400/70 uppercase mb-3 font-mono">
              {CAR_SEQUENCE[activeIdx]?.label}
            </p>
            <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter leading-none mb-4">
              MARTILLO
            </h1>
            <p className="text-sm md:text-base text-gray-400 max-w-md">
              Plataforma de remates premium de automóviles y viviendas
            </p>
          </div>
        </div>

        {/* Phase indicator dots */}
        <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-2 pointer-events-none">
          {CAR_SEQUENCE.map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === activeIdx ? '8px' : '4px',
                height: i === activeIdx ? '8px' : '4px',
                background: i === activeIdx ? '#c8902a' : 'rgba(255,255,255,0.3)',
              }}
            />
          ))}
        </div>

        {/* Scroll indicator */}
        <div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none"
          style={{ opacity: Math.max(0, 1 - scrollProgress * 8) }}
        >
          <p className="text-[10px] tracking-[0.4em] text-amber-400/50 uppercase font-mono">Scroll</p>
          <div className="w-px h-8 bg-gradient-to-b from-amber-400/50 to-transparent animate-pulse" />
        </div>

        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 h-0.5 bg-amber-500/40 transition-all duration-100"
          style={{ width: `${scrollProgress * 100}%` }} />
      </div>

      <style>{`
        @keyframes float-particle {
          from { transform: translateY(0px) translateX(0px); opacity: 0.2; }
          to   { transform: translateY(-20px) translateX(10px); opacity: 0.7; }
        }
      `}</style>
    </div>
  )
}
