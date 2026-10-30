-- build/05-predict.sql — six records. Predict each before it runs.
\set VERBOSITY terse
-- 1 a customer with no phone
INSERT INTO core.customers (full_name, email, joined_on)
  VALUES ('Grace Lin', 'grace.lin@example.com', '2026-10-30');
-- 2 a customer with no name
INSERT INTO core.customers (full_name, email, joined_on)
  VALUES (NULL, 'no.name@example.com', '2026-10-30');
-- 3 Amelia again, same email
INSERT INTO core.customers (full_name, email, joined_on)
  VALUES ('Amelia Hughes', 'amelia.hughes@example.com', '2026-10-30');
-- 4 an account in dollars
INSERT INTO core.accounts (account_no, kind, branch_code, currency, opened_on)
  VALUES ('SY40000002', 'current', 'BRS', 'USD', '2026-10-30');
-- 5 an account closed before it opened
INSERT INTO core.accounts (account_no, kind, branch_code, opened_on, closed_on)
  VALUES ('SY40000002', 'current', 'BRS', '2026-10-30', '2026-10-01');
-- 6 Priya Shah, under a second email
INSERT INTO core.customers (full_name, email, joined_on)
  VALUES ('Priya Shah', 'p.shah@example.com', '2026-10-30');
