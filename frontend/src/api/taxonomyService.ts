/**
 * Taxonomy Service — B2B Query Intelligence System
 * Isolated API layer. Zero impact on existing api calls.
 */
import { apiFetch } from './apiClient'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TaxonomyRecord {
  query: string
  vertical: string
  funnel_stage?: 'TOFU' | 'MOFU' | null
  buyer_intent_score?: 'High' | 'Medium' | 'Low' | null
  novelty_opportunity?: 'High' | 'Medium' | 'Low' | null
  priority_matrix?: string | null
  buyer_segment?: string | null
  notes?: string | null
  query_cluster?: string | null
  intent_type?: string | null
}

export interface IngestResponse {
  inserted: number
  updated: number
  skipped: number
  errors: string[]
  total_processed: number
}

export interface SweetSpotQuery {
  id: string
  query: string
  vertical: string
  funnel_stage: string | null
  buyer_intent_score: string | null
  novelty_opportunity: string | null
  priority_matrix: string | null
  buyer_segment: string | null
  opportunity_score: number
  novelty_range_min: number
  novelty_range_max: number
  recommended_order: number
}

export interface SweetSpotResponse {
  queries: SweetSpotQuery[]
  total: number
}

export interface PipelineRunResult {
  keyword_id: string
  keyword_query: string
  novelty_score: number
  novelty_calibrated_min: number
  novelty_calibrated_max: number
  passed: boolean
  predicted_rank: number
  authority_score: number
  opportunity_score: number
  recommendations: string[]
  processing_time_ms: number
}

export interface VerticalStats {
  vertical: string
  display_name: string
  total_queries: number
  sweet_spot_count: number
  high_intent_count: number
  high_novelty_count: number
  top_queries: string[]
  avg_opportunity_score: number
  serp_result_count: number
  entity_count: number
}

export interface VerticalsResponse {
  verticals: VerticalStats[]
}

export interface MatrixPoint {
  id: string
  query: string
  vertical: string
  buyer_intent: string
  novelty_opportunity: string
  opportunity_score: number
  quadrant: string
  funnel_stage: string | null
}

export interface OpportunityMatrixResponse {
  points: MatrixPoint[]
  quadrant_counts: Record<string, number>
  total: number
}

export interface TaxonomyQueryItem {
  id: string
  query: string
  vertical: string
  funnel_stage: string | null
  buyer_intent_score: string | null
  novelty_opportunity: string | null
  priority_matrix: string | null
  buyer_segment: string | null
  opportunity_score: number
  created_at: string
}

