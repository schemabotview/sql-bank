-- perform/03-index.sql — an index on the column the page filters by.
CREATE INDEX by_account ON perf.postings (account_id);
