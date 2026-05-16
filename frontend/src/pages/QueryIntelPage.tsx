import React, { useEffect, useState, useRef, createContext, useContext, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Brain, Search, Target, LayoutDashboard, PlayCircle, BarChart2, Upload } from 'lucide-react'
import * as XLSX from 'xlsx'
import CinematicLoader from '../components/ui/CinematicLoader'
import {
  useQueryExplorer,
  useSweetSpot,
  useVerticals,
  useOpportunityMatrix,
  usePipelineRunner,
} from '../hooks/useTaxonomy'
import { SEED_TAXONOMY, ingestTaxonomy, listTaxonomyQueries } from '../api/taxonomyService'
import { useScrollReveal } from '../hooks/useScrollReveal'

interface GlobalQueryState {
  queries: any[];
  refresh: () => void;
}
const QueryContext = createContext<GlobalQueryState>({ queries: [], refresh: () => {} })


const TABS = [
  { id: 'explorer', label: 'Query Explorer', icon: Search },
  { id: 'strategic-targets', label: 'Strategic Targets', icon: Target },
  { id: 'matrix', label: 'Opportunity Matrix', icon: LayoutDashboard },
  { id: 'verticals', label: 'Verticals', icon: BarChart2 },
  { id: 'pipeline', label: 'Pipeline Runner', icon: PlayCircle },
]

