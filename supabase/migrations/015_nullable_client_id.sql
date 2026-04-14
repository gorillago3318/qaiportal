-- Migration 015: Make cases.client_id nullable
-- Reason: Agents can save a draft before client details are filled in.
-- client_id is linked when client IC/name are entered, and validated before submission.

ALTER TABLE cases ALTER COLUMN client_id DROP NOT NULL;
