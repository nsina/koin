import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core'

export const expenses = sqliteTable('expenses', {
  id:             text('id').primaryKey(),
  date:           text('date').notNull(),
  vendor:         text('vendor').notNull(),
  amount:         real('amount').notNull(),
  category:       text('category').notNull(),
  description:    text('description').notNull().default(''),
  paymentMethod:  text('payment_method').notNull(),
  clientBillable: integer('client_billable', { mode: 'boolean' }).notNull().default(false),
  taxDeductible:  integer('tax_deductible', { mode: 'boolean' }).notNull().default(true),
  deductiblePct:  real('deductible_pct').notNull().default(100),
  source:               text('source').notNull().default('manual'),
  mercuryTransactionId: text('mercury_transaction_id'),
  contractorId:         text('contractor_id'),
  section179:     integer('section_179', { mode: 'boolean' }).notNull().default(false),
  businessUsePct: real('business_use_pct').notNull().default(100),
  receipts:       text('receipts'),
  createdAt:      text('created_at').notNull(),
  updatedAt:      text('updated_at').notNull()
})

export const mileageTrips = sqliteTable('mileage_trips', {
  id:        text('id').primaryKey(),
  date:      text('date').notNull(),
  from:      text('from_location').notNull(),
  to:        text('to_location').notNull(),
  miles:     real('miles').notNull(),
  purpose:   text('purpose').notNull().default('Business'),
  createdAt: text('created_at').notNull()
})

export const settings = sqliteTable('settings', {
  key:   text('key').primaryKey(),
  value: text('value').notNull()
})

export const contractors = sqliteTable('contractors', {
  id:           text('id').primaryKey(),
  name:         text('name').notNull(),
  businessType: text('business_type').notNull().default('individual'),
  ein:          text('ein'),
  email:        text('email'),
  w9Received:   integer('w9_received', { mode: 'boolean' }).notNull().default(false),
  notes:        text('notes').notNull().default(''),
  is1099Exempt: integer('is_1099_exempt', { mode: 'boolean' }).notNull().default(false),
  createdAt:    text('created_at').notNull()
})

export const recurringTemplates = sqliteTable('recurring_templates', {
  id:             text('id').primaryKey(),
  vendor:         text('vendor').notNull(),
  amount:         real('amount').notNull(),
  category:       text('category').notNull(),
  paymentMethod:  text('payment_method').notNull(),
  description:    text('description').notNull().default(''),
  clientBillable: integer('client_billable', { mode: 'boolean' }).notNull().default(false),
  taxDeductible:  integer('tax_deductible', { mode: 'boolean' }).notNull().default(true),
  deductiblePct:  real('deductible_pct').notNull().default(100),
  frequency:      text('frequency').notNull(),
  nextDueDate:    text('next_due_date').notNull(),
  endDate:        text('end_date'),
  autoAdd:        integer('auto_add', { mode: 'boolean' }).notNull().default(false),
  active:         integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt:      text('created_at').notNull()
})

export const estimatedTaxPayments = sqliteTable('estimated_tax_payments', {
  id:                 text('id').primaryKey(),
  quarter:            text('quarter').notNull(),
  year:               integer('year').notNull(),
  dueDate:            text('due_date').notNull(),
  amountPaid:         real('amount_paid'),
  datePaid:           text('date_paid'),
  confirmationNumber: text('confirmation_number').notNull().default('')
})
