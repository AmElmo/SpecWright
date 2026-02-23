import Head from 'next/head'
import Image from 'next/image'
import Link from 'next/link'
import styles from '../styles/home.module.css'

export default function Home() {
  return (
    <div className={styles.page}>
      <Head>
        <title>SpecWright – AI-Powered Specification Engine</title>
        <meta
          name="description"
          content="Describe what you want to build. Get a full spec — requirements, designs, architecture, issues — ready for Claude Code, Codex, Cursor, or any AI coding tool."
        />
        <link rel="icon" href="/logo.png" />
      </Head>

      {/* Nav */}
      <nav className={styles.nav}>
        <Link href="/" className={styles.navLogo}>
          <Image src="/logo.png" alt="SpecWright" width={28} height={28} />
          <span>SpecWright</span>
        </Link>
        <div className={styles.navLinks}>
          <Link href="/docs">Documentation</Link>
          <a
            href="https://github.com/amelmo/specwright"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.ghLink}
          >
            <svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
          </a>
        </div>
      </nav>

      <main>
        {/* Hero */}
        <section className={styles.hero}>
          <div className={styles.badge}>
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            Open Source
          </div>
          <h1 className={styles.title}>
            <span className={styles.think}>Think it.</span>{' '}
            <span className={styles.spec}>Spec it.</span>{' '}
            <span className={styles.ship}>Ship it.</span>
          </h1>
          <p className={styles.subtitle}>
            Describe what you want to build. SpecWright generates the full spec — requirements,
            designs, architecture, and issues — ready for Claude Code, Codex, Cursor, or any AI
            coding tool.
          </p>
          <div className={styles.cta}>
            <div className={styles.installBlock}>
              <span className={styles.prompt}>$</span>
              <code>npx specwright</code>
            </div>
            <a
              href="https://github.com/amelmo/specwright"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.ghBtn}
            >
              <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
              View on GitHub
            </a>
          </div>
        </section>

        {/* Hero Screenshot */}
        <section className={styles.screenshotSection}>
          <div className={styles.screenshotWrap}>
            <Image
              src="/screenshots/issues_page.png"
              alt="SpecWright — Implementation issues board"
              width={1200}
              height={750}
              className={styles.screenshot}
              priority
            />
          </div>
        </section>

        {/* The Problem → Solution */}
        <section className={styles.problemSection}>
          <h2>Stop coding before you understand what you're building</h2>
          <p className={styles.problemSub}>
            Missed requirements. Forgotten edge cases. Rushed architecture. Tech debt from day one.
            <br />
            SpecWright fixes this with <strong>Specification-Driven Development</strong> — a full
            spec workflow that runs before you write a single line of code.
          </p>
        </section>

        {/* AI Squad */}
        <section className={styles.features}>
          <div className={styles.feature}>
            <div className={styles.featureIcon}>📋</div>
            <h3>Product Manager</h3>
            <p>
              Creates the PRD with job stories, acceptance criteria, and clear scope boundaries. No
              more guessing what to build.
            </p>
          </div>
          <div className={styles.feature}>
            <div className={styles.featureIcon}>🎨</div>
            <h3>Designer</h3>
            <p>
              Generates screen inventory, wireframes, and user flows. Every interaction mapped before
              implementation.
            </p>
          </div>
          <div className={styles.feature}>
            <div className={styles.featureIcon}>🔧</div>
            <h3>Engineer</h3>
            <p>
              Selects technologies, defines architecture, and documents trade-offs. Decisions made
              upfront, not mid-sprint.
            </p>
          </div>
          <div className={styles.feature}>
            <div className={styles.featureIcon}>📊</div>
            <h3>Issue Breakdown</h3>
            <p>
              Breaks work into vertical slices with clear acceptance criteria. Each issue is scoped,
              ordered, and ready to build.
            </p>
          </div>
        </section>

        {/* Second Screenshot */}
        <section className={styles.screenshotSection}>
          <div className={styles.screenshotWrap}>
            <Image
              src="/screenshots/screens_page.png"
              alt="SpecWright — Specification viewer with screen definitions"
              width={1200}
              height={750}
              className={styles.screenshot}
            />
          </div>
        </section>

        {/* How it works */}
        <section className={styles.workflow}>
          <h2>How it works</h2>
          <div className={styles.steps}>
            <div className={styles.step}>
              <div className={styles.stepNum}>1</div>
              <div>
                <strong>Describe what you want to build</strong>
                <p>In plain language. SpecWright figures out the scope automatically.</p>
              </div>
            </div>
            <div className={styles.step}>
              <div className={styles.stepNum}>2</div>
              <div>
                <strong>AI squad generates the full spec</strong>
                <p>
                  PM → Designer → Engineer → Issue Breakdown. Each phase builds on the last.
                  Structured outputs at every step.
                </p>
              </div>
            </div>
            <div className={styles.step}>
              <div className={styles.stepNum}>3</div>
              <div>
                <strong>Feed specs into your AI coding tool</strong>
                <p>
                  Automated prompts inject directly into Claude Code, Codex, Cursor, or any AI
                  coding tool. Context-aware, ready for implementation.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Highlights */}
        <section className={styles.highlights}>
          <div className={styles.highlight}>
            <h3>Smart Scoping</h3>
            <p>
              Not everything needs a spec. SpecWright analyzes your request and tells you when to
              just code it vs. when to spec it first.
            </p>
          </div>
          <div className={styles.highlight}>
            <h3>Web UI + CLI</h3>
            <p>
              Browse specs visually in the web interface or run everything from your terminal.
              Same engine, your workflow.
            </p>
          </div>
          <div className={styles.highlight}>
            <h3>Version-Controlled Specs</h3>
            <p>
              All output is structured Markdown and JSON in your repo. Review specs in PRs, track
              changes over time, no external tools.
            </p>
          </div>
        </section>

        {/* Final CTA */}
        <section className={styles.finalCta}>
          <h2>Ready to spec it?</h2>
          <div className={styles.cta}>
            <div className={styles.installBlock}>
              <span className={styles.prompt}>$</span>
              <code>npx specwright</code>
            </div>
            <a
              href="https://github.com/amelmo/specwright"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.docsBtn}
            >
              View on GitHub →
            </a>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <p>
          MIT License · Built by{' '}
          <a href="https://github.com/amelmo" target="_blank" rel="noopener noreferrer">
            AmElmo
          </a>
        </p>
      </footer>
    </div>
  )
}