export default function QueryIntelPage() {
  const [activeTab, setActiveTab] = useState('explorer')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [ingestLogs, setIngestLogs] = useState<string[]>([])
  const [globalQueries, setGlobalQueries] = useState<any[]>([])
  
  useScrollReveal([activeTab])

  const fetchGlobalQueries = useCallback(async () => {
    try {
      const res = await listTaxonomyQueries({ page_size: 1000 })
      setGlobalQueries(res.queries)
    } catch (e) { console.error(e) }
  }, [])

  useEffect(() => {
    fetchGlobalQueries()
  }, [fetchGlobalQueries])


  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsProcessing(true)
    setIngestLogs(['→ Validating and reading taxonomy file...'])

    try {
      const data = await file.arrayBuffer()
      setIngestLogs(prev => [...prev, '→ Parsing Excel sheets...'])
      // Use header: 1 to get a 2D array of raw values to dynamically find headers
      const workbook = XLSX.read(data, { type: 'array' })

      const records: any[] = []
      const seenQueries = new Set<string>()
      
      const mapHighMedLow = (val: string | null | number) => {
        if (val === null || val === undefined || val === '') return null
        const v = String(val).toLowerCase().trim()
        if (v.includes('high') || v === '3' || v === '3.0') return 'High'
        if (v.includes('medium') || v.includes('med') || v === '2' || v === '2.0') return 'Medium'
        if (v.includes('low') || v === '1' || v === '1.0') return 'Low'
        return null
      }
      
      const mapFunnel = (val: string | null) => {
        if (!val) return null
        const v = val.toUpperCase()
        if (v.includes('TOFU')) return 'TOFU'
        if (v.includes('MOFU')) return 'MOFU'
        return null
      }

      let totalExtracted = 0

      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName]
        const json = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: '' })
        
        // Dynamically find the header row
        let headerRowIdx = -1;
        for (let i = 0; i < Math.min(20, json.length); i++) {
          const row = json[i];
          if (!row || !Array.isArray(row)) continue;
          const rowStrs = row.map(c => String(c).trim().toLowerCase());
          if (rowStrs.some(c => c === 'search query' || c === 'keyword' || c === 'query' || c.includes('query'))) {
            headerRowIdx = i;
            break;
          }
        }

        if (headerRowIdx === -1) {
          console.log(`Skipping sheet "${sheetName}": No query/keyword column found.`);
          continue;
        }

        const headers = json[headerRowIdx].map(c => String(c).trim().toLowerCase());
        console.log(`[Taxonomy Debug] Detected Headers on sheet "${sheetName}":`, headers);
        
        for (let i = headerRowIdx + 1; i < json.length; i++) {
          const row = json[i];
          if (!row || !Array.isArray(row) || row.length === 0) continue;
          
          console.log(`[Taxonomy Debug] Parsing Row ${i}:`, row);
          let vertical = sheetName // Default vertical to sheet name
          let buyerIntent: string | null = null
          let novelty: string | null = null
          let funnel: string | null = null
          let priority: string | null = null
          let buyerSegment: string | null = null
          let queryCluster: string | null = null
          
          let hasData = false;
          
          const isMatch = (header: string, keywords: string[]) => keywords.some(k => header.includes(k));
          
          for (let j = 0; j < headers.length; j++) {
            const hk = String(headers[j] || '').toLowerCase().trim();
            const val = String(row[j] || '').trim();
            if (!val || !hk) continue;
            hasData = true;

            if (isMatch(hk, ['search query', 'keyword', 'query'])) query = val;
            else if (isMatch(hk, ['vertical'])) vertical = val;
            else if (isMatch(hk, ['buyer intent', 'buyer_intent', 'intent'])) buyerIntent = val;
            else if (isMatch(hk, ['novelty', 'novelty_opportunity'])) novelty = val;
            else if (isMatch(hk, ['funnel', 'stage'])) funnel = val;
            else if (isMatch(hk, ['priority', 'priority matrix', 'priority group'])) priority = val;
            else if (isMatch(hk, ['buyer segment', 'buyer_segment', 'persona'])) buyerSegment = val;
            else if (isMatch(hk, ['query cluster', 'query_cluster', 'topic'])) queryCluster = val;
          }

          if (hasData && query && query.length > 1) {
            const normalized = {
              query: query.substring(0, 500),
              vertical: vertical.substring(0, 100),
              buyer_intent_score: mapHighMedLow(buyerIntent),
              novelty_opportunity: mapHighMedLow(novelty),
              funnel_stage: mapFunnel(funnel),
              priority_matrix: priority ? String(priority).substring(0, 50) : null,
              buyer_segment: buyerSegment,
              query_cluster: queryCluster ? String(queryCluster).substring(0, 100) : null,
            };

            console.log("[Taxonomy Debug] Normalized Query Object:", normalized);

            const dedupKey = `${query.toLowerCase()}-${vertical.toLowerCase()}`
            if (!seenQueries.has(dedupKey)) {
              seenQueries.add(dedupKey)
              records.push(normalized)
              totalExtracted++
            }
          }
        }
      }

      console.log(`Extracted ${records.length} queries:`, records)
      setIngestLogs(prev => [...prev, `→ Extracted ${records.length} queries. Building query intelligence...`])
      
      if (records.length === 0) {
        throw new Error('No valid queries found. Ensure the sheet has a "Search Query" or "Keyword" column.')
      }

      // Direct API call lets 422 Validation Errors and 500 Server Errors bubble up natively
      const result = await ingestTaxonomy(records)
      
      if (result) {
        if (result.errors && result.errors.length > 0 && result.inserted === 0 && result.updated === 0) {
           throw new Error(`Ingestion rejected by server: ${result.errors[0]}`)
        }
        
        console.log("Ingestion result:", result)
        setIngestLogs(prev => [...prev, `→ Successfully ingested ${result.inserted} new queries, updated ${result.updated}. Refreshing UI...`])
        
        await fetchGlobalQueries()
        
        // Remove window reload, just let React remount the tabs to trigger fresh fetches
        setTimeout(() => {
          setIsProcessing(false)
        }, 2500)
      }
    } catch (err: any) {
      console.error("Ingestion Error:", err)
      setIngestLogs(prev => [...prev, `→ Error: ${err.message}`])
      setTimeout(() => setIsProcessing(false), 6000)
    }
    
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <QueryContext.Provider value={{ queries: globalQueries, refresh: fetchGlobalQueries }}>
      <div className="min-h-screen pt-8 pb-20 px-4 max-w-7xl mx-auto space-y-6 relative z-10">
      <div className="flex items-center justify-between reveal">
        <div className="flex items-center gap-3">
          <Brain className="w-8 h-8 text-[var(--aurora)]" />
          <h1 className="page-title gradient-text">Query Intelligence</h1>
        </div>
        <div className="flex items-center gap-3">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileSelect} 
            accept=".xlsx,.xls,.csv" 
            className="hidden" 
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className="btn-secondary text-xs flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            {isProcessing ? 'Processing...' : 'Ingest Seed Taxonomy'}
          </button>
        </div>
      </div>

      <div className="flex justify-center border-b border-[var(--border-subtle)] pb-4 reveal">
        <div className="flex gap-2 p-1 bg-[var(--bg-depth)] rounded-lg overflow-x-auto max-w-full">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === t.id 
                  ? 'bg-[var(--aurora)] text-[var(--bg-base)] shadow-lg shadow-[var(--aurora)]/20' 
                  : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="reveal">
        <CinematicLoader
          isLoading={isProcessing}
          logs={ingestLogs}
          label="Taxonomy Ingestion"
          subLabel="B2B Query Intelligence Engine"
        />
        {!isProcessing && (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'explorer' && <QueryExplorerTab />}
              {activeTab === 'strategic-targets' && <StrategicTargetsTab />}
              {activeTab === 'matrix' && <OpportunityMatrixTab />}
              {activeTab === 'verticals' && <VerticalsTab />}
              {activeTab === 'pipeline' && <PipelineTab />}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
      </div>
    </QueryContext.Provider>
  )
}

