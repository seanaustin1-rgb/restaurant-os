/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    outputFileTracingIncludes: {
      "/vault": ["./docs/spirit-vault/**"],
    },
  },
};

export default nextConfig;
