-- queries/combine/04-per-customer.sql — money held, per customer.
-- A joint account has two holders, so its postings reach BOTH of them.
SELECT c.full_name, sum(p.amount) AS held
FROM core.customers c
JOIN core.account_holders h ON h.customer_id = c.customer_id
JOIN core.postings p        ON p.account_id = h.account_id
WHERE c.full_name IN ('Chloe Price', 'Marcus Reid')
GROUP BY c.full_name
ORDER BY c.full_name;
