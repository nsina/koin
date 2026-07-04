export type ClientStatus = 'active' | 'prospect' | 'paused' | 'ended'
export type ClientServiceStatus = 'active' | 'paused' | 'completed'
export type BillingCadence = 'monthly' | 'quarterly' | 'annually' | 'one_time'
export type PricingModel = 'fixed' | 'hourly'

export interface Client {
  id: string
  name: string
  contactName: string
  email: string | null
  billingCode: string
  status: ClientStatus
  notes: string
  createdAt: string
  updatedAt: string
}

export interface ClientService {
  id: string
  clientId: string
  name: string
  amount: number
  pricingModel: PricingModel
  hourlyRate: number | null
  estimatedMonthlyHours: number | null
  billingCadence: BillingCadence
  startDate: string
  endDate: string | null
  commitmentEndDate: string | null
  status: ClientServiceStatus
  notes: string
  createdAt: string
  updatedAt: string
}

export interface RevenueForecastMonth {
  iso: string
  label: string
  total: number
  committed: number
  projected: number
  activeClientCount: number
}

export interface RevenueTimelineRow {
  id: string
  clientName: string
  serviceName: string
  amount: number
  billingCadence: BillingCadence
  startDate: string
  endDate: string | null
  commitmentEndDate: string | null
  startOffset: number
  span: number
  commitmentSpan: number
  endLabel: string | null
  commitmentEndLabel: string | null
  endsWithinWindow: boolean
  extendsPastWindow: boolean
  isEndingSoon: boolean
}

const clients = ref<Client[]>([])
const clientServices = ref<ClientService[]>([])
const _clientNow = ref<Date | null>(null)

const CLIENT_STATUSES: ClientStatus[] = ['active', 'prospect', 'paused', 'ended']
const SERVICE_STATUSES: ClientServiceStatus[] = ['active', 'paused', 'completed']
const BILLING_CADENCES: BillingCadence[] = ['monthly', 'quarterly', 'annually', 'one_time']
const PRICING_MODELS: PricingModel[] = ['fixed', 'hourly']
const FORECAST_MONTHS = 12

function sanitizeClient(raw: unknown): Client | null {
  if (!raw || typeof raw !== 'object') return null
  const v = raw as Record<string, unknown>
  const nowISO = new Date().toISOString()
  return {
    id: String(v.id ?? ''),
    name: String(v.name ?? '').trim(),
    contactName: String(v.contactName ?? v.contact_name ?? ''),
    email: v.email ? String(v.email) : null,
    billingCode: String(v.billingCode ?? v.billing_code ?? '')
      .trim()
      .toUpperCase(),
    status: CLIENT_STATUSES.includes(String(v.status) as ClientStatus)
      ? (String(v.status) as ClientStatus)
      : 'active',
    notes: String(v.notes ?? ''),
    createdAt: String(v.createdAt ?? v.created_at ?? nowISO),
    updatedAt: String(v.updatedAt ?? v.updated_at ?? nowISO),
  }
}

function sanitizeClientService(raw: unknown): ClientService | null {
  if (!raw || typeof raw !== 'object') return null
  const v = raw as Record<string, unknown>
  const nowISO = new Date().toISOString()
  const amount = Number(v.amount ?? 0)
  const hourlyRate = Number(v.hourlyRate ?? v.hourly_rate ?? 0)
  const estimatedMonthlyHours = Number(v.estimatedMonthlyHours ?? v.estimated_monthly_hours ?? 0)
  return {
    id: String(v.id ?? ''),
    clientId: String(v.clientId ?? v.client_id ?? ''),
    name: String(v.name ?? '').trim(),
    amount: Number.isFinite(amount) ? round2(Math.abs(amount)) : 0,
    pricingModel: PRICING_MODELS.includes(String(v.pricingModel ?? v.pricing_model) as PricingModel)
      ? (String(v.pricingModel ?? v.pricing_model) as PricingModel)
      : 'fixed',
    hourlyRate: Number.isFinite(hourlyRate) && hourlyRate > 0 ? round2(hourlyRate) : null,
    estimatedMonthlyHours:
      Number.isFinite(estimatedMonthlyHours) && estimatedMonthlyHours > 0
        ? round2(estimatedMonthlyHours)
        : null,
    billingCadence: BILLING_CADENCES.includes(
      String(v.billingCadence ?? v.billing_cadence) as BillingCadence,
    )
      ? (String(v.billingCadence ?? v.billing_cadence) as BillingCadence)
      : 'monthly',
    startDate: toISODate(String(v.startDate ?? v.start_date ?? getTodayISO())),
    endDate: v.endDate
      ? toISODate(String(v.endDate))
      : v.end_date
        ? toISODate(String(v.end_date))
        : null,
    commitmentEndDate: v.commitmentEndDate
      ? toISODate(String(v.commitmentEndDate))
      : v.commitment_end_date
        ? toISODate(String(v.commitment_end_date))
        : null,
    status: SERVICE_STATUSES.includes(String(v.status) as ClientServiceStatus)
      ? (String(v.status) as ClientServiceStatus)
      : 'active',
    notes: String(v.notes ?? ''),
    createdAt: String(v.createdAt ?? v.created_at ?? nowISO),
    updatedAt: String(v.updatedAt ?? v.updated_at ?? nowISO),
  }
}

