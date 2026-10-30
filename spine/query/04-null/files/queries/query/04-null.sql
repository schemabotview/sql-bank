-- queries/query/04-null.sql — customers with no phone on file.
-- NULL is not a value, so it is never = anything: test it with IS NULL.
SELECT customer_id, full_name
FROM core.customers
WHERE phone IS NULL
ORDER BY customer_id;
