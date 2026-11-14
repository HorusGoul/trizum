-- UUID nonces from verified, short-lived write tokens, never account identities.
-- Keep compact receipts so a retried action cannot create another party/expense.
CREATE TABLE mcp_operations (
  request_id TEXT PRIMARY KEY NOT NULL,
  fingerprint TEXT NOT NULL,
  result TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX mcp_operations_created_at_idx ON mcp_operations (created_at);
