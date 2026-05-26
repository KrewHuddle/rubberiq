/**
 * Centralized Motion variants — every reveal/transition in the app should
 * pull from here so the orchestration stays coherent.
 *
 * Two high-impact patterns:
 *
 * 1. `pageStagger` — staggered page-load reveal (Module 1 hard rule). Wrap a
 *    section in <motion.div variants={pageStagger}> and nest children with
 *    <motion.div variants={pageItem}>.
 *
 * 2. `intakeReveal` — the AI intake "wow" moment: photo resolves into a
 *    graded, priced tire. The GradeStamp + PriceTag punch in with the spring
 *    easing while supporting data fades and slides up.
 */
import type { Variants, Transition } from 'framer-motion';
import { tokens } from './tokens.js';

const easeOut: Transition['ease'] = tokens.motion.easeOut as unknown as Transition['ease'];
const easeSpring: Transition['ease'] = tokens.motion.easeSpring as unknown as Transition['ease'];

export const pageStagger: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.08 },
  },
};

export const pageItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: tokens.motion.durBase, ease: easeOut },
  },
};

export const intakeReveal: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.09, delayChildren: 0.12 },
  },
};

/** GradeStamp punch — scale-in with overshoot. Hero AI moment. */
export const intakeStamp: Variants = {
  hidden: { opacity: 0, scale: 0.4, rotate: -8 },
  visible: {
    opacity: 1,
    scale: 1,
    rotate: -3,
    transition: { duration: 0.42, ease: easeSpring },
  },
};

/** PriceTag slide-in. */
export const intakePrice: Variants = {
  hidden: { opacity: 0, x: 24 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: tokens.motion.durBase, ease: easeOut },
  },
};

/** Data rows (size/DOT/tread/age) — slide-up after the hero numbers. */
export const intakeDataRow: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: tokens.motion.durBase, ease: easeOut },
  },
};
