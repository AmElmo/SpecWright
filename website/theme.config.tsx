import React from 'react'
import { DocsThemeConfig } from 'nextra-theme-docs'

const config: DocsThemeConfig = {
  logo: <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>SpecWright</span>,
  project: {
    link: 'https://github.com/amelmo/specwright',
  },
  docsRepositoryBase: 'https://github.com/amelmo/specwright/tree/main/website',
  footer: {
    text: `SpecWright © ${new Date().getFullYear()}`,
  },
  useNextSeoProps() {
    return {
      titleTemplate: '%s – SpecWright',
    }
  },
  head: (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta
        name="description"
        content="SpecWright – AI-Powered Specification Engine for Specification-Driven Development"
      />
      <meta property="og:title" content="SpecWright" />
      <meta
        property="og:description"
        content="Transform Ideas into Specs with AI-Powered Specification-Driven Development"
      />
    </>
  ),
}

export default config
