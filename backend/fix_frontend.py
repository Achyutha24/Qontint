import re

with open(r"c:\Users\achyu\Desktop\Qontint\frontend\src\pages\QueryIntelPage.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Imports & Context
content = content.replace(
    "import React, { useEffect, useState, useRef } from 'react'",
    "import React, { useEffect, useState, useRef, createContext, useContext, useCallback } from 'react'"
)

context_code = """import { useScrollReveal } from '../hooks/useScrollReveal'

interface GlobalQueryState {
  queries: any[];
  refresh: () => void;
}
const QueryContext = createContext<GlobalQueryState>({ queries: [], refresh: () => {} })
"""
content = content.replace("import { useScrollReveal } from '../hooks/useScrollReveal'", context_code)

# 2. Add listTaxonomyQueries import
content = content.replace(
    "import { SEED_TAXONOMY, ingestTaxonomy } from '../api/taxonomyService'",
    "import { SEED_TAXONOMY, ingestTaxonomy, listTaxonomyQueries } from '../api/taxonomyService'"
)

# 3. Add global state to QueryIntelPage
state_code = """export default function QueryIntelPage() {
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
"""
content = content.replace(
    """export default function QueryIntelPage() {
  const [activeTab, setActiveTab] = useState('explorer')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [ingestLogs, setIngestLogs] = useState<string[]>([])
  
  useScrollReveal([activeTab])""",
    state_code
)

# 4. Fix mapHighMedLow
map_code_old = """      const mapHighMedLow = (val: string | null) => {
        if (!val) return null
        const v = val.toLowerCase()
        if (v.includes('high')) return 'High'
        if (v.includes('medium') || v.includes('med')) return 'Medium'
        if (v.includes('low')) return 'Low'
        return null
      }"""
map_code_new = """      const mapHighMedLow = (val: string | null | number) => {
        if (val === null || val === undefined || val === '') return null
        const v = String(val).toLowerCase().trim()
        if (v.includes('high') || v === '3' || v === '3.0') return 'High'
        if (v.includes('medium') || v.includes('med') || v === '2' || v === '2.0') return 'Medium'
        if (v.includes('low') || v === '1' || v === '1.0') return 'Low'
        return null
      }"""
content = content.replace(map_code_old, map_code_new)

# 5. Call fetchGlobalQueries on success
content = content.replace(
    """        setIngestLogs(prev => [...prev, `→ Successfully ingested ${result.inserted} new queries, updated ${result.updated}. Refreshing UI...`])
        
        // Remove window reload, just let React remount the tabs to trigger fresh fetches
        setTimeout(() => {""",
    """        setIngestLogs(prev => [...prev, `→ Successfully ingested ${result.inserted} new queries, updated ${result.updated}. Refreshing UI...`])
        
        await fetchGlobalQueries()
        
        // Remove window reload, just let React remount the tabs to trigger fresh fetches
        setTimeout(() => {"""
)

# 6. Wrap Provider
content = content.replace(
    """  return (
    <div className="min-h-screen pt-8 pb-20 px-4 max-w-7xl mx-auto space-y-6 relative z-10">""",
    """  return (
    <QueryContext.Provider value={{ queries: globalQueries, refresh: fetchGlobalQueries }}>
      <div className="min-h-screen pt-8 pb-20 px-4 max-w-7xl mx-auto space-y-6 relative z-10">"""
)
content = content.replace(
    """    </div>
  )
}

function QueryExplorerTab() {""",
    """      </div>
    </QueryContext.Provider>
  )
}

function QueryExplorerTab() {"""
)

# 7. Fix scores
content = content.replace("Opportunity Score: {Math.round(q.opportunity_score * 100)}", "Opportunity Score: {Math.round(q.opportunity_score)}")
content = content.replace("Avg Opp:</span> {Math.round(v.avg_opportunity_score * 100)}", "Avg Opp:</span> {Math.round(v.avg_opportunity_score)}")
content = content.replace('<div className="text-xl font-bold">{Math.round(result.opportunity_score * 100)}</div>', '<div className="text-xl font-bold">{Math.round(result.opportunity_score)}</div>')

# 8. Fix PipelineTab
pipeline_old = """function PipelineTab() {
  const { data: searchData, fetch: fetchSearch } = useQueryExplorer()
  const { run, result, loading, error } = usePipelineRunner()
  const [selectedKeywordId, setSelectedKeywordId] = useState('')
  const [content, setContent] = useState('')

  useEffect(() => { fetchSearch() }, [fetchSearch])

  const handleRun = () => {
    if (selectedKeywordId) run(selectedKeywordId, content)
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="card p-5 space-y-4">
        <h3 className="font-bold">1. Select Taxonomy Query</h3>
        <select 
          className="w-full"
          value={selectedKeywordId}
          onChange={e => setSelectedKeywordId(e.target.value)}
        >
          <option value="">-- Choose Query --</option>
          {searchData?.queries.map(q => (
            <option key={q.id} value={q.id}>{q.query} ({q.vertical})</option>
          ))}
        </select>"""

pipeline_new = """function PipelineTab() {
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
        )}"""
content = content.replace(pipeline_old, pipeline_new)

with open(r"c:\Users\achyu\Desktop\Qontint\frontend\src\pages\QueryIntelPage.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("SUCCESS")
