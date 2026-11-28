-- M12: the server's admin role (service_role) may write the app's tables.
--
-- Edge Functions and the media worker save their results with the service_role key (e.g.
-- enhance-product-image updates products, make-product-pictures adds product_pictures, the
-- worker updates generation_jobs, the Razorpay webhook grants credits). Local Supabase grants
-- service_role these table rights by default; newer hosted projects do not, so the staging
-- functions failed with "permission denied for table products / product_pictures".
--
-- This changes nothing for visitors: anon and authenticated keep exactly the grants and RLS
-- policies of the earlier migrations. service_role is never sent to a browser.
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Tables, sequences and functions added by later migrations get the same rights.
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to service_role;
alter default privileges in schema public
  grant execute on functions to service_role;
