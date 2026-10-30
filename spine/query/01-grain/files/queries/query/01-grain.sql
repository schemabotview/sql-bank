-- queries/query/01-grain.sql — what does one row of the answer mean?
-- One row per branch-and-kind combination, not per account.
SELECT DISTINCT branch_code AS branch, kind
FROM core.accounts
ORDER BY branch, kind;
