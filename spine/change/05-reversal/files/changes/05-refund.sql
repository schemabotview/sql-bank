-- changes/05-refund.sql — OPS-130: refund Tom's overdraft fee (txn 5023).
-- Never edit or delete the fee: add a transaction that undoes it.
WITH r AS (
  INSERT INTO core.transactions (kind, reference, booked_at, reverses)
  SELECT 'reversal', 'refund: ' || reference, '2026-10-31 10:00+00', txn_id
  FROM core.transactions WHERE txn_id = 5023
  RETURNING txn_id, reverses
)
INSERT INTO core.postings (txn_id, account_id, amount)
SELECT r.txn_id, p.account_id, -p.amount    -- every leg, sign flipped
FROM r JOIN core.postings p ON p.txn_id = r.reverses
RETURNING txn_id, account_id, amount;
