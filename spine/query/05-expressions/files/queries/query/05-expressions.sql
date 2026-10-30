-- queries/query/05-expressions.sql — values computed in the query.
SELECT account_no,
       '******' || right(account_no, 4)      AS masked,
       overdraft_limit,
       round(overdraft_limit * 0.199 / 12, 2) AS monthly_cost,
       date_trunc('month', opened_on)::date  AS opened_month
FROM core.accounts
WHERE kind = 'current' AND overdraft_limit > 0
ORDER BY account_no;
