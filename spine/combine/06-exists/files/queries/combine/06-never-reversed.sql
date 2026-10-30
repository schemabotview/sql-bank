-- queries/combine/06-never-reversed.sql — transactions nobody has reversed.
-- NOT EXISTS asks, per row, "is there a reversal pointing at me?"
SELECT count(*) AS never_reversed
FROM core.transactions AS t
WHERE NOT EXISTS (
  SELECT 1 FROM core.transactions AS r WHERE r.reverses = t.txn_id
);
