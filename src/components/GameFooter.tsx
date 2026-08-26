import { copy } from '@/content/copy';

export function GameFooter() {
  return (
    <footer className="footer">
      <p className="footer__legal">{copy.footer.legal}</p>
      <p className="footer__legal">{copy.meta.shortDisclaimer}</p>
    </footer>
  );
}
