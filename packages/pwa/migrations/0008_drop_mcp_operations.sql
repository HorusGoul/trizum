-- MCP actions now sync directly through Automerge without retry receipts.
-- Keep 0007 in migration history for environments where it already ran.
DROP TABLE IF EXISTS mcp_operations;
