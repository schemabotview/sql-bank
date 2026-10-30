-- build/01-customers.sql — the bank's customers.
CREATE SCHEMA core;

CREATE TABLE core.customers (
  customer_id bigint GENERATED ALWAYS AS IDENTITY,  -- the database numbers them
  full_name   text,
  email       text,
  phone       text,
  kyc_status  text DEFAULT 'pending',               -- until identity is checked
  joined_on   date
);
