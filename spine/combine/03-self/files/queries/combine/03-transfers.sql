-- queries/combine/03-transfers.sql — every transfer, from and to.
-- postings, twice: the leg that left (out), the leg that arrived (inn).
SELECT t.txn_id, t.reference, out.account_id AS from_account,
       inn.account_id AS to_account, inn.amount
FROM core.transactions AS t
JOIN core.postings AS out ON out.txn_id = t.txn_id AND out.amount < 0
JOIN core.postings AS inn ON inn.txn_id = t.txn_id AND inn.amount > 0
WHERE t.kind = 'transfer'
ORDER BY t.txn_id;
