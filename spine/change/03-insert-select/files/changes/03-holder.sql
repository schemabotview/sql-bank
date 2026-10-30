-- changes/03-holder.sql — OPS-125: Amelia's account has no holder.
-- INSERT ... SELECT: the ids are LOOKED UP from what Ops knows, never typed.
INSERT INTO core.account_holders (account_id, customer_id)
SELECT a.account_id, c.customer_id
FROM core.accounts a, core.customers c
WHERE a.account_no = 'SY40000001'
  AND c.email = 'amelia.hughes@example.com'
RETURNING account_id, customer_id;
