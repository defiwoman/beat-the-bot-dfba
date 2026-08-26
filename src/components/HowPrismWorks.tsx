import { ArrowUpRight, Check, ChevronDown } from 'lucide-react';
import { copy } from '@/content/copy';

/**
 * The expandable mechanism explainer.
 *
 * Built on native `<details>`/`<summary>`: keyboard operable, announced as a disclosure, and
 * open-able without JavaScript. The four stages are an ordered list because their order is the
 * explanation.
 */
export function HowPrismWorks() {
  return (
    <details className="prism-explainer">
      <summary className="prism-explainer__summary" aria-label={copy.howPrism.summaryHint}>
        <span className="prism-explainer__summaryText">{copy.howPrism.summary}</span>
        <ChevronDown className="prism-explainer__chevron" size={18} aria-hidden="true" />
      </summary>

      <div className="prism-explainer__body">
        <p className="faint">{copy.howPrism.intro}</p>

        <ol className="prism-stages">
          {copy.howPrism.stages.map((stage, index) => (
            <li key={stage.title} className="prism-stage">
              <span className="prism-stage__num" aria-hidden="true">
                {index + 1}
              </span>
              <span>
                <span className="prism-stage__title">{stage.title}</span>
                <span className="prism-stage__body">{stage.body}</span>
              </span>
            </li>
          ))}
        </ol>

        <h3 className="section-title">{copy.howPrism.rulesHeading}</h3>
        <ul className="bullet-list">
          {copy.howPrism.rules.map((rule) => (
            <li key={rule}>
              <Check size={14} aria-hidden="true" />
              <span>{rule}</span>
            </li>
          ))}
        </ul>

        <div className="note">
          <strong>{copy.howPrism.fogoHeading}.</strong> {copy.howPrism.fogoBody}
        </div>

        <h3 className="section-title">{copy.howPrism.learnMoreHeading}</h3>
        <ul className="learn-more">
          {copy.learnMore.map((link) => (
            <li key={link.url}>
              <a
                className="learn-more__link"
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>
                  <span className="learn-more__label">{link.label}</span>
                  <span className="learn-more__description">{link.description}</span>
                </span>
                <ArrowUpRight size={16} aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
