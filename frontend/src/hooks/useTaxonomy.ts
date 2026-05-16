/**
 * useTaxonomy — State management hook for the B2B Query Intelligence module.
 * Isolated hook. Zero impact on existing hooks.
 */
import { useState, useCallback, useRef } from 'react'
import {
  listTaxonomyQueries,
  getSweetSpotQueries,
  getVerticalIntelligence,
  getOpportunityMatrix,
  runPipeline,
  ingestTaxonomy,
  type QueryListFilters,
  type QueryListResponse,
  type SweetSpotResponse,
  type VerticalsResponse,
  type OpportunityMatrixResponse,
  type PipelineRunResult,
  type IngestResponse,
} from '../api/taxonomyService'

// ── Query Explorer State ──────────────────────────────────────────────────────
export function useQueryExplorer() {
  const [data, setData] = useState<QueryListResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<QueryListFilters>({
    page: 1,
    page_size: 20,
  })

  const fetch = useCallback(async (overrides?: QueryListFilters) => {
    const merged = overrides ? { ...filters, ...overrides } : filters
    if (overrides) {
      setFilters(merged)
    }
    setLoading(true)
    setError(null)
    try {
      const result = await listTaxonomyQueries(merged)
      setData(result)
    } catch (e: any) {
      setError(e.message ?? 'Failed to load queries')
    } finally {
      setLoading(false)
    }
  }, [filters])

  const updateFilter = useCallback((key: keyof QueryListFilters, value: string | number | undefined) => {
    const updated = { ...filters, [key]: value || undefined, page: 1 }
    setFilters(updated)
    return updated
  }, [filters])

  return { data, loading, error, filters, fetch, updateFilter, setFilters }
}

// ── Sweet Spot State ──────────────────────────────────────────────────────────
export function useSweetSpot() {
  const [data, setData] = useState<SweetSpotResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async (vertical?: string, limit = 50) => {
    setLoading(true)
    setError(null)
    try {
      const result = await getSweetSpotQueries(vertical, limit)
      setData(result)
    } catch (e: any) {
      setError(e.message ?? 'Failed to load sweet spot queries')
    } finally {
      setLoading(false)
    }
  }, [])

  return { data, loading, error, fetch }
}

// ── Verticals State ───────────────────────────────────────────────────────────
export function useVerticals() {
  const [data, setData] = useState<VerticalsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getVerticalIntelligence()
      setData(result)
    } catch (e: any) {
      setError(e.message ?? 'Failed to load verticals')
    } finally {
      setLoading(false)
    }
  }, [])

  return { data, loading, error, fetch }
}

// ── Opportunity Matrix State ──────────────────────────────────────────────────
export function useOpportunityMatrix() {
  const [data, setData] = useState<OpportunityMatrixResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async (vertical?: string) => {
    setLoading(true)
    setError(null)
    try {
      const result = await getOpportunityMatrix(vertical)
      setData(result)
    } catch (e: any) {
      setError(e.message ?? 'Failed to load opportunity matrix')
    } finally {
      setLoading(false)
    }
  }, [])

  return { data, loading, error, fetch }
}

// ── Pipeline Runner State ─────────────────────────────────────────────────────
export function usePipelineRunner() {
  const [result, setResult] = useState<PipelineRunResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef(false)

  const run = useCallback(async (keywordId: string, content = '') => {
    setLoading(true)
    setError(null)
    setResult(null)
    abortRef.current = false
    try {
      const res = await runPipeline(keywordId, content)
      if (!abortRef.current) setResult(res)
    } catch (e: any) {
      if (!abortRef.current) setError(e.message ?? 'Pipeline failed')
    } finally {
      if (!abortRef.current) setLoading(false)
    }
  }, [])

  const reset = useCallback(() => {
    abortRef.current = true
    setResult(null)
    setError(null)
    setLoading(false)
  }, [])

  return { result, loading, error, run, reset }
}

// ── Taxonomy Ingestion State ──────────────────────────────────────────────────
export function useIngest() {
  const [result, setResult] = useState<IngestResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ingest = useCallback(async (records: Parameters<typeof ingestTaxonomy>[0]) => {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await ingestTaxonomy(records)
      setResult(res)
      return res
    } catch (e: any) {
      setError(e.message ?? 'Ingestion failed')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { result, loading, error, ingest }
}
