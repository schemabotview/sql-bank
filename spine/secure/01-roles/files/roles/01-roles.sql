-- roles/01-roles.sql — who may do what. Run by an administrator (superuser).
CREATE ROLE syndica_teller_lds NOLOGIN;  -- a Leeds teller
CREATE ROLE syndica_auditor    NOLOGIN;  -- reads everything, changes nothing
CREATE ROLE syndica_app        NOLOGIN;  -- the bank's application

GRANT USAGE ON SCHEMA core TO syndica_teller_lds, syndica_auditor, syndica_app;
GRANT SELECT ON core.customers, core.accounts TO syndica_teller_lds;
GRANT SELECT ON ALL TABLES IN SCHEMA core TO syndica_auditor;

-- the DB team may act AS each role to test it (SET ROLE), never inherit it
GRANT syndica_teller_lds, syndica_auditor, syndica_app TO dbteam
  WITH INHERIT FALSE, SET TRUE;