function sortClients() {
  clients.value.sort((a, b) => a.name.localeCompare(b.name))
}

function sortServices() {
  clientServices.value.sort((a, b) => a.startDate.localeCompare(b.startDate))
}

function monthIndex(isoDate: string) {
  const d = new Date(`${isoDate}T12:00:00`)
  return d.getFullYear() * 12 + d.getMonth()
}

// Format a Date to YYYY-MM-DD from local components. Avoids the UTC shift of
// toISOString(), so it round-trips cleanly with monthIndex() (which parses at
// noon) regardless of the viewer's timezone.
function toLocalISO(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function monthIso(date: Date) {
  return toLocalISO(new Date(date.getFullYear(), date.getMonth(), 1))
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1)
}

// Full invoice amount for one billing cycle (hourly = rate x est. monthly hours).
function serviceForecastAmount(service: ClientService) {
  if (service.pricingModel === 'hourly') {
    return round2((service.hourlyRate ?? 0) * (service.estimatedMonthlyHours ?? 0))
  }
  return service.amount
}

// Recurring revenue normalized to a monthly run rate: quarterly and annual
// invoices are spread across the months they cover, so a $12k/yr contract reads
// as a steady $1k/mo instead of a single spike on its billing month. One-time
// fees are discrete events, not a run rate, so they contribute nothing here.
function monthlyRunRate(service: ClientService) {
  if (service.billingCadence === 'one_time') return 0
  const amount = serviceForecastAmount(service)
  if (service.billingCadence === 'quarterly') return round2(amount / 3)
  if (service.billingCadence === 'annually') return round2(amount / 12)
  return amount
}

function serviceActiveInMonth(service: ClientService, month: string) {
  if (service.status !== 'active') return false
  const target = monthIndex(month)
  const start = monthIndex(service.startDate)
  const end = service.endDate ? monthIndex(service.endDate) : Number.POSITIVE_INFINITY
  return target >= start && target <= end
}

// Revenue a service contributes to a given forecast month: recurring services
// contribute their amortized run rate every active month; a one-time fee lands
// only in its start month.
function serviceRevenueInMonth(service: ClientService, month: string) {
  if (!serviceActiveInMonth(service, month)) return 0
  if (service.billingCadence === 'one_time') {
    return monthIndex(month) === monthIndex(service.startDate) ? serviceForecastAmount(service) : 0
  }
  return monthlyRunRate(service)
}

function serviceIsCommittedInMonth(service: ClientService, month: string) {
  if (serviceRevenueInMonth(service, month) === 0) return false
  if (service.billingCadence === 'one_time') return true
  const committedThrough = service.commitmentEndDate ?? service.endDate
  if (!committedThrough) return false
  return monthIndex(month) <= monthIndex(committedThrough)
}

