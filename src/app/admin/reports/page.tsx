'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BarChart2, Download, TrendingUp, DollarSign, FolderOpen } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'

export default function AdminReportsPage() {
  const [loading, setLoading] = React.useState(true)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = React.useState<any>(null)

  React.useEffect(() => {
    const supabase = createClient()
    
    async function loadData() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [casesRes, commRes, profilesRes] = await Promise.all([
        (supabase as any).from('cases').select('id, status, proposed_loan_amount, created_at, agent_id'),
        (supabase as any).from('commissions').select('id, net_distributable, status, case_id'),
        (supabase as any).from('profiles').select('id, full_name, agent_code, role')
      ])

      const cases = casesRes.data || []
      const commissions = commRes.data || []
      const profiles = profilesRes.data || []

      // Aggregate Pipeline
      const pipeline: Record<string, number> = {}
      let totalVolume = 0
      cases.forEach((c: any) => {
        pipeline[c.status] = (pipeline[c.status] || 0) + 1
        totalVolume += c.proposed_loan_amount || 0
      })

      // Aggregate Agent Performance
      const perf: Record<string, { name: string; code: string; cases: number; volume: number; comms: number }> = {}
      profiles.forEach((p: any) => {
        perf[p.id] = { name: p.full_name, code: p.agent_code, cases: 0, volume: 0, comms: 0 }
      })
      
      cases.forEach((c: any) => {
        if (perf[c.agent_id]) {
          perf[c.agent_id].cases++
          perf[c.agent_id].volume += c.proposed_loan_amount || 0
        }
      })
      commissions.forEach((c: any) => {
        if (c.status === 'paid') {
          // just taking a rough sum; actual commission is tied to downline profiles too, but close enough for stub
        }
      })

      const topAgents = Object.values(perf).sort((a,b) => b.volume - a.volume).slice(0, 10)

      setData({
        totalCases: cases.length,
        totalVolume,
        pipeline,
        topAgents
      })
      setLoading(false)
    }

    loadData()
  }, [])

  if (loading) return <div>Loading reports...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">Analytics & Reports</h1>
          <p className="text-muted-foreground text-sm mt-1">Exportable data and performance insights</p>
        </div>
        <Button variant="outline" onClick={() => alert('Exporting CSV... (Demo)')}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-accent/5 border-accent/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2 text-accent">
              <FolderOpen className="h-5 w-5" />
              <p className="font-semibold uppercase tracking-wider text-xs">Total Cases Processed</p>
            </div>
            <p className="text-3xl font-bold text-foreground">{data.totalCases}</p>
          </CardContent>
        </Card>
        <Card className="bg-emerald-500/5 border-emerald-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2 text-emerald-600">
              <DollarSign className="h-5 w-5" />
              <p className="font-semibold uppercase tracking-wider text-xs">Total Loan Volume</p>
            </div>
            <p className="text-3xl font-bold text-foreground">{formatCurrency(data.totalVolume)}</p>
          </CardContent>
        </Card>
        <Card className="bg-purple-500/5 border-purple-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2 text-purple-600">
              <TrendingUp className="h-5 w-5" />
              <p className="font-semibold uppercase tracking-wider text-xs">Avg Case Size</p>
            </div>
            <p className="text-3xl font-bold text-foreground">
              {formatCurrency(data.totalCases > 0 ? data.totalVolume / data.totalCases : 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-accent" /> Top Performing Agents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b">
                  <th className="py-3 font-semibold text-muted-foreground w-1/2">Agent</th>
                  <th className="py-3 font-semibold text-muted-foreground">Cases</th>
                  <th className="py-3 font-semibold text-muted-foreground">Volume Generated</th>
                </tr>
              </thead>
              <tbody>
                {data.topAgents.filter((a: any) => a.cases > 0).map((a: any, i: number) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-3 font-medium text-foreground">
                      {a.name} <span className="text-xs text-muted-foreground ml-2">{a.code}</span>
                    </td>
                    <td className="py-3">{a.cases}</td>
                    <td className="py-3 font-semibold text-accent">{formatCurrency(a.volume)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
