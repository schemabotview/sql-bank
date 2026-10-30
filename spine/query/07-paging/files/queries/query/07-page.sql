-- queries/query/07-page.sql — Tom's statement, page 2 (3 lines a page).
-- Keyset: continue after the last posting page 1 showed, by a unique key.
SELECT posting_id, txn_id, amount
FROM core.postings
WHERE account_id = 1016 AND posting_id > 9041
ORDER BY posting_id
LIMIT 3;
