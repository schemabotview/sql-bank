-- queries/combine/02-no-account.sql — customers who hold no account.
-- LEFT JOIN keeps every customer; where nothing matched, h's columns are NULL.
SELECT c.customer_id, c.full_name
FROM core.customers AS c
LEFT JOIN core.account_holders AS h ON h.customer_id = c.customer_id
WHERE h.account_id IS NULL
ORDER BY c.customer_id;
