export interface CassetteDto {
  cassetteKey: string
  denomination: number
  currentBillCount: number
  capacityInBills: number
  criticalThresholdBills: number
  isRejectCassette: boolean
  cashState: string
  fillPercent: number
}

export interface AtmDto {
  id: string
  displayName: string
  city: string
  location: string
  status: string
  transactionStatus: string
  lastErrorMessage: string
  dispenserStatus: string
  cardReaderStatus: string
  receiptPrinterStatus: string
  networkStatus: string
  receiptPaperCount: number
  recentAlertsCount: number
  lastSeenAt: string
  cassettes: CassetteDto[]
}

export interface CassetteMovementDto {
  cassetteId: string
  billDelta: number
  amountDelta: number
}

export interface EventDto {
  id: number
  runId?: string
  sequenceNumber: number
  atmId: string
  eventType: string
  severity: string
  transactionStatus?: string
  flowKey?: string
  message: string
  createdAt: string        // tiempo SIMULADO (usa el reloj acelerado del simulador)
  generatedAtUtc: string   // tiempo REAL UTC
  receivedAtUtc: string
  cassetteMovements: CassetteMovementDto[]
}

export interface TransactionStepDto {
  id: string
  sequenceNumber: number
  eventType: string
  severity: string
  status: string
  message: string
  createdAt: string
}

export interface TransactionDto {
  id: string
  runId?: string
  flowKey: string
  type: string
  status: string
  isSuccessful: boolean
  atmId: string
  displayName: string
  city: string
  location: string
  amount: number
  billCount: number
  startedAt: string
  completedAt: string
  durationSimulatedSeconds: number
  durationRealMilliseconds: number
  steps: TransactionStepDto[]
  cassetteMovements: CassetteMovementDto[]
}

export interface TransactionPageDto {
  total: number
  page: number
  pageSize: number
  totalPages: number
  items: TransactionDto[]
}

export interface HourlyOperationalLoadBucketDto {
  hour: number
  transactions: number
  successful: number
  failed: number
  withdrawals: number
  inquiries: number
}

export interface HourlyOperationalLoadDto {
  runId?: string
  totalTransactions: number
  successfulTransactions: number
  failedTransactions: number
  firstTransactionAt?: string
  lastTransactionAt?: string
  hours: HourlyOperationalLoadBucketDto[]
}

export interface DailyOperationalLoadBucketDto {
  date: string
  label: string
  transactions: number
  successful: number
  failed: number
  withdrawals: number
  inquiries: number
}

export interface DailyOperationalLoadDto {
  runId?: string
  totalTransactions: number
  successfulTransactions: number
  failedTransactions: number
  firstTransactionAt?: string
  lastTransactionAt?: string
  days: DailyOperationalLoadBucketDto[]
}

export interface OperationalLoadSeriesPointDto {
  key: string
  label: string
  transactions: number
  successful: number
  failed: number
  withdrawals: number
  inquiries: number
}

export interface OperationalLoadSeriesDto {
  runId?: string
  granularity: string
  totalTransactions: number
  successfulTransactions: number
  failedTransactions: number
  firstTransactionAt?: string
  lastTransactionAt?: string
  points: OperationalLoadSeriesPointDto[]
}

export interface TransactionSummaryItemDto {
  label: string
  value: number
}

export interface TransactionSummaryDto {
  runId?: string
  totalTransactions: number
  successfulTransactions: number
  failedTransactions: number
  withdrawals: number
  inquiries: number
  successfulWithdrawalAmount: number
  firstTransactionAt?: string
  lastTransactionAt?: string
  byCity: TransactionSummaryItemDto[]
  byType: TransactionSummaryItemDto[]
  byResult: TransactionSummaryItemDto[]
}

export interface AlertDto {
  id: number
  atmId: string
  atmName?: string
  city?: string
  location?: string
  runId?: string
  flowKey?: string
  sourceEventType?: string
  alertType: string
  severity: string
  category: string
  device: string
  message: string
  operationalImpact: string
  recommendedAction: string
  triggeredAt: string
  simulatedAt?: string
}

export interface RunSummaryDto {
  runId: string
  scenarioName: string
  randomSeed: number
  status: string
  atmCount: number
  speedMultiplier: number
  startedAtReal: string
  endedAtReal?: string
  startedAtSimulated: string
  endedAtSimulated?: string
  plannedEndAtSimulated?: string
  operationalLoadEnabled: boolean
  baseTransactionsPerAtmHour: number
  hourlyActivityPercentages: number[]
  durationSimulatedMinutes?: number
  completionReason?: string
  totalEvents: number
  eventsUnder2SecPercent: number
  avgAbsolutePercError: number
  stateMatchPercent: number
  withdrawalsTotal: number
  withdrawalsSuccessful: number
  withdrawalsFailed: number
  inquiriesTotal: number
  inquiriesSuccessful: number
  inquiriesFailed: number
  technicalFailures: number
  avgUiLatencyMs: number
  maxUiLatencyMs: number
}

export interface ActiveRunDto {
  runId: string
  scenarioName: string
  randomSeed: number
  status: string
  atmCount: number
  speedMultiplier: number
  startedAtReal: string
  endedAtReal?: string
  startedAtSimulated: string
  endedAtSimulated?: string
  plannedEndAtSimulated?: string
  operationalLoadEnabled: boolean
  baseTransactionsPerAtmHour: number
  hourlyActivityPercentages: number[]
  completionReason?: string
}

export interface ThesisValidationDto {
  totalEvents: number
  criticalEvents: number
  registeredIncidents: number
  normalizedIncidents: number
  completedRuns: number
  latestRun?: {
    runId: string
    scenarioName: string
    totalEvents: number
    eventsUnder2SecPercent: number
    avgAbsolutePercError: number
    stateMatchPercent: number
    latencyGoalMet: boolean
    cashErrorGoalMet: boolean
    stateGoalMet: boolean
  } | null
}

export interface CashEstimationCassetteDto {
  cassetteKey: string
  denomination: number
  currentBillCount: number
  projectedBillCount: number
  capacityInBills: number
  criticalThresholdBills: number
  isRejectCassette: boolean
  cashState: string
  projectedState: string
  consumptionRateBillsPerHour: number
  sampleTransactions: number
  sampleBills: number
  currentCash: number
  projectedCash: number
}

export interface CashEstimationAtmDto {
  atmId: string
  displayName: string
  city: string
  location: string
  status: string
  riskLevel: string
  currentCashTotal: number
  projectedCashTotal: number
  projectedCashDelta: number
  cassettes: CashEstimationCassetteDto[]
}

export interface CashEstimationDto {
  simulatedTime: string
  windowStart: string
  windowMinutes: number
  horizonMinutes: number
  maxTransactionsPerAtm: number
  sampleFlows: number
  sampleMovements: number
  atms: CashEstimationAtmDto[]
}

export interface UserDto {
  id: number
  username: string
  role: string
  createdAt: string
  lastLoginAt?: string | null
}
