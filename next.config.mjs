/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
  // Needed for R3F/Three.js
  transpilePackages: ['three'],
  webpack: (config) => {
    config.externals.push({ canvas: 'canvas' })
    return config
  },
}

export default nextConfig
