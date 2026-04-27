// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = any

export type AuditAction =
  | 'case_status_changed'
  | 'case_created'
  | 'case_updated'
  | 'commission_paid'
  | 'commission_updated'
  | 'document_uploaded'
  | 'lawyer_notified'
  | 'user_login'
  | 'settings_changed'

export interface AuditEntry {
  actorId: string
  actorName: string
  actorRole: string
  action: AuditAction
  entityType: 'case' | 'commission' | 'profile' | 'settings'
  entityId: string
  entityLabel?: string
  metadata?: Record<string, unknown>
}

export async function logAudit(adminClient: AdminClient, entry: AuditEntry): Promise<void> {
  try {
    await adminClient.from('audit_logs').insert({
      actor_id: entry.actorId,
      actor_name: entry.actorName,
      actor_role: entry.actorRole,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      entity_label: entry.entityLabel ?? null,
      metadata: entry.metadata ?? null,
    })
  } catch {
    // Never let audit failures break the main operation
  }
}
