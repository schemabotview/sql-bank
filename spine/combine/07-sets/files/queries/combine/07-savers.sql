-- queries/combine/07-savers.sql — savings holders with no current account.
SELECT h.customer_id FROM core.account_holders h
  JOIN core.accounts a USING (account_id) WHERE a.kind = 'savings'
EXCEPT
SELECT h.customer_id FROM core.account_holders h
  JOIN core.accounts a USING (account_id) WHERE a.kind = 'current';
