import { copy } from '@/content/copy';

/**
 * The persistent footer.
 *
 * It carries the full illustrative-numbers disclaimer as well as the short one. The opening
 * screen now shows a single compact line so the title and the co-branding are not competing
 * with a paragraph, and this is one of the three places — with the About panel and the results
 * screen — that keeps the long version permanently reachable.
 */
export function GameFooter() {
  return (
    <footer className="footer">
      <p className="footer__legal">{copy.footer.legal}</p>
      <p className="footer__legal">{copy.meta.shortDisclaimer}</p>
      <p className="footer__legal footer__legal--full">{copy.meta.disclaimer}</p>
    </footer>
  );
}
