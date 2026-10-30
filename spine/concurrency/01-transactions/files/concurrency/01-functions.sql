-- concurrency/01-functions.sql — two operations the team will run concurrently.
-- A balance, derived as always:
CREATE FUNCTION core.balance(acc bigint) RETURNS numeric
LANGUAGE sql STABLE AS $$
  SELECT coalesce(sum(amount), 0) FROM core.postings WHERE account_id = acc
$$;

-- A cash withdrawal: one transaction, two postings, in ONE statement.
CREATE FUNCTION core.withdraw(acc bigint, amt numeric) RETURNS bigint
LANGUAGE sql AS $$
  WITH t AS (INSERT INTO core.transactions (kind, reference, booked_at)
             VALUES ('withdrawal', 'ATM withdrawal', '2026-10-31 12:00+00')
             RETURNING txn_id)
  INSERT INTO core.postings (txn_id, account_id, amount)
  SELECT txn_id, acc, -amt FROM t UNION ALL SELECT txn_id, 1001, amt FROM t
  RETURNING txn_id
$$;
