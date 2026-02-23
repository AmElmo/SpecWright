import nextra from 'nextra'

const withNextra = nextra({
  theme: 'nextra-theme-docs',
  themeConfig: './theme.config.tsx',
})

export default withNextra({
  async rewrites() {
    const umamiHost = process.env.NEXT_PUBLIC_UMAMI_HOST || 'cloud.umami.is'
    return [
      {
        source: '/stats/:path*',
        destination: `https://${umamiHost}/:path*`,
      },
    ]
  },
})
