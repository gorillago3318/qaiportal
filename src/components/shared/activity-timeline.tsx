"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { Activity, MessageCircle, GitCommit, Upload } from "lucide-react"
import { CASE_STATUS_LABELS, type CaseStatus } from "@/types/database"

type StatusEntry = {
  id: string
  from_status: string | null
  to_status: string
  changed_by: string | null
  notes: string | null
  created_at: string
}
type CommentEntry = {
  id: string
  body: string | null
  user_id: string | null
  created_at: string
}
type DocumentEntry = {
  id: string
  document_type: string | null
  file_name: string | null
  uploaded_by: string | null
  created_at: string
}

type Actor = { id: string; full_name: string | null; role: string | null }

type Event =
  | { kind: "status"; at: string; actor: string | null; data: StatusEntry }
  | { kind: "comment"; at: string; actor: string | null; data: CommentEntry }
  | { kind: "document"; at: string; actor: string | null; data: DocumentEntry }

export function ActivityTimeline({ caseId }: { caseId: string }) {
  const [events, setEvents] = React.useState<Event[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    async function load() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabase = createClient() as any
      const [histRes, commRes, docRes] = await Promise.all([
        supabase.from("case_status_history").select("*").eq("case_id", caseId).order("created_at", { ascending: false }),
        supabase.from("case_comments").select("*").eq("case_id", caseId).order("created_at", { ascending: false }),
        supabase.from("case_documents").select("*").eq("case_id", caseId).order("created_at", { ascending: false }),
      ])

      const hist = (histRes.data || []) as StatusEntry[]
      const comm = (commRes.data || []) as CommentEntry[]
      const docs = (docRes.data || []) as DocumentEntry[]

      // Batch fetch actor names
      const actorIds = Array.from(new Set([
        ...hist.map((h) => h.changed_by),
        ...comm.map((c) => c.user_id),
        ...docs.map((d) => d.uploaded_by),
      ].filter(Boolean) as string[]))

      const actors: Record<string, Actor> = {}
      if (actorIds.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, role")
          .in("id", actorIds)
        ;(profiles || []).forEach((p: Actor) => { actors[p.id] = p })
      }

      const evs: Event[] = [
        ...hist.map<Event>((h) => ({
          kind: "status", at: h.created_at,
          actor: h.changed_by ? (actors[h.changed_by]?.full_name ?? "Unknown") : null,
          data: h,
        })),
        ...comm.map<Event>((c) => ({
          kind: "comment", at: c.created_at,
          actor: c.user_id ? (actors[c.user_id]?.full_name ?? "Unknown") : null,
          data: c,
        })),
        ...docs.map<Event>((d) => ({
          kind: "document", at: d.created_at,
          actor: d.uploaded_by ? (actors[d.uploaded_by]?.full_name ?? "Unknown") : null,
          data: d,
        })),
      ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())

      setEvents(evs)
      setLoading(false)
    }
    load()
  }, [caseId])

  const fmtStatus = (s: string | null) => {
    if (!s) return "—"
    return CASE_STATUS_LABELS[s as CaseStatus] || s
  }
  const fmtDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString(undefined, {
        year: "numeric", month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    } catch { return iso }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4 text-[#C9A84C]" /> Activity Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-sm text-gray-400 py-4">Loading…</div>
        ) : events.length === 0 ? (
          <div className="text-sm text-gray-400 py-4">No activity yet.</div>
        ) : (
          <ol className="relative border-l border-gray-200 ml-2 space-y-4">
            {events.map((e, i) => {
              const Icon = e.kind === "status" ? GitCommit : e.kind === "comment" ? MessageCircle : Upload
              return (
                <li key={`${e.kind}-${i}`} className="ml-4">
                  <div className="absolute -left-1.5 h-3 w-3 rounded-full bg-white border-2 border-[#C9A84C]" />
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-0.5">
                    <Icon className="h-3 w-3" />
                    <span>{fmtDate(e.at)}</span>
                    {e.actor && <span>· {e.actor}</span>}
                  </div>
                  {e.kind === "status" && (
                    <p className="text-sm text-[#0A1628]">
                      Status: <span className="text-gray-500">{fmtStatus(e.data.from_status)}</span>
                      {" → "}
                      <span className="font-medium">{fmtStatus(e.data.to_status)}</span>
                      {e.data.notes && <span className="text-gray-500"> — {e.data.notes}</span>}
                    </p>
                  )}
                  {e.kind === "comment" && (
                    <p className="text-sm text-[#0A1628] whitespace-pre-wrap">{e.data.body}</p>
                  )}
                  {e.kind === "document" && (
                    <p className="text-sm text-[#0A1628]">
                      Uploaded <span className="font-medium">{e.data.document_type || "document"}</span>
                      {e.data.file_name && <span className="text-gray-500"> — {e.data.file_name}</span>}
                    </p>
                  )}
                </li>
              )
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}
