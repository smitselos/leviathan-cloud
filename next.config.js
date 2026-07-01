/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        // Όταν μπαίνεις από το domain των μαθητών → κατευθείαν στη δημόσια σελίδα
        source: '/',
        has: [{ type: 'host', value: 'leviathan-class.vercel.app' }],
        destination: '/class',
        permanent: false,
      },
    ];
  },
};
module.exports = nextConfig;
