-- views/account_balance.sql — every account and its balance, by name.
-- A view stores the QUERY, not the result: balances are still derived.
CREATE VIEW core.account_balance AS
SELECT a.account_id, a.account_no, a.kind,
       coalesce(sum(p.amount), 0) AS balance
FROM core.accounts AS a
LEFT JOIN core.postings AS p ON p.account_id = a.account_id
GROUP BY a.account_id, a.account_no, a.kind;
