-- perform/05-covering.sql — answer the page from the index alone.
DROP INDEX perf.by_account_day;
CREATE INDEX by_account_day ON perf.postings (account_id, booked_on)
  INCLUDE (amount);        -- carried in the index, not searched by
VACUUM perf.postings;      -- marks pages all-visible: no heap visit needed
