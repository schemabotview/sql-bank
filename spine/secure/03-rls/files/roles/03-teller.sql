-- roles/03-teller.sql — a Leeds teller: masked phones, Leeds accounts only.
CREATE VIEW core.customer_directory AS
SELECT customer_id, full_name, '******' || right(phone, 4) AS phone
FROM core.customers;
REVOKE SELECT ON core.customers FROM syndica_teller_lds;
GRANT SELECT ON core.customer_directory TO syndica_teller_lds;

-- Row-level security (PG): a role sees only the rows a policy allows it.
ALTER TABLE core.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY leeds_only ON core.accounts FOR SELECT
  TO syndica_teller_lds USING (branch_code = 'LDS');
CREATE POLICY see_all ON core.accounts FOR SELECT
  TO syndica_auditor USING (true);