function QueryExplorerTab() {
  const { data, loading, fetch, filters, updateFilter } = useQueryExplorer()
  useEffect(() => { fetch() }, [fetch])

  return (
    <div className="space-y-4">
      <div className="flex gap-4 flex-wrap">
        <input 
          placeholder="Search queries..." 
          className="flex-1 min-w-[200px]"
          value={filters.search || ''}
          onChange={e => updateFilter('search', e.target.value)}
        />
        <select value={filters.buyer_intent || ''} onChange={e => updateFilter('buyer_intent', e.target.value)}>
          <option value="">All Intent</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
        <select value={filters.vertical || ''} onChange={e => updateFilter('vertical', e.target.value)}>
          <option value="">All Verticals</option>
          <option value="accounting_finance">Accounting & Finance</option>
          <option value="banking_lending">Banking & Lending</option>
          <option value="investment_wealth">Investment & Wealth</option>
          <option value="sap_supply_chain">SAP & Supply Chain</option>
        </select>
      </div>

      {loading ? <div className="text-center py-10">Loading...</div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.queries.map(q => (
            <div key={q.id} className="card p-5 space-y-3">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider">{q.vertical}</span>
                <span className="text-[10px] font-mono text-[var(--aurora)] bg-[var(--aurora)]/10 px-2 py-0.5 rounded-full">
                  Opportunity Score: {Math.round(q.opportunity_score || 0)}
                </span>
              </div>
              <h3 className="font-medium text-[var(--text-primary)]">{q.query}</h3>
              <div className="flex gap-2 flex-wrap">
                <span className="tag">Intent: {q.buyer_intent_score || 'N/A'}</span>
                <span className="tag">Novelty: {q.novelty_opportunity || 'N/A'}</span>
                <span className="tag">Priority: {q.priority_matrix || 'N/A'}</span>
              </div>
            </div>
          ))}
          {(!data?.queries || data.queries.length === 0) && (
            <div className="col-span-full py-8 text-center text-[var(--text-muted)]">No queries found. Click "Ingest Seed Taxonomy" to load data.</div>
          )}
        </div>
      )}
    </div>
  )
}

function StrategicTargetsTab() {
  const { data, loading, fetch } = useSweetSpot()
  useEffect(() => { fetch() }, [fetch])

  return (
    <div className="space-y-4">
      {loading ? <div className="text-center py-10">Loading...</div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.queries.map(q => (
            <div key={q.id} className="card p-5 space-y-3">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider">{q.vertical}</span>
                <span className="text-[10px] font-mono text-[var(--aurora)] bg-[var(--aurora)]/10 px-2 py-0.5 rounded-full">Opportunity Score: {Math.round(q.opportunity_score)}</span>
              </div>
              <h3 className="font-medium text-[var(--text-primary)]">{q.query}</h3>
              <div className="flex gap-2">
                <span className="tag">Intent: {q.buyer_intent_score}</span>
                <span className="tag">Novelty: {q.novelty_opportunity}</span>
              </div>
            </div>
          ))}
          {(!data?.queries || data.queries.length === 0) && <div className="text-[var(--text-muted)] col-span-3">No strategic targets found.</div>}
        </div>
      )}
    </div>
  )
}

