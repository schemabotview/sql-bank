-- queries/analyse/06-lag.sql — card spending, month on month.
WITH monthly AS (
  SELECT date_trunc('month', t.booked_at)::date AS month,
         sum(-p.amount) AS card_spend
  FROM core.transactions t
  JOIN core.postings p ON p.txn_id = t.txn_id AND p.amount < 0
  WHERE t.kind = 'card'
  GROUP BY 1
)
SELECT month, card_spend,
       lag(card_spend) OVER (ORDER BY month)              AS previous,
       card_spend - lag(card_spend) OVER (ORDER BY month) AS change
FROM monthly ORDER BY month;
