import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Scale } from 'lucide-react';
import { BatchPulse } from '@/components/BatchPulse';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { copy } from '@/content/copy';
import { formatUnits, formatUsd } from '@/lib/format';
import type { AuctionResult, DfbaRound } from '@/types/game';

function AuctionPanel({
  auction,
  title,
  delay,
}: {
  auction: AuctionResult;
  title: string;
  delay: number;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={`auction auction--${auction.side}`}
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.3, delay: reduceMotion ? 0 : delay }}
    >
      <span className="auction__side">{title}</span>
      <span className="stat__label">{copy.dfbaReveal.clearingPriceLabel}</span>
      <span className="auction__price">{formatUsd(auction.clearingPrice)}</span>
      <span className="faint">
        {copy.dfbaReveal.matchedLabel} {formatUnits(auction.matchedUnits)}{' '}
        {copy.dfbaReveal.unitsLabel} · {auction.participatingOrders}{' '}
        {copy.dfbaReveal.ordersLabel.toLowerCase()}
      </span>
    </motion.div>
  );
}

export function DfbaRevealScreen({
  round,
  onContinue,
}: {
  round: DfbaRound;
  onContinue: () => void;
}) {
  return (
    <Screen label={copy.dfbaReveal.heading}>
      <div>
        <p className="eyebrow">{copy.dfbaReveal.eyebrow}</p>
        <h1 className="title">{copy.dfbaReveal.heading}</h1>
      </div>
      <p className="lede">{copy.dfbaReveal.lede}</p>

      <div className="panel panel--accent">
        <BatchPulse caption={copy.pulse.caption} />
      </div>

      <div className="auctions">
        <AuctionPanel
          auction={round.bidAuction}
          title={copy.dfbaReveal.bidAuctionLabel}
          delay={0.05}
        />
        <AuctionPanel
          auction={round.askAuction}
          title={copy.dfbaReveal.askAuctionLabel}
          delay={0.2}
        />
      </div>

      <p className="note">
        <Scale size={14} aria-hidden="true" /> {copy.dfbaReveal.separateNote}
      </p>

      <p className="note">{copy.dfbaReveal.arrivalNote}</p>
      <p className="tiny">{copy.pulse.notBenchmark}</p>

      {/* The comparison reveal, shown once both levels have been played. */}
      <h2 className="section-title">{copy.comparison.heading}</h2>
      <div className="compare" role="table" aria-label={copy.comparison.heading}>
        <div className="compare__row compare__row--head" role="row">
          <span role="columnheader" />
          <span role="columnheader" className="compare__head compare__head--clob">
            {copy.comparison.clobColumn}
          </span>
          <span role="columnheader" className="compare__head compare__head--dfba">
            {copy.comparison.dfbaColumn}
          </span>
        </div>
        {copy.comparison.rows.map((row) => (
          <div key={row.label} className="compare__row" role="row">
            <span role="rowheader" className="compare__label">
              {row.label}
            </span>
            <span role="cell" className="compare__cell compare__cell--clob">
              {row.clob}
            </span>
            <span role="cell" className="compare__cell compare__cell--dfba">
              {row.dfba}
            </span>
          </div>
        ))}
      </div>
      <p className="note">{copy.comparison.verdict}</p>

      <h2 className="section-title">{copy.dfbaReveal.stillMattersHeading}</h2>
      <ul className="bullet-list">
        {copy.dfbaReveal.stillMatters.map((item) => (
          <li key={item}>
            <span aria-hidden="true">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <p className="tiny">{copy.comparison.stillTrue}</p>

      <div className="screen__actions">
        <Button block icon={<ArrowRight size={18} />} onClick={onContinue}>
          {copy.dfbaReveal.continueLabel}
        </Button>
      </div>
    </Screen>
  );
}
