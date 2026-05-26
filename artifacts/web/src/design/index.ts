/**
 * Design system entry — every screen consumes primitives from here.
 * No one-off hardcoded styles, no Inter/Roboto/Arial, no purple-on-white AI cliché.
 * (Module 1 spec rules.)
 */
export { tokens, setTheme, initTheme, type Theme } from './tokens.js';
export {
  pageStagger,
  pageItem,
  intakeReveal,
  intakeStamp,
  intakePrice,
  intakeDataRow,
} from './motion.js';
export { cn } from './cn.js';
export { Button } from './Button.js';
export { Card } from './Card.js';
export { Badge } from './Badge.js';
export { GradeStamp, type Grade } from './GradeStamp.js';
export { PriceTag } from './PriceTag.js';
export { DataTable, type Column } from './DataTable.js';
export { StatTile } from './StatTile.js';
export { IntakeRevealCard, type IntakeRevealData } from './IntakeRevealCard.js';
