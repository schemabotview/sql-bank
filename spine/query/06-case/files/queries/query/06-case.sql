-- queries/query/06-case.sql — overdraft tier for every customer account.
-- CASE tests its branches in order; the first true one wins.
SELECT account_no, overdraft_limit,
       CASE
         WHEN overdraft_limit = 0   THEN 'none'
         WHEN overdraft_limit < 250 THEN 'small'
         ELSE 'large'
       END AS tier
FROM core.accounts
WHERE kind <> 'internal' AND overdraft_limit > 0 OR account_no = 'SY40000012'
ORDER BY overdraft_limit;
