-- queries/analyse/08-rollup.sql — balances by branch and kind, with subtotals.
SELECT a.branch_code AS branch, a.kind,
       sum(b.balance)                               AS balance,
       count(*) FILTER (WHERE a.closed_on IS NULL)  AS open_accounts,
       GROUPING(a.branch_code, a.kind)              AS level
FROM core.accounts a
JOIN core.account_balance b USING (account_id)
WHERE a.kind <> 'internal'
GROUP BY ROLLUP (a.branch_code, a.kind)
ORDER BY a.branch_code NULLS LAST, a.kind NULLS LAST;
