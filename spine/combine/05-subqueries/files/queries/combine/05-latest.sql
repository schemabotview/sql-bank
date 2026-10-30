-- queries/combine/05-latest.sql — the two latest postings of two accounts.
-- LATERAL: the subquery runs once per account, and may use a.account_id.
SELECT a.account_no, last.posting_id, last.amount
FROM core.accounts AS a
CROSS JOIN LATERAL (
  SELECT p.posting_id, p.amount
  FROM core.postings AS p
  WHERE p.account_id = a.account_id
  ORDER BY p.posting_id DESC
  LIMIT 2
) AS last
WHERE a.account_id IN (1011, 1016)
ORDER BY a.account_no, last.posting_id DESC;
