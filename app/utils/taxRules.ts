// Verified against: IRS 2025 Schedule C (Form 1040) + Official Instructions
// Source: https://www.irs.gov/pub/irs-pdf/f1040sc.pdf
// Source: https://www.irs.gov/instructions/i1040sc

export interface TaxCategory {
  /** Founder-friendly label shown in app dropdowns and expense lists. */
  name: string
  /** Official IRS label shown in Schedule C summary/reporting views. */
  irsName: string
  /** Schedule C line used for tax grouping. null = not on Schedule C. */
  scheduleCLine: string | null
  /** Percentage applied to the expense amount (0-100). null = user-defined usage. */
  defaultPct: number | null
  /** When true, deductible % input is disabled to enforce IRS rules. */
  isLocked: boolean
  /** Advisory or lock reason shown as a hint in the ExpenseModal. */
  uiHint?: string
  /** Drives extra UI panels in ExpenseModal. */
  specialHandling?: 'equipment' | 'contractor'
  /** Backward-compatible aliases for already-saved expenses. */
  legacyNames?: string[]
}

export const TAX_CATEGORIES: TaxCategory[] = [
  // Startup essentials
  {
    name: 'Software & Subscriptions',
    irsName: 'Other expenses',
    scheduleCLine: 'Line 27b',
    defaultPct: 100,
    isLocked: false,
    uiHint: 'SaaS tools, app subscriptions, cloud hosting (AWS/Vercel).',
  },
  {
    name: 'Contractors & Freelancers',
    irsName: 'Contract labor',
    scheduleCLine: 'Line 11',
    defaultPct: 100,
    isLocked: false,
    specialHandling: 'contractor',
    legacyNames: ['Contractor / Freelancer'],
    uiHint: 'Issue Form 1099-NEC if you pay them >= $600 this year.',
  },
  {
    name: 'Advertising & Marketing',
    irsName: 'Advertising',
    scheduleCLine: 'Line 8',
    defaultPct: 100,
    isLocked: false,
  },
  {
    name: 'Meals & Coffee (Business)',
    irsName: 'Deductible meals',
    scheduleCLine: 'Line 24b',
    defaultPct: 50,
    isLocked: true,
    legacyNames: ['Meals & Entertainment'],
    uiHint: '🔒 IRS limits business meals to 50% deductibility. (Entertainment is 0%).',
  },
  {
    name: 'Travel & Lodging',
    irsName: 'Travel',
    scheduleCLine: 'Line 24a',
    defaultPct: 100,
    isLocked: false,
    legacyNames: ['Business Travel'],
    uiHint: 'Flights, hotels, Ubers on business trips (must be away from home overnight).',
  },

  // Office and gear
  {
    name: 'Equipment & Hardware',
    irsName: 'Depreciation and section 179 expense deduction',
    scheduleCLine: 'Line 13',
    defaultPct: 100,
    isLocked: false,
    specialHandling: 'equipment',
    legacyNames: ['Equipment & Technology'],
    uiHint: 'Laptops, cameras, servers. Handled via Section 179 depreciation.',
  },
  {
    name: 'Office Supplies',
    irsName: 'Office expense',
    scheduleCLine: 'Line 18',
    defaultPct: 100,
    isLocked: false,
    legacyNames: ['Office Expense'],
  },
  {
    name: 'Office Rent & Coworking',
    irsName: 'Rent or lease (other business property)',
    scheduleCLine: 'Line 20b',
    defaultPct: 100,
    isLocked: false,
    legacyNames: ['Rent / Coworking Space'],
  },
  {
    name: 'Phone & Internet',
    irsName: 'Utilities',
    scheduleCLine: 'Line 25',
    defaultPct: null,
    isLocked: false,
    uiHint: '⚠️ Deduct your actual business-use % (e.g., 70% of your cell bill).',
  },
  {
    name: 'Home Office Deduction',
    irsName: 'Expenses for business use of your home',
    scheduleCLine: 'Line 30',
    defaultPct: 100,
    isLocked: false,
    legacyNames: ['Home Office'],
    uiHint: '🏠 Deduct based on sq footage used exclusively for business.',
  },

  // Fees and services
  {
    name: 'Platform Fees & Commissions',
    irsName: 'Commissions and fees',
    scheduleCLine: 'Line 10',
    defaultPct: 100,
    isLocked: false,
    legacyNames: ['Commissions & Platform Fees'],
    uiHint: 'Stripe, PayPal, Upwork, or App Store fees.',
  },
  {
    name: 'Bank & Wire Fees',
    irsName: 'Other expenses',
    scheduleCLine: 'Line 27b',
    defaultPct: 100,
    isLocked: false,
    legacyNames: ['Bank & Transaction Fees'],
  },
  {
    name: 'Legal, CPA & Professional',
    irsName: 'Legal and professional services',
    scheduleCLine: 'Line 17',
    defaultPct: 100,
    isLocked: false,
    legacyNames: ['Legal & Professional Services'],
  },
  {
    name: 'Business Insurance',
    irsName: 'Insurance (other than health)',
    scheduleCLine: 'Line 15',
    defaultPct: 100,
    isLocked: false,
  },
  {
    name: 'Business Taxes & Licenses',
    irsName: 'Taxes and licenses',
    scheduleCLine: 'Line 23',
    defaultPct: 100,
    isLocked: false,
    uiHint: 'LLC fees, state franchise taxes, local licenses.',
  },

  // Misc business
  {
    name: 'Vehicle & Gas',
    irsName: 'Car and truck expenses',
    scheduleCLine: 'Line 9',
    defaultPct: null,
    isLocked: false,
    legacyNames: ['Auto / Gas / Transit'],
    uiHint: '⚠️ If you claim standard mileage, you cannot also deduct gas/repairs.',
  },
  {
    name: 'Education & Courses',
    irsName: 'Other expenses',
    scheduleCLine: 'Line 27b',
    defaultPct: 100,
    isLocked: false,
    legacyNames: ['Education & Training'],
  },
  {
    name: 'Client Gifts',
    irsName: 'Other expenses',
    scheduleCLine: 'Line 27b',
    defaultPct: 100,
    isLocked: false,
    uiHint: '⚠️ IRS limits gifts to $25 per recipient per year.',
  },
  {
    name: 'Other / Misc Business',
    irsName: 'Other expenses',
    scheduleCLine: 'Line 27b',
    defaultPct: null,
    isLocked: false,
    legacyNames: ['Other'],
  },

  // IRS hard locks (non-deductible or Schedule 1)
  {
    name: "Owner's Draw / Personal Transfer",
    irsName: 'N/A',
    scheduleCLine: null,
    defaultPct: 0,
    isLocked: true,
    legacyNames: ["Owner's Draw / Personal"],
    uiHint: '🔒 Non-deductible. Taking cash out of your business is not an expense.',
  },
  {
    name: 'Fines & Parking Tickets',
    irsName: 'N/A',
    scheduleCLine: null,
    defaultPct: 0,
    isLocked: true,
    legacyNames: ['Fines & Penalties'],
    uiHint: '🔒 IRS Code §162(f): Forbids deducting legal or parking fines.',
  },
  {
    name: 'Owner Retirement (Solo 401k/SEP)',
    irsName: 'N/A',
    scheduleCLine: null,
    defaultPct: 100,
    isLocked: true,
    legacyNames: ['Owner Retirement (SEP/SIMPLE/Solo 401k)'],
    uiHint: '🔒 Deducted on Form 1040 Schedule 1, not Schedule C.',
  },
  {
    name: 'Health Insurance (Self-Employed)',
    irsName: 'N/A',
    scheduleCLine: null,
    defaultPct: 100,
    isLocked: true,
    legacyNames: ['Self-Employed Health Insurance'],
    uiHint: '🔒 Deducted on Form 1040 Schedule 1, not Schedule C.',
  },
]

export function findTaxCategoryByName(name: string) {
  return TAX_CATEGORIES.find((category) => {
    if (category.name === name) return true
    return category.legacyNames?.includes(name) ?? false
  })
}
