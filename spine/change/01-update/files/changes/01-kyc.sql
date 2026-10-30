-- changes/01-kyc.sql — OPS-114: identity checks passed for two customers.
-- Run inside BEGIN: check the count before anything is permanent.
UPDATE core.customers
SET kyc_status = 'verified'
WHERE customer_id IN (106, 110)   -- Tom Walsh, Liam Murphy
  AND kyc_status = 'pending'
RETURNING customer_id, full_name, kyc_status;
