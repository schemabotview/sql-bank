-- build/06-open.sql — load the opening book, parents before children.
-- The CSVs carry their own ids (customers 101+, accounts 1001+ ...).
\copy core.customers FROM 'seed/customers.csv' CSV HEADER
\copy core.accounts FROM 'seed/accounts.csv' CSV HEADER
\copy core.account_holders FROM 'seed/account_holders.csv' CSV HEADER
\copy core.transactions FROM 'seed/transactions.csv' CSV HEADER
\copy core.postings FROM 'seed/postings.csv' CSV HEADER

-- COPY wrote explicit ids, so no identity moved: move each past its rows,
-- or one day an INSERT would hand out customer 101 again.
ALTER TABLE core.customers ALTER customer_id RESTART WITH 111;
ALTER TABLE core.accounts ALTER account_id RESTART WITH 1022;
ALTER TABLE core.transactions ALTER txn_id RESTART WITH 5037;
ALTER TABLE core.postings ALTER posting_id RESTART WITH 9073;
