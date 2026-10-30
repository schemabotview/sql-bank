-- queries/query/08-balances.sql — every customer account's balance.
-- A balance is never stored: it is the sum of the account's postings.
SELECT account_id,
       count(*)    AS postings,
       sum(amount) AS balance
FROM core.postings
WHERE account_id > 1010
GROUP BY account_id
ORDER BY account_id;
