-- roles/02-least-privilege.sql — an append-only ledger; ONE door for the app.
REVOKE UPDATE, DELETE, TRUNCATE ON core.postings FROM dbteam;
REVOKE DELETE, TRUNCATE ON core.transactions FROM dbteam;
-- (UPDATE stays on transactions: each posting's foreign key LOCKS its
--  transaction row — FOR KEY SHARE — and taking that lock needs UPDATE.)

-- The app moves money only through core.transfer, run as its owner:
ALTER FUNCTION core.transfer(text, bigint, bigint, numeric)
  SECURITY DEFINER SET search_path = core, pg_temp;
REVOKE EXECUTE ON FUNCTION core.transfer(text, bigint, bigint, numeric)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core.transfer(text, bigint, bigint, numeric)
  TO syndica_app;
GRANT SELECT ON core.account_balance TO syndica_app;
