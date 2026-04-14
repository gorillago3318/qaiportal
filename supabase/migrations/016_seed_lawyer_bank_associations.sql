-- Migration 016: Seed lawyer_bank_associations for panel lawyers
-- Links the seeded panel lawyers to all active banks so agents can select them when creating cases.
-- Uses name-based lookup so this works regardless of UUID values.

INSERT INTO lawyer_bank_associations (lawyer_id, bank_id, is_panel)
SELECT l.id, b.id, true
FROM lawyers l
CROSS JOIN banks b
WHERE l.name IN ('Low, Wong and Zahrita', 'Yong & Rajah')
  AND l.is_active = true
  AND b.is_active = true
ON CONFLICT (lawyer_id, bank_id) DO NOTHING;
