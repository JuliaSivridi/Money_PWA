/**
 * Design constants shared across the app.
 * Single source of truth — never hardcode these values in component files.
 */

/** Fallback color for accounts and categories that have no color set */
export const DEFAULT_ENTITY_COLOR = '#6b7280'

/** Text color used on top of colored backgrounds (icons inside colored circles) */
export const ON_COLOR_TEXT = '#ffffff'

/** Icon sizes used in lists and modals */
export const ICON_SIZES = {
  /** Tiny — ColorPicker checkmark, small inline indicators */
  xs: 14,
  /** Small — section headers, modal lists */
  sm: 16,
  /** Medium — secondary stacked category icon */
  md: 20,
  /** Large — primary category / account icon in list rows */
  lg: 28,
} as const

/** Round a number to 2 decimal places (safe for monetary values) */
export function roundAmount(n: number): number {
  return Math.round(n * 100) / 100
}
