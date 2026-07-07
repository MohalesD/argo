import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['pg', '@react-pdf/renderer'],
  // The shared src/lib modules use NodeNext-style './x.js' relative
  // imports (they also run under tsx/Node for scripts and evals).
  // Webpack needs the alias to resolve those to .ts sources.
  webpack: (config) => {
    config.resolve.extensionAlias = { '.js': ['.js', '.ts', '.tsx'] };
    return config;
  },
};

export default nextConfig;