export function useClients() {
  const toast = useToast()

  async function loadClients() {
    _clientNow.value = new Date()
    const [clientRows, serviceRows] = await Promise.all([
      $fetch<unknown[]>('/api/clients'),
      $fetch<unknown[]>('/api/client-services'),
    ])
    clients.value = clientRows.map(sanitizeClient).filter(Boolean) as Client[]
    clientServices.value = serviceRows.map(sanitizeClientService).filter(Boolean) as ClientService[]
    sortClients()
    sortServices()
  }

  async function addClient(draft: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>): Promise<Client> {
    const nowISO = new Date().toISOString()
    const row = { ...draft, id: generateId(), createdAt: nowISO, updatedAt: nowISO }
    const created = await $fetch<unknown>('/api/clients', { method: 'POST', body: row })
    const client = sanitizeClient(created) ?? sanitizeClient(row)!
    clients.value.push(client)
    sortClients()
    toast.add({ title: 'Client added', color: 'success' })
    return client
  }

  async function updateClient(id: string, draft: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) {
    const index = clients.value.findIndex((c) => c.id === id)
    if (index < 0) return
    const updated = { ...clients.value[index]!, ...draft, updatedAt: new Date().toISOString() }
    await $fetch(`/api/clients/${id}`, { method: 'PUT', body: updated })
    clients.value[index] = updated
    sortClients()
    toast.add({ title: 'Client updated', color: 'success' })
  }

  async function deleteClient(id: string) {
    await $fetch(`/api/clients/${id}`, { method: 'DELETE' })
    clients.value = clients.value.filter((c) => c.id !== id)
    clientServices.value = clientServices.value.filter((s) => s.clientId !== id)
    toast.add({ title: 'Client deleted', color: 'success' })
  }

  async function addService(
    draft: Omit<ClientService, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ClientService> {
    const nowISO = new Date().toISOString()
    const row = { ...draft, id: generateId(), createdAt: nowISO, updatedAt: nowISO }
    const created = await $fetch<unknown>('/api/client-services', { method: 'POST', body: row })
    const service = sanitizeClientService(created) ?? sanitizeClientService(row)!
    clientServices.value.push(service)
    sortServices()
    toast.add({ title: 'Service added', color: 'success' })
    return service
  }

  async function updateService(
    id: string,
    draft: Omit<ClientService, 'id' | 'createdAt' | 'updatedAt'>,
  ) {
    const index = clientServices.value.findIndex((s) => s.id === id)
    if (index < 0) return
    const updated = {
      ...clientServices.value[index]!,
      ...draft,
      updatedAt: new Date().toISOString(),
    }
    await $fetch(`/api/client-services/${id}`, { method: 'PUT', body: updated })
    clientServices.value[index] = updated
    sortServices()
    toast.add({ title: 'Service updated', color: 'success' })
  }

  async function deleteService(id: string) {
    await $fetch(`/api/client-services/${id}`, { method: 'DELETE' })
    clientServices.value = clientServices.value.filter((s) => s.id !== id)
    toast.add({ title: 'Service deleted', color: 'success' })
  }

  function servicesForClient(clientId: string) {
    return clientServices.value.filter((s) => s.clientId === clientId)
  }

  const forecastMonths = computed(() => {
    const now = _clientNow.value
    if (!now) return []
    return Array.from({ length: FORECAST_MONTHS }, (_, i) => {
      const date = addMonths(now, i)
      const iso = monthIso(date)
      return {
        iso,
        label: date.toLocaleString('en-US', { month: 'short', year: '2-digit' }),
      }
    })
  })

  const monthlyForecast = computed<RevenueForecastMonth[]>(() =>
    forecastMonths.value.map((month) => {
      let total = 0
      let committed = 0
      const activeClientIds = new Set<string>()
      for (const service of clientServices.value) {
        const revenue = serviceRevenueInMonth(service, month.iso)
        if (revenue === 0) continue
        total = round2(total + revenue)
        if (serviceIsCommittedInMonth(service, month.iso)) {
          committed = round2(committed + revenue)
        }
        activeClientIds.add(service.clientId)
      }
      return {
        ...month,
        total,
        committed,
        projected: round2(total - committed),
        activeClientCount: activeClientIds.size,
      }
    }),
  )

  // Recurring monthly run rate of services active this month — excludes one-time
  // fees so the headline stays a steady MRR figure, not a lumpy billings total.
  const currentMonthlyRevenue = computed(() => {
    const month = forecastMonths.value[0]?.iso
    if (!month) return 0
    return round2(
      clientServices.value.reduce(
        (sum, service) =>
          serviceActiveInMonth(service, month) ? sum + monthlyRunRate(service) : sum,
        0,
      ),
    )
  })
  const nextSixCommittedRevenue = computed(() =>
    round2(monthlyForecast.value.slice(0, 6).reduce((sum, m) => sum + m.committed, 0)),
  )
  const twelveMonthForecastRevenue = computed(() =>
    round2(monthlyForecast.value.reduce((sum, m) => sum + m.total, 0)),
  )
  // How far out contracted (committed) revenue extends: the label of the last
  // forecast month that still carries committed dollars, plus how many of the
  // 12 months are contracted. Drives the "committed runway" headline — the key
  // forecasting signal (when does at-will revenue take over).
  const committedRunway = computed(() => {
    let label = ''
    let count = 0
    for (const month of monthlyForecast.value) {
      if (month.committed > 0) {
        count++
        label = month.label
      }
    }
    return { count, label }
  })

  const activeClientCount = computed(
    () =>
      clients.value.filter(
        (client) =>
          client.status === 'active' &&
          clientServices.value.some(
            (service) => service.clientId === client.id && service.status === 'active',
          ),
      ).length,
  )

  const endingSoonServices = computed(() => {
    const now = _clientNow.value
    if (!now) return []
    const today = toLocalISO(now)
    // Soft ~3-month window; day-based so it reads naturally as "next 3 months".
    const horizon = toLocalISO(new Date(now.getFullYear(), now.getMonth() + 3, now.getDate()))
    return clientServices.value
      .filter((service) => {
        if (service.status !== 'active') return false
        // Only a hard end date counts as "ending". A lapsing commitmentEndDate
        // just flips the service from committed to projected — it keeps running.
        const end = service.endDate
        return !!end && end >= today && end <= horizon
      })
      .map((service) => ({
        service,
        client: clients.value.find((client) => client.id === service.clientId) ?? null,
        endDate: service.endDate!,
      }))
      .sort((a, b) => a.endDate.localeCompare(b.endDate))
  })

  const timelineRows = computed<RevenueTimelineRow[]>(() => {
    const months = forecastMonths.value
    if (months.length === 0) return []
    const first = monthIndex(months[0]!.iso)
    const last = monthIndex(months[months.length - 1]!.iso)
    const endingSoonIds = new Set(endingSoonServices.value.map((e) => e.service.id))

    return clientServices.value
      .filter((service) => service.status === 'active')
      .map((service) => {
        const client = clients.value.find((c) => c.id === service.clientId)
        const start = Math.max(monthIndex(service.startDate), first)
        const end = Math.min(service.endDate ? monthIndex(service.endDate) : last, last)
        if (!client || end < first || start > last) return null
        const commitmentEnd = service.commitmentEndDate ?? service.endDate
        const commitmentSpan = commitmentEnd
          ? Math.max(0, Math.min(monthIndex(commitmentEnd), last) - start + 1)
          : 0
        const endIdx = service.endDate ? monthIndex(service.endDate) : null
        return {
          id: service.id,
          clientName: client.name,
          serviceName: service.name,
          amount: serviceForecastAmount(service),
          billingCadence: service.billingCadence,
          startDate: service.startDate,
          endDate: service.endDate,
          commitmentEndDate: service.commitmentEndDate,
          startOffset: start - first,
          span: Math.max(1, end - start + 1),
          commitmentSpan,
          endLabel: service.endDate ? formatDateShort(service.endDate) : null,
          commitmentEndLabel: service.commitmentEndDate
            ? formatDateShort(service.commitmentEndDate)
            : null,
          endsWithinWindow: endIdx !== null && endIdx <= last,
          extendsPastWindow: endIdx === null || endIdx > last,
          isEndingSoon: endingSoonIds.has(service.id),
        }
      })
      .filter(Boolean) as RevenueTimelineRow[]
  })

  const timelineTodayRatio = computed(() => {
    const now = _clientNow.value
    if (!now) return 0
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    return (now.getDate() - 1) / daysInMonth / FORECAST_MONTHS
  })

  return {
    clients,
    clientServices,
    loadClients,
    addClient,
    updateClient,
    deleteClient,
    addService,
    updateService,
    deleteService,
    servicesForClient,
    serviceForecastAmount,
    monthlyRunRate,
    forecastMonths,
    monthlyForecast,
    currentMonthlyRevenue,
    nextSixCommittedRevenue,
    twelveMonthForecastRevenue,
    committedRunway,
    activeClientCount,
    endingSoonServices,
    timelineRows,
    timelineTodayRatio,
  }
}
