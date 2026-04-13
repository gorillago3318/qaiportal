'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Megaphone, Calendar, CheckCircle2, Target, Scale } from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

export default function AgentCampaignsPage() {
  const [loading, setLoading] = React.useState(true)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [campaigns, setCampaigns] = React.useState<any[]>([])
  const [userId, setUserId] = React.useState<string>('')

  React.useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await fetch('/api/campaigns')
        const json = await res.json()
        if (json.data) {
          setCampaigns(json.data)
          setUserId(json.current_user_id)
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const markRead = async (campaignId: string) => {
    try {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('campaign_reads').insert({
        campaign_id: campaignId,
        user_id: userId
      })
      setCampaigns(prev => prev.map(c => 
        c.id === campaignId 
        ? { ...c, campaign_reads: [...(c.campaign_reads || []), { user_id: userId }] }
        : c
      ))
    } catch {
      // ignore
    }
  }

  if (loading) return <div>Loading campaigns...</div>

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">Campaigns & Targets</h1>
        <p className="text-muted-foreground text-sm mt-1">Updates, promotions, and your sales targets</p>
      </div>

      {campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground">
          <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
            <Megaphone className="h-8 w-8 opacity-50" />
          </div>
          <p className="font-semibold text-foreground">All caught up!</p>
          <p className="text-sm mt-1">No active campaigns at the moment.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {campaigns.map(c => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const isRead = c.campaign_reads?.some((r: any) => r.user_id === userId)
            
            // Progress Bar Logic
            const hasTarget = !!c.target_type && !!c.target_value
            const progress = c.agent_progress || 0
            const percentage = hasTarget ? Math.min(100, (progress / c.target_value) * 100) : 0
            const isComplete = hasTarget && progress >= c.target_value
            
            return (
              <Card key={c.id} className={`transition-colors border relative overflow-hidden ${isComplete ? 'border-emerald-500/50 bg-emerald-500/5' : (!isRead ? 'border-accent/40 bg-accent/5' : 'bg-background/80')}`}>
                {/* Progress bar background decoration */}
                {hasTarget && (
                  <div className={`absolute bottom-0 left-0 h-1 bg-gradient-to-r ${isComplete ? 'from-emerald-400 to-emerald-500' : 'from-accent to-blue-400'}`} style={{ width: `${percentage}%`, transition: 'width 1s ease-in-out' }} />
                )}
                
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap justify-between items-start gap-4">
                    <div>
                      <CardTitle className="text-xl font-bold mb-2">
                        {c.title}
                        {!isRead && <span className="ml-2 inline-flex h-2 w-2 rounded-full bg-accent" />}
                      </CardTitle>
                      <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-muted-foreground">
                        <div className="flex items-center gap-1.5 bg-muted/60 px-2 py-1 rounded-md">
                          <Calendar className="h-3.5 w-3.5" />
                          {c.target_start_date && c.target_end_date 
                            ? `${formatDate(c.target_start_date)} - ${formatDate(c.target_end_date)}`
                            : formatDate(c.published_at || c.created_at)}
                        </div>
                        {c.target_requires_panel_lawyer && (
                          <div className="flex items-center gap-1.5 bg-amber-500/10 text-amber-600 px-2 py-1 rounded-md">
                            <Scale className="h-3.5 w-3.5" />
                            Panel Lawyer Required
                          </div>
                        )}
                      </div>
                    </div>

                    {hasTarget && (
                      <div className={`text-right p-3 rounded-xl border ${isComplete ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-background shadow-sm border-border/50'}`}>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 justify-end">
                          <Target className="h-3 w-3" />
                          Your Progress
                        </div>
                        <div className={`text-lg font-bold font-heading ${isComplete ? 'text-emerald-500' : 'text-accent'}`}>
                          {c.target_type === 'volume' ? formatCurrency(progress) : progress} 
                          <span className="text-xs text-muted-foreground font-normal ml-1">
                            / {c.target_type === 'volume' ? formatCurrency(c.target_value) : c.target_value}
                          </span>
                        </div>
                        <div className="text-[10px] font-medium text-muted-foreground mt-0.5">
                          {percentage.toFixed(1)}% Achieved
                        </div>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed border-t border-border/50 pt-4">
                    {c.body}
                  </p>
                  
                  {!isRead && (
                    <div className="mt-6 flex justify-end">
                      <button 
                        onClick={() => markRead(c.id)}
                        className="flex items-center gap-2 text-xs font-semibold text-accent hover:text-accent/80 transition-colors"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Mark as Read
                      </button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
