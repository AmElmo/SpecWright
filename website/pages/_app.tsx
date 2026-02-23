import type { AppProps } from 'next/app'
import Script from 'next/script'

export default function App({ Component, pageProps }: AppProps) {
  const umamiWebsiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID

  return (
    <>
      {umamiWebsiteId && (
        <Script
          src="/stats/script.js"
          data-website-id={umamiWebsiteId}
          strategy="afterInteractive"
        />
      )}
      <Component {...pageProps} />
    </>
  )
}
