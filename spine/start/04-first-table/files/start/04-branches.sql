-- start/04-branches.sql — the first table: Syndica's branches.
CREATE SCHEMA ref;

CREATE TABLE ref.branches (
  code      text,
  city      text,
  opened_on date
);

INSERT INTO ref.branches (code, city, opened_on)
VALUES ('LDS', 'Leeds',      '2009-04-01'),
       ('BRS', 'Bristol',    '2012-09-17'),
       ('MAN', 'Manchester', '2015-03-02');

SELECT * FROM ref.branches;
