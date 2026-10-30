-- queries/combine/01-join.sql — every Manchester account, with its city.
-- One row per ACCOUNT: each account matches exactly one branch.
SELECT a.account_no, a.kind, b.city
FROM core.accounts AS a
JOIN ref.branches  AS b ON b.code = a.branch_code
WHERE b.city = 'Manchester'
ORDER BY a.account_no;
