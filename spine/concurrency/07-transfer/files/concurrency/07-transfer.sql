-- concurrency/07-transfer.sql — a transfer that stays correct under concurrency.
ALTER TABLE core.transactions ADD COLUMN request_id text UNIQUE;

CREATE FUNCTION core.transfer(req text, src bigint, dst bigint, amt numeric)
RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE txn bigint; available numeric;
BEGIN
  -- 1 lock BOTH accounts, always in id order: no two transfers can deadlock
  PERFORM 1 FROM core.accounts WHERE account_id IN (src, dst)
    ORDER BY account_id FOR UPDATE;
  -- 2 the check, now that nobody else can move money on these accounts
  SELECT core.balance(src) + overdraft_limit INTO available
    FROM core.accounts WHERE account_id = src;
  IF available < amt THEN
    RAISE EXCEPTION 'insufficient funds: % available', available;
  END IF;
  -- 3 one request id, one transaction: a retried request is refused
  INSERT INTO core.transactions (kind, reference, booked_at, request_id)
  VALUES ('transfer', 'online transfer', '2026-10-31 15:00+00', req)
  RETURNING txn_id INTO txn;
  INSERT INTO core.postings (txn_id, account_id, amount)
  VALUES (txn, src, -amt), (txn, dst, amt);
  RETURN txn;
END $$;
