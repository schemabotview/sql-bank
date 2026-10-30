-- design/04-sheet.sql — the legacy sheet, one row per account holder.
-- A throwaway: it lives in `sandbox` and is dropped afterwards.
CREATE SCHEMA sandbox;

CREATE TABLE sandbox.account_sheet (
  account_no  text,
  holder      text,
  email       text,
  branch_city text
);

INSERT INTO sandbox.account_sheet VALUES
  ('SY40000013', 'Chloe Price', 'chloe.price@example.com', 'Manchester'),
  ('SY40000013', 'Marcus Reid', 'marcus.reid@example.com', 'Manchester'),
  ('SY40000014', 'Chloe Price', 'chloe.price@example.com', 'Manchester');
