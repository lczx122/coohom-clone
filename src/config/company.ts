// ---------------------------------------------------------------------------
// COMPANY TAILORING
// ---------------------------------------------------------------------------
// This is the single place to brand the app for your company. Change the name,
// colors, currency and default wall specs here. The product inventory lives in
// src/data/catalog.ts.
// ---------------------------------------------------------------------------

export interface CompanyConfig {
  /** Shown in the top bar. */
  name: string
  /** Short tagline shown under the name. */
  tagline: string
  /** Primary brand color (buttons, accents). */
  brandColor: string
  /** Currency symbol for catalog prices. */
  currency: string
  /** Default specs applied when drawing new walls. */
  defaults: {
    wallThickness: number // meters
    wallHeight: number // meters
    doorWidth: number // meters
    windowWidth: number // meters
  }
}

export const company: CompanyConfig = {
  name: 'Acme Interiors',
  tagline: 'Furniture & Cabinetry — Floor Planner',
  brandColor: '#2f6df6',
  currency: '$',
  defaults: {
    wallThickness: 0.1,
    wallHeight: 2.7,
    doorWidth: 0.9,
    windowWidth: 1.2,
  },
}
