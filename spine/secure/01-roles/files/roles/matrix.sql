-- roles/matrix.sql — the permission matrix, asked of the server.
SELECT r AS role, t AS "table",
       has_table_privilege(r, t, 'SELECT') AS sel,
       has_table_privilege(r, t, 'INSERT') AS ins,
       has_table_privilege(r, t, 'UPDATE') AS upd
FROM unnest(ARRAY['syndica_teller_lds', 'syndica_auditor', 'syndica_app']) r,
     unnest(ARRAY['core.customers', 'core.accounts', 'core.postings']) t
ORDER BY 1, 2;
