/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'media.valorant-api.com', // Valorant resimleri buradan geliyor
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'grainy-gradients.vercel.app', // Arka plan efekti için
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;