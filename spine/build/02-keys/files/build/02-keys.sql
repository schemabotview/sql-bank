-- build/02-keys.sql — every row gets a name the database guarantees.
ALTER TABLE ref.branches ADD PRIMARY KEY (code);

ALTER TABLE core.customers ADD PRIMARY KEY (customer_id);
ALTER TABLE core.customers ADD UNIQUE (email);  -- one customer per email
