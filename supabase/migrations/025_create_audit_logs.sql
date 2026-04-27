-- Audit logs: immutable record of every significant action in the portal.
-- Only super_admin can read. Inserts only via service role (no RLS insert policy).

create table if not exists audit_logs (
  id            uuid primary key default gen_random_uuid(),
  actor_id      uuid not null,
  actor_name    text not null,
  actor_role    text not null,
  action        text not null,
  entity_type   text not null,
  entity_id     text not null,
  entity_label  text,
  metadata      jsonb,
  created_at    timestamptz not null default now()
);

-- Index for fast queries by actor and time
create index if not exists audit_logs_actor_idx on audit_logs (actor_id, created_at desc);
create index if not exists audit_logs_entity_idx on audit_logs (entity_type, entity_id);
create index if not exists audit_logs_action_idx on audit_logs (action, created_at desc);

alter table audit_logs enable row level security;

-- Only super_admin can read
create policy "super_admin_read_audit_logs"
  on audit_logs for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'super_admin'
    )
  );

-- No insert/update/delete via RLS — service role only
