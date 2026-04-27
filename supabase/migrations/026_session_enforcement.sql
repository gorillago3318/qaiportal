-- Single-session enforcement: track the active session nonce per user.
-- When a new login happens, the nonce is replaced, invalidating previous sessions.

alter table profiles
  add column if not exists active_session_nonce text;
