-- changes/02-duplicate.sql — OPS-121: customer 6 is Priya Shah again.
-- Confirmed by phone: one person. Customer 105 holds her account; 6 holds
-- nothing, so it can go. A customer WITH accounts would be merged, not deleted.
DELETE FROM core.customers
WHERE customer_id = 6
  AND NOT EXISTS (SELECT 1 FROM core.account_holders WHERE customer_id = 6)
RETURNING customer_id, full_name, email;
