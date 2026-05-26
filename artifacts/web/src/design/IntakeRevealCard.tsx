/**
 * IntakeRevealCard — the high-impact moment.
 * When a photo resolves into a graded, priced tire, this card stages the
 * orchestrated reveal: GradeStamp punches in, PriceTag slides, data rows fade up.
 *
 * Use AFTER the intake API resolves — feed the resolved fields in and let
 * Motion handle the staging.
 */
import { motion } from 'framer-motion';
import { intakeReveal, intakeStamp, intakePrice, intakeDataRow } from './motion.js';
import { GradeStamp, type Grade } from './GradeStamp.js';
import { PriceTag } from './PriceTag.js';
import { Card } from './Card.js';

export type IntakeRevealData = {
  brand?: string | null;
  model?: string | null;
  size: string;
  dotCode?: string | null;
  ageMonths?: number | null;
  treadDepth32nds?: number | null;
  grade: Grade;
  priceCents: number;
  benchmarkCents?: number | null;
  language?: string;
};

type Props = {
  data: IntakeRevealData;
  labels: {
    size: string;
    dot: string;
    age: string;
    tread: string;
    ageUnit: string; // "mo"
    treadUnit: string; // "/32"
  };
};

export function IntakeRevealCard({ data, labels }: Props) {
  return (
    <Card elev="raised" className="overflow-hidden">
      <motion.div
        variants={intakeReveal}
        initial="hidden"
        animate="visible"
        className="grid gap-8 md:grid-cols-[auto_1fr_auto] items-center"
      >
        <motion.div variants={intakeStamp}>
          <GradeStamp grade={data.grade} size="hero" />
        </motion.div>

        <div className="space-y-3">
          {(data.brand || data.model) && (
            <motion.div
              variants={intakeDataRow}
              className="font-[family-name:var(--rb-font-display)] text-3xl font-semibold tracking-tight"
            >
              {[data.brand, data.model].filter(Boolean).join(' ')}
            </motion.div>
          )}
          <motion.dl variants={intakeDataRow} className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <dt className="text-[var(--rb-fg-muted)]">{labels.size}</dt>
            <dd className="font-[family-name:var(--rb-font-mono)] tabular-nums tracking-wider">
              {data.size}
            </dd>
            {data.dotCode && (
              <>
                <dt className="text-[var(--rb-fg-muted)]">{labels.dot}</dt>
                <dd className="font-[family-name:var(--rb-font-mono)] tabular-nums tracking-wider">
                  {data.dotCode}
                </dd>
              </>
            )}
            {data.treadDepth32nds != null && (
              <>
                <dt className="text-[var(--rb-fg-muted)]">{labels.tread}</dt>
                <dd className="font-[family-name:var(--rb-font-mono)] tabular-nums tracking-wider">
                  {data.treadDepth32nds}
                  {labels.treadUnit}
                </dd>
              </>
            )}
            {data.ageMonths != null && (
              <>
                <dt className="text-[var(--rb-fg-muted)]">{labels.age}</dt>
                <dd className="font-[family-name:var(--rb-font-mono)] tabular-nums tracking-wider">
                  {data.ageMonths}
                  {labels.ageUnit}
                </dd>
              </>
            )}
          </motion.dl>
        </div>

        <motion.div variants={intakePrice}>
          <PriceTag
            cents={data.priceCents}
            benchmarkCents={data.benchmarkCents ?? undefined}
            locale={data.language === 'es' ? 'es-US' : 'en-US'}
            size="hero"
          />
        </motion.div>
      </motion.div>
    </Card>
  );
}
