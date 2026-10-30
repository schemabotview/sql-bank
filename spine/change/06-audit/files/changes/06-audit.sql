-- changes/06-audit.sql — every change to a customer, recorded by the database.
CREATE SCHEMA audit;
CREATE TABLE audit.customer_changes (
  change_id  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id bigint NOT NULL,
  old_row    jsonb NOT NULL,
  new_row    jsonb NOT NULL,
  changed_by text NOT NULL DEFAULT current_user
);
CREATE FUNCTION audit.log_customer() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO audit.customer_changes (customer_id, old_row, new_row)
  VALUES (OLD.customer_id, to_jsonb(OLD), to_jsonb(NEW));
  RETURN NEW;
END $$;
CREATE TRIGGER customers_audit AFTER UPDATE ON core.customers
  FOR EACH ROW EXECUTE FUNCTION audit.log_customer();
