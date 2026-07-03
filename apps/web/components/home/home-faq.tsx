import { siteFaqs } from "@/lib/faqs";

export function HomeFaq({ compact = false }: { compact?: boolean }) {
  return (
    <section
      className={compact ? "home-faq home-faq--compact" : "home-faq"}
      aria-labelledby="home-faq-title"
    >
      {!compact && (
        <h2 id="home-faq-title" className="home-faq__title">
          FAQ
        </h2>
      )}
      <dl className="home-faq__list" aria-label={compact ? "FAQ" : undefined}>
        {siteFaqs.map(({ question, answer }) => (
          <div key={question} className="home-faq__item">
            <dt className="home-faq__question">{question}</dt>
            <dd className="home-faq__answer">{answer}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
