-- queries/analyse/02-chain.sql — follow money out of Olivia's account.
WITH RECURSIVE moves AS (                  -- every transfer: src -> dst
  SELECT o.account_id AS src, i.account_id AS dst
  FROM core.transactions t
  JOIN core.postings o ON o.txn_id = t.txn_id AND o.amount < 0
  JOIN core.postings i ON i.txn_id = t.txn_id AND i.amount > 0
  WHERE t.kind = 'transfer'
), chain AS (
  SELECT src, dst, 1 AS hop FROM moves WHERE src = 1011   -- the anchor
  UNION ALL
  SELECT m.src, m.dst, c.hop + 1                          -- one more hop
  FROM chain c JOIN moves m ON m.src = c.dst
) CYCLE src SET looped USING path                         -- stop on a repeat
SELECT hop, src, dst, looped FROM chain ORDER BY hop;
