import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  env: {
    APP_INCOMING_WEBHOOK_HEADER_NAME: "X-TaskHook-Secret",
    APP_INCOMING_WEBHOOK_SECRET_VALUE: "your-secret-value",
  },
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
