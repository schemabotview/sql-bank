-- perform/04-composite.sql — the index the query asks for: equality, range.
-- (account_id, booked_on): rows of one account, already in date order.
CREATE INDEX by_account_day ON perf.postings (account_id, booked_on);
