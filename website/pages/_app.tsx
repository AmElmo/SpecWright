import type { AppProps } from 'next/app'
import Script from 'next/script'

export default function App({ Component, pageProps }: AppProps) {
  const umamiUrl = process.env.NEXT_PUBLIC_UMAMI_URL
  const umamiWebsiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID

  return (
    <>
      {umamiUrl && umamiWebsiteId && (
        <Script
          src={umamiUrl}
          data-website-id={umamiWebsiteId}
          strategy="afterInteractive"
        />
      )}
      <Component {...pageProps} />
    </>
  )
}