function OpportunityMatrixTab() {
  const { data, loading, fetch } = useOpportunityMatrix()
  useEffect(() => { fetch() }, [fetch])

  return (
    <div className="space-y-4">
      {loading ? <div className="text-center py-10">Loading...</div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {['Strategic Targets', 'Commercial', 'Experimental', 'Low Value'].map(quadrant => (
            <div key={quadrant} className="card p-5 h-64 overflow-y-auto">
              <h3 className="font-bold text-[var(--aurora)] mb-4">{quadrant} ({data?.quadrant_counts[quadrant] || 0})</h3>
              <ul className="space-y-2">
                {data?.points.filter(p => p.quadrant === quadrant).map(p => (
                  <li key={p.id} className="text-sm text-[var(--text-secondary)] border-b border-[var(--border-subtle)] pb-2">{p.query}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function VerticalsTab() {
  const { data, loading, fetch } = useVerticals()
  useEffect(() => { fetch() }, [fetch])

  return (
    <div className="space-y-4">
      {loading ? <div className="text-center py-10">Loading...</div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data?.verticals.map(v => (
            <div key={v.vertical} className="card p-5 space-y-4">
              <div className="flex justify-between items-center border-b border-[var(--border-subtle)] pb-3">
                <h3 className="font-bold text-lg text-[var(--text-primary)]">{v.display_name}</h3>
                <span className="text-2xl font-light text-[var(--aurora)]">{v.total_queries}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-[var(--text-muted)]">Strategic Targets:</span> {v.sweet_spot_count}</div>
                <div><span className="text-[var(--text-muted)]">High Intent:</span> {v.high_intent_count}</div>
                <div><span className="text-[var(--text-muted)]">Entities:</span> {v.entity_count}</div>
                <div><span className="text-[var(--text-muted)]">Avg Opp:</span> {Math.round(v.avg_opportunity_score)}</div>
              </div>
              <div>
                <h4 className="text-xs font-mono text-[var(--text-muted)] uppercase mb-2">Top Queries</h4>
                <ul className="text-sm text-[var(--text-secondary)] space-y-1">
                  {v.top_queries.map(q => <li key={q}>• {q}</li>)}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PipelineTab() {
  const { queries } = useContext(QueryContext)
  const { run, result, loading, error } = usePipelineRunner()
  const [selectedKeywordId, setSelectedKeywordId] = useState('')
  const [content, setContent] = useState('')

  const handleRun = () => {
    if (selectedKeywordId) run(selectedKeywordId, content)
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="card p-5 space-y-4">
        <h3 className="font-bold">1. Select Taxonomy Query</h3>
        <select 
          className="w-full bg-[var(--bg-depth)] border border-[var(--border-subtle)] rounded p-2 text-sm text-[var(--text-primary)]"
          value={selectedKeywordId}
          onChange={e => setSelectedKeywordId(e.target.value)}
        >
          <option value="">-- Choose Query --</option>
          {queries.map(q => (
            <option key={q.id} value={q.id}>
              {q.query} ({q.vertical}) {q.buyer_intent_score ? `— Intent: ${q.buyer_intent_score}` : ''}
            </option>
          ))}
        </select>
        {queries.length === 0 && (
           <div className="text-xs text-[var(--coral)]">No queries available. Please ingest a taxonomy first.</div>
        )}
        
        <h3 className="font-bold pt-4">2. Seed Content (Optional)</h3>
        <textarea 
          className="w-full h-32" 
          placeholder="Paste content here or leave blank to synthesize from query..."
          value={content}
          onChange={e => setContent(e.target.value)}
        />
        
        <button 
          onClick={handleRun} 
          disabled={!selectedKeywordId || loading}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          {loading ? 'Running Pipeline...' : <><PlayCircle className="w-4 h-4"/> Execute Full Pipeline</>}
        </button>
        {error && <div className="text-[var(--coral)] text-sm">{error}</div>}
      </div>

      <div className="card p-5">
        <h3 className="font-bold mb-4">Pipeline Results</h3>
        {!result && !loading && <div className="text-[var(--text-muted)] text-sm">Select a query and run the pipeline to see results.</div>}
        {loading && <div className="text-[var(--aurora)] animate-pulse">Processing semantic novelty, authority, and ranking...</div>}
        {result && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
              <span className="text-[var(--text-muted)] text-sm">Query:</span>
              <span className="font-medium">{result.keyword_query}</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="bg-[var(--bg-depth)] p-3 rounded-lg border border-[var(--border-subtle)]">
                <div className="text-xs text-[var(--text-muted)] mb-1">Novelty Score</div>
                <div className="text-xl text-[var(--aurora)] font-bold">{result.novelty_score.toFixed(2)}</div>
                <div className="text-[10px] text-[var(--text-muted)]">Target: {result.novelty_calibrated_min}-{result.novelty_calibrated_max}</div>
              </div>
              <div className="bg-[var(--bg-depth)] p-3 rounded-lg border border-[var(--border-subtle)]">
                <div className="text-xs text-[var(--text-muted)] mb-1">Predicted Rank</div>
                <div className="text-xl font-bold">#{result.predicted_rank}</div>
              </div>
              <div className="bg-[var(--bg-depth)] p-3 rounded-lg border border-[var(--border-subtle)]">
                <div className="text-xs text-[var(--text-muted)] mb-1">Authority</div>
                <div className="text-xl font-bold">{result.authority_score.toFixed(2)}</div>
              </div>
              <div className="bg-[var(--bg-depth)] p-3 rounded-lg border border-[var(--border-subtle)]">
                <div className="text-xs text-[var(--text-muted)] mb-1">Opportunity</div>
                <div className="text-xl font-bold">{Math.round(result.opportunity_score)}</div>
              </div>
            </div>
            
            {result.recommendations.length > 0 && (
              <div className="pt-4">
                <h4 className="text-sm font-bold text-[var(--aurora)] mb-2">Recommendations</h4>
                <ul className="text-xs text-[var(--text-secondary)] space-y-1">
                  {result.recommendations.map((r, i) => <li key={i}>• {r}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
