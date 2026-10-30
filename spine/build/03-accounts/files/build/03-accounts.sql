-- build/03-accounts.sql — accounts, and who holds them.
CREATE TABLE core.accounts (
  account_id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_no      text UNIQUE,                      -- the number on the card
  kind            text,                             -- current, savings…
  branch_code     text REFERENCES ref.branches ON DELETE RESTRICT,
  currency        char(3) DEFAULT 'GBP',
  overdraft_limit numeric(14,2) DEFAULT 0,
  opened_on       date,
  closed_on       date
);

-- A joint account has two holders; a customer can hold many accounts.
CREATE TABLE core.account_holders (
  account_id  bigint REFERENCES core.accounts,
  customer_id bigint REFERENCES core.customers,
  PRIMARY KEY (account_id, customer_id)
);
