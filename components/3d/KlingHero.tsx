'use client'
import { useEffect, useRef, useState } from 'react'

const CAR_SEQUENCE = [
  { src: '/images/cars/car_rear.png', label: 'Ferrari 458 Italia', sub: 'Subasta premium' },
  { src: '/images/cars/car_1.png',    label: 'Motor V8 4.5L',      sub: '570 CV — 0 a 100 en 3.4s' },
  { src: '/images/cars/car_2.png',    label: 'Diseño exclusivo',   sub: 'Pintura Nero Daytona' },
  { src: '/images/cars/car_3.png',    label: 'Cada detalle',       sub: 'Carrocería de carbono' },
  { src: '/images/cars/car_4.png',    label: 'Ingeniería pura',    sub: '247 piezas — 1 remate' },
]

const SCENE_HEIGHT = '800vh' // más tiempo de scroll

export function KlingHero() {
  const [scrollProgress, setScrollProgress] = useState(0)
  const [activeIdx, setActiveIdx]           = useState(0)
  const [revealed, setRevealed]             = useState(false)
  const [videoSrc, setVideoSrc]             = useState<string | null>(null)

  useEffect(() => {
    fetch('/videos/cars/car_hero.mp4', { method: 'HEAD' })
      .then(r => { if (r.ok) setVideoSrc('/videos/cars/car_hero.mp4') })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const vh = window.innerHeight
    const sceneH = vh * 8 // 800vh
    const handler = () => {
      const p = Math.min(1, window.scrollY / sceneH)
      setScrollProgress(p)
      const idx = Math.min(CAR_SEQUENCE.length - 1, Math.floor(p * CAR_SEQUENCE.length))
      setActiveIdx(idx)
      if (p >= 0.92 && !revealed) setRevealed(true)
    }
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [revealed])

  // Fade out the entire hero once revealed
  const heroOpacity = revealed
    ? Math.max(0, 1 - (scrollProgress - 0.92) * 12)
    : 1

  const scale = 1 + scrollProgress * 0.08

  return (
    <div style={{ height: SCENE_HEIGHT }} className="relative">
      <div
        className="sticky top-0 h-screen overflow-hidden bg-black"
        style={{ opacity: heroOpacity, transition: 'opacity 0.3s ease' }}
      >
        {/* Video loop on first phase */}
        {videoSrc && activeIdx === 0 && (
          <video autoPlay muted loop playsInline
            className="absolute inset-0 w-full h-full object-cover"
            style={{ transform: `scale(${scale})`, opacity: 0.95 }}
          />
        )}

        {/* Image sequence */}
        {CAR_SEQUENCE.map((frame, i) => (
          <div key={i} className="absolute inset-0 transition-opacity duration-700"
            style={{ opacity: i === activeIdx ? 1 : 0 }}>
            <img src={frame.src} alt={frame.label}
              className="w-full h-full object-cover"
              style={{ transform: `scale(${i === activeIdx ? scale : 1})`, transition: 'transform 0.15s linear' }} />
            <div className="absolute inset-0"
              style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.15) 50%, rgba(0,0,0,0.5) 100%)' }} />
          </div>
        ))}

        {/* Heading — fades out at 70% scroll */}
        <div className="absolute inset-0 flex flex-col justify-end pb-24 px-10 md:px-20 pointer-events-none"
          style={{ opacity: Math.max(0, 1 - scrollProgress * 2.5) }}>
          <p className="text-xs font-mono tracking-[0.5em] text-amber-400/70 uppercase mb-3">
            {CAR_SEQUENCE[activeIdx]?.sub}
          </p>
          <h1 className="text-6xl md:text-8xl font-black text-white tracking-tighter leading-none mb-3">
            MARTILLO
          </h1>
          <p className="text-base md:text-lg text-gray-400 max-w-lg font-light">
            Plataforma de remates premium de automóviles y viviendas
          </p>
        </div>

        {/* Car label — appears mid-scroll */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
          style={{ opacity: scrollProgress > 0.2 && scrollProgress < 0.85 ? Math.min(1, (scrollProgress - 0.2) * 4) : 0 }}>
          <p className="text-3xl md:text-5xl font-black text-white tracking-tight">{CAR_SEQUENCE[activeIdx]?.label}</p>
          <div className="w-12 h-0.5 bg-amber-400 mt-4 mx-auto" />
        </div>

        {/* Phase dots */}
        <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-3">
          {CAR_SEQUENCE.map((_, i) => (
            <div key={i} className="rounded-full transition-all duration-500"
              style={{ width: i === activeIdx ? 8 : 3, height: i === activeIdx ? 8 : 3,
                background: i === activeIdx ? '#c8902a' : 'rgba(255,255,255,0.3)' }} />
          ))}
        </div>

        {/* Scroll CTA */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          style={{ opacity: Math.max(0, 1 - scrollProgress * 10) }}>
          <span className="text-[10px] font-mono tracking-[0.4em] text-amber-400/50 uppercase">Scroll</span>
          <div className="w-px h-8 bg-gradient-to-b from-amber-400/50 to-transparent animate-pulse" />
        </div>

        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 h-0.5 bg-amber-500/50 transition-all duration-75"
          style={{ width: `${scrollProgress * 100}%` }} />

        {/* Reveal overlay — sweeps up at the end */}
        {scrollProgress > 0.88 && (
          <div className="absolute inset-0 bg-[#04060d]"
            style={{ opacity: Math.max(0, (scrollProgress - 0.88) * 8.3) }} />
        )}
      </div>
    </div>
  )
}
