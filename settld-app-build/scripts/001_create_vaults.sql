-- Settld: evidence vault table
-- Stores one row per order Settld is monitoring for chargeback risk.

CREATE TABLE IF NOT EXISTS vaults (
  id               text PRIMARY KEY,
  order_id         text,
  customer         text,
  amount           numeric,
  currency         text,
  product          text,
  dispute_status   text DEFAULT 'none',
  dispute_reason   text,
  dispute_deadline text,
  evidence_score   integer DEFAULT 0,
  recommendation   text,
  latest_event     text,
  latest_event_at  text,
  created_at       timestamptz DEFAULT now()
);

-- The dashboard and orders list read newest-first.
CREATE INDEX IF NOT EXISTS vaults_latest_event_at_idx ON vaults (latest_event_at DESC);