export interface QueryListResponse {
  queries: TaxonomyQueryItem[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface QueryListFilters {
  vertical?: string
  funnel_stage?: string
  buyer_intent?: string
  novelty_opportunity?: string
  priority_matrix?: string
  search?: string
  page?: number
  page_size?: number
}

// ── API Functions ─────────────────────────────────────────────────────────────

export async function ingestTaxonomy(records: TaxonomyRecord[]): Promise<IngestResponse> {
  return apiFetch<IngestResponse>('/api/v1/taxonomy/ingest', {
    method: 'POST',
    body: JSON.stringify({ records }),
  })
}

export async function getSweetSpotQueries(
  vertical?: string,
  limit = 50,
): Promise<SweetSpotResponse> {
  const params = new URLSearchParams()
  if (vertical) params.set('vertical', vertical)
  params.set('limit', String(limit))
  return apiFetch<SweetSpotResponse>(`/api/v1/taxonomy/sweet-spot?${params}`)
}

export async function runPipeline(
  keywordId: string,
  content = '',
): Promise<PipelineRunResult> {
  return apiFetch<PipelineRunResult>('/api/v1/taxonomy/pipeline-run', {
    method: 'POST',
    body: JSON.stringify({ keyword_id: keywordId, content }),
  })
}

export async function getVerticalIntelligence(): Promise<VerticalsResponse> {
  return apiFetch<VerticalsResponse>('/api/v1/taxonomy/verticals')
}

export async function getOpportunityMatrix(
  vertical?: string,
): Promise<OpportunityMatrixResponse> {
  const params = new URLSearchParams()
  if (vertical) params.set('vertical', vertical)
  return apiFetch<OpportunityMatrixResponse>(`/api/v1/taxonomy/opportunity-matrix?${params}`)
}

export async function listTaxonomyQueries(
  filters: QueryListFilters = {},
): Promise<QueryListResponse> {
  const params = new URLSearchParams()
  if (filters.vertical) params.set('vertical', filters.vertical)
  if (filters.funnel_stage) params.set('funnel_stage', filters.funnel_stage)
  if (filters.buyer_intent) params.set('buyer_intent', filters.buyer_intent)
  if (filters.novelty_opportunity) params.set('novelty_opportunity', filters.novelty_opportunity)
  if (filters.priority_matrix) params.set('priority_matrix', filters.priority_matrix)
  if (filters.search) params.set('search', filters.search)
  if (filters.page) params.set('page', String(filters.page))
  if (filters.page_size) params.set('page_size', String(filters.page_size))
  return apiFetch<QueryListResponse>(`/api/v1/taxonomy/queries?${params}`)
}

// ── Taxonomy seed data — representative B2B Fintech queries ──────────────────
export const SEED_TAXONOMY: TaxonomyRecord[] = [
  // Accounting & Finance
  { query: 'AI invoice automation software', vertical: 'accounting_finance', funnel_stage: 'MOFU', buyer_intent_score: 'High', novelty_opportunity: 'High', buyer_segment: 'CFO, Finance Director', query_cluster: 'Invoice Automation' },
  { query: 'automated accounts payable workflow', vertical: 'accounting_finance', funnel_stage: 'TOFU', buyer_intent_score: 'Medium', novelty_opportunity: 'High', buyer_segment: 'AP Manager', query_cluster: 'AP Automation' },
  { query: 'AI financial close automation', vertical: 'accounting_finance', funnel_stage: 'MOFU', buyer_intent_score: 'High', novelty_opportunity: 'High', buyer_segment: 'Controller, CFO', query_cluster: 'Financial Close' },
  { query: 'real-time cash flow forecasting AI', vertical: 'accounting_finance', funnel_stage: 'MOFU', buyer_intent_score: 'High', novelty_opportunity: 'Medium', buyer_segment: 'Treasurer, CFO', query_cluster: 'Cash Management' },
  { query: 'intelligent document processing finance', vertical: 'accounting_finance', funnel_stage: 'TOFU', buyer_intent_score: 'Medium', novelty_opportunity: 'High', buyer_segment: 'Finance Ops', query_cluster: 'IDP' },
  { query: 'expense management AI platform', vertical: 'accounting_finance', funnel_stage: 'MOFU', buyer_intent_score: 'High', novelty_opportunity: 'Medium', buyer_segment: 'CFO, Procurement', query_cluster: 'Expense Management' },
  { query: 'accounts receivable automation software', vertical: 'accounting_finance', funnel_stage: 'MOFU', buyer_intent_score: 'High', novelty_opportunity: 'Medium', buyer_segment: 'AR Manager, CFO', query_cluster: 'AR Automation' },
  { query: 'AI-powered audit risk assessment', vertical: 'accounting_finance', funnel_stage: 'TOFU', buyer_intent_score: 'Medium', novelty_opportunity: 'High', buyer_segment: 'Auditor, Risk Officer', query_cluster: 'Audit AI' },
  { query: 'tax compliance automation enterprise', vertical: 'accounting_finance', funnel_stage: 'MOFU', buyer_intent_score: 'High', novelty_opportunity: 'Low', buyer_segment: 'Tax Director', query_cluster: 'Tax Compliance' },
  { query: 'multi-entity consolidation software', vertical: 'accounting_finance', funnel_stage: 'MOFU', buyer_intent_score: 'High', novelty_opportunity: 'Medium', buyer_segment: 'Group CFO', query_cluster: 'Consolidation' },

  // Banking & Lending
  { query: 'AI fraud detection banking solutions', vertical: 'banking_lending', funnel_stage: 'MOFU', buyer_intent_score: 'High', novelty_opportunity: 'Medium', buyer_segment: 'Risk Officer, CTO', query_cluster: 'Fraud Detection' },
  { query: 'automated loan origination system', vertical: 'banking_lending', funnel_stage: 'MOFU', buyer_intent_score: 'High', novelty_opportunity: 'High', buyer_segment: 'Lending Director', query_cluster: 'Loan Origination' },
  { query: 'AI credit scoring platform', vertical: 'banking_lending', funnel_stage: 'MOFU', buyer_intent_score: 'High', novelty_opportunity: 'High', buyer_segment: 'Credit Risk, CTO', query_cluster: 'Credit Scoring' },
  { query: 'KYC automation fintech', vertical: 'banking_lending', funnel_stage: 'TOFU', buyer_intent_score: 'Medium', novelty_opportunity: 'Medium', buyer_segment: 'Compliance Officer', query_cluster: 'KYC/AML' },
  { query: 'AML transaction monitoring AI', vertical: 'banking_lending', funnel_stage: 'MOFU', buyer_intent_score: 'High', novelty_opportunity: 'Medium', buyer_segment: 'AML Officer', query_cluster: 'KYC/AML' },
  { query: 'open banking API integration', vertical: 'banking_lending', funnel_stage: 'TOFU', buyer_intent_score: 'Medium', novelty_opportunity: 'High', buyer_segment: 'Product Manager, CTO', query_cluster: 'Open Banking' },
  { query: 'embedded lending platform B2B', vertical: 'banking_lending', funnel_stage: 'MOFU', buyer_intent_score: 'High', novelty_opportunity: 'High', buyer_segment: 'Fintech CEO, CTO', query_cluster: 'Embedded Finance' },
  { query: 'commercial mortgage automation software', vertical: 'banking_lending', funnel_stage: 'MOFU', buyer_intent_score: 'High', novelty_opportunity: 'Medium', buyer_segment: 'Mortgage Director', query_cluster: 'Mortgage Tech' },

  // Investment & Wealth
  { query: 'wealth management AI platforms', vertical: 'investment_wealth', funnel_stage: 'TOFU', buyer_intent_score: 'Medium', novelty_opportunity: 'Medium', buyer_segment: 'Wealth Manager, CIO', query_cluster: 'Wealth AI' },
  { query: 'AI portfolio optimization software', vertical: 'investment_wealth', funnel_stage: 'MOFU', buyer_intent_score: 'High', novelty_opportunity: 'High', buyer_segment: 'Portfolio Manager, CIO', query_cluster: 'Portfolio Management' },
  { query: 'robo-advisory platform enterprise', vertical: 'investment_wealth', funnel_stage: 'MOFU', buyer_intent_score: 'High', novelty_opportunity: 'Medium', buyer_segment: 'Wealth Director', query_cluster: 'Robo Advisory' },
  { query: 'ESG investment analytics platform', vertical: 'investment_wealth', funnel_stage: 'TOFU', buyer_intent_score: 'Medium', novelty_opportunity: 'High', buyer_segment: 'ESG Officer, CIO', query_cluster: 'ESG Analytics' },
  { query: 'alternative investment data platform', vertical: 'investment_wealth', funnel_stage: 'MOFU', buyer_intent_score: 'High', novelty_opportunity: 'High', buyer_segment: 'Quant, CIO', query_cluster: 'Alt Data' },
  { query: 'institutional trading algorithm AI', vertical: 'investment_wealth', funnel_stage: 'MOFU', buyer_intent_score: 'High', novelty_opportunity: 'High', buyer_segment: 'Quant Trader, CTO', query_cluster: 'Algo Trading' },
  { query: 'family office software platform', vertical: 'investment_wealth', funnel_stage: 'MOFU', buyer_intent_score: 'High', novelty_opportunity: 'Medium', buyer_segment: 'Family Office Manager', query_cluster: 'Family Office' },
  { query: 'private equity deal analytics AI', vertical: 'investment_wealth', funnel_stage: 'MOFU', buyer_intent_score: 'High', novelty_opportunity: 'High', buyer_segment: 'PE Principal, MD', query_cluster: 'PE Analytics' },

  // SAP & AI Supply Chain
  { query: 'SAP AI supply chain analytics', vertical: 'sap_supply_chain', funnel_stage: 'MOFU', buyer_intent_score: 'High', novelty_opportunity: 'High', buyer_segment: 'CIO, SCM Director', query_cluster: 'SAP AI' },
  { query: 'SAP S/4HANA implementation partner', vertical: 'sap_supply_chain', funnel_stage: 'MOFU', buyer_intent_score: 'High', novelty_opportunity: 'Low', buyer_segment: 'CIO, IT Director', query_cluster: 'SAP Implementation' },
  { query: 'AI demand forecasting supply chain', vertical: 'sap_supply_chain', funnel_stage: 'TOFU', buyer_intent_score: 'Medium', novelty_opportunity: 'High', buyer_segment: 'SCM Director, COO', query_cluster: 'Demand Forecasting' },
  { query: 'intelligent procurement automation SAP', vertical: 'sap_supply_chain', funnel_stage: 'MOFU', buyer_intent_score: 'High', novelty_opportunity: 'High', buyer_segment: 'CPO, Procurement Director', query_cluster: 'Procurement AI' },
  { query: 'supply chain digital twin platform', vertical: 'sap_supply_chain', funnel_stage: 'TOFU', buyer_intent_score: 'Medium', novelty_opportunity: 'High', buyer_segment: 'COO, CTO', query_cluster: 'Digital Twin' },
  { query: 'SAP Ariba spend analytics AI', vertical: 'sap_supply_chain', funnel_stage: 'MOFU', buyer_intent_score: 'High', novelty_opportunity: 'Medium', buyer_segment: 'CPO, Finance', query_cluster: 'Spend Analytics' },
  { query: 'warehouse management AI optimization', vertical: 'sap_supply_chain', funnel_stage: 'MOFU', buyer_intent_score: 'High', novelty_opportunity: 'High', buyer_segment: 'Operations Director, COO', query_cluster: 'Warehouse AI' },
  { query: 'supplier risk intelligence platform', vertical: 'sap_supply_chain', funnel_stage: 'TOFU', buyer_intent_score: 'Medium', novelty_opportunity: 'High', buyer_segment: 'CPO, Risk Officer', query_cluster: 'Supplier Risk' },
]
