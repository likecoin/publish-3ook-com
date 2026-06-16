export interface PlusReadingReportEntry {
  periodId: string
  classId: string
  amountCents: number
  currency: string
  status: 'paid' | 'pending'
  readingTimeMs: number
  ttsTimeMs: number
  readRatePerMin: number
  ttsRatePerMin: number
  transferId?: string
  updatedAt?: number
}

export interface PlusReadingReport {
  payouts: PlusReadingReportEntry[]
  summary: {
    totalCents: number
    paidCents: number
    pendingCents: number
    periodCount: number
    bookCount: number
  }
}

export interface PlusReadingStatsEntry {
  classId: string
  periodId: string
  readingTimeMs: number
  ttsTimeMs: number
  // Non-rev-share engagement (owned/non-Plus reads). Optional: absent from older
  // API responses that predate the field.
  nonLibraryReadingTimeMs?: number
  nonLibraryTtsTimeMs?: number
}

export interface PlusReadingStats {
  stats: PlusReadingStatsEntry[]
  summary: {
    totalReadingTimeMs: number
    totalTTSTimeMs: number
    totalNonLibraryReadingTimeMs?: number
    totalNonLibraryTTSTimeMs?: number
    bookCount: number
    periodCount: number
  }
}
