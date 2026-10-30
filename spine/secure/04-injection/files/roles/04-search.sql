-- roles/04-search.sql — search by reference, the safe way: a parameter.
-- $1 is a VALUE. Whatever the user typed, it can never become SQL.
PREPARE search(text) AS
  SELECT count(*) FROM core.transactions WHERE reference = $1;
