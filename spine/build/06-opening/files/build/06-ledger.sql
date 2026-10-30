-- build/06-ledger.sql — the ledger: every movement of money, double entry.
CREATE TABLE core.transactions (
  txn_id    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind      text NOT NULL CHECK (kind IN ('deposit', 'withdrawal',
              'transfer', 'card', 'fee', 'interest', 'reversal')),
  reference text,
  booked_at timestamptz NOT NULL,
  reverses  bigint REFERENCES core.transactions  -- set on a reversal only
);

-- A transaction's postings sum to zero: money moves, it is never made.
CREATE TABLE core.postings (
  posting_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  txn_id     bigint NOT NULL REFERENCES core.transactions,
  account_id bigint NOT NULL REFERENCES core.accounts,
  amount     numeric(14,2) NOT NULL CHECK (amount <> 0)  -- + in, - out
);
