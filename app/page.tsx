import { SiteHeader, Brand } from "@/components/board/site-header";
import { ToolList } from "@/components/board/tool-list";
import { LendingWorkspace } from "@/components/board/lending-workspace";

const steps = [
  {
    number: "01",
    title: "Find a tool",
    text: "See what your neighbors are sharing.",
  },
  {
    number: "02",
    title: "Make a request",
    text: "Choose the dates that work for you.",
  },
  {
    number: "03",
    title: "Pass it along",
    text: "Use what you need, then return it.",
  },
];

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main-content" tabIndex={-1}>
        <section className="hero shell" aria-labelledby="hero-heading">
          <div className="hero__copy">
            <p className="eyebrow">
              <span className="eyebrow__dot" aria-hidden="true" /> A LITTLE MORE
              NEIGHBORLY
            </p>
            <h1 id="hero-heading">
              Good things are <em>better shared.</em>
            </h1>
            <p className="hero__description">
              Borrow what you need. Lend what you don’t. Make a little more
              possible, together.
            </p>
            <a className="button button--primary hero__button" href="#tools">
              Explore available tools <span aria-hidden="true">↗</span>
            </a>
            <p className="hero__note">
              <span aria-hidden="true">✳</span> A community built around
              sharing, not buying.
            </p>
          </div>
          <aside
            className="hero-card"
            aria-label="About the LendLoop community"
          >
            <div className="hero-card__top">
              <span>THE NEIGHBORHOOD TOOL BOARD</span>
              <span aria-hidden="true">✳</span>
            </div>
            <div className="hero-card__illustration" aria-hidden="true">
              <div className="illustration-ring illustration-ring--one" />
              <div className="illustration-ring illustration-ring--two" />
              <svg viewBox="0 0 120 120" fill="none">
                <path
                  d="M76.2 25.8a24 24 0 0 0-29.3 29.3L22.4 79.6a9.5 9.5 0 0 0 13.4 13.5l24.5-24.5a24 24 0 0 0 29.3-29.3L72.8 56.1 58.9 42.2l17.3-16.4Z"
                  stroke="currentColor"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="29" cy="86.5" r="2.5" fill="currentColor" />
              </svg>
            </div>
            <div className="hero-card__bottom">
              <span>
                LESS STUFF.
                <br />
                MORE COMMUNITY.
              </span>
              <span aria-hidden="true">↗</span>
            </div>
          </aside>
        </section>
        <section
          className="board-section"
          id="tools"
          aria-labelledby="tools-heading"
        >
          <div className="shell board-section__inner">
            <div className="section-heading">
              <div>
                <p className="eyebrow">THE SHARED SHED</p>
                <h2 id="tools-heading">See what’s around.</h2>
                <p>A little help for your next big idea.</p>
              </div>
              <span className="section-heading__aside">
                GOOD TOOLS, GOOD NEIGHBORS <span aria-hidden="true">↗</span>
              </span>
            </div>
            <ToolList />
          </div>
        </section>
        <LendingWorkspace />
        <section
          className="how-section shell"
          id="how-it-works"
          aria-labelledby="how-heading"
        >
          <div className="how-section__intro">
            <p className="eyebrow">SIMPLE AS THAT</p>
            <h2 id="how-heading">Sharing made simple.</h2>
            <p>Good neighbors make great things happen.</p>
          </div>
          <ol className="steps">
            {steps.map((step) => (
              <li key={step.number}>
                <span className="steps__number">{step.number}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </main>
      <footer className="site-footer">
        <div className="shell site-footer__inner">
          <Brand />
          <p>More sharing. More doing. More community.</p>
          <a href="#main-content">Back to top ↑</a>
        </div>
      </footer>
    </>
  );
}
