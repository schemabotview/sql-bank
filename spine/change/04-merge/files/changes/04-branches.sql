-- changes/04-branches.sql — the property team's branch list, applied.
CREATE TEMP TABLE feed (code text, city text, opened_on date);
INSERT INTO feed VALUES ('LDS', 'Leeds',                 '2009-04-01'),
                        ('MAN', 'Manchester Piccadilly', '2015-03-02'),
                        ('YRK', 'York',                  '2026-11-02');

MERGE INTO ref.branches AS b
USING feed AS f ON f.code = b.code
WHEN MATCHED AND b.city <> f.city THEN
  UPDATE SET city = f.city
WHEN NOT MATCHED THEN
  INSERT (code, city, opened_on) VALUES (f.code, f.city, f.opened_on)
RETURNING merge_action(), b.code, b.city;
