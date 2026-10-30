-- build/04-rules.sql — the rules every row must obey.
ALTER TABLE ref.branches
  ALTER city SET NOT NULL,
  ALTER opened_on SET NOT NULL;

ALTER TABLE core.customers
  ALTER full_name SET NOT NULL,
  ALTER joined_on SET NOT NULL,
  ADD CHECK (kyc_status IN ('pending', 'verified'));

ALTER TABLE core.accounts
  ALTER account_no SET NOT NULL,
  ALTER kind SET NOT NULL,
  ALTER branch_code SET NOT NULL,
  ALTER currency SET NOT NULL,
  ALTER overdraft_limit SET NOT NULL,
  ALTER opened_on SET NOT NULL,
  ADD CHECK (kind IN ('current', 'savings', 'internal')),
  ADD CHECK (currency IN ('GBP', 'EUR')),
  ADD CHECK (overdraft_limit >= 0),
  ADD CHECK (closed_on >= opened_on);  -- NULL closed_on: still open, passes
