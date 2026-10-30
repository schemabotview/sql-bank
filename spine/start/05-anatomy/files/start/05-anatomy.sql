-- start/05-anatomy.sql — one statement, taken apart.
-- Which branches opened before 2015?
SELECT code, city               -- keywords, then identifiers
FROM ref.branches               -- schema.table
WHERE opened_on < '2015-01-01'; -- a literal; ; ends it
