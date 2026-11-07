-- قیود CHECK، Row Level Security، و جداول فقط‌افزودنی.

ALTER TABLE "users" ADD CONSTRAINT "users_chk_1" CHECK (email IS NOT NULL OR phone IS NOT NULL);
ALTER TABLE "plans" ADD CONSTRAINT "plans_chk_1" CHECK (price_amount >= 0);
ALTER TABLE "stores" ADD CONSTRAINT "stores_chk_1" CHECK (currency = 'IRR');
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_chk_1" CHECK (price_amount >= 0);
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_chk_2" CHECK (compare_at_amount IS NULL OR compare_at_amount >= price_amount);
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_chk_1" CHECK (on_hand >= 0);
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_chk_2" CHECK (reserved >= 0);
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_chk_3" CHECK (reserved <= on_hand);
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_chk_1" CHECK (quantity > 0);
ALTER TABLE "orders" ADD CONSTRAINT "orders_chk_1" CHECK (currency = 'IRR');
ALTER TABLE "orders" ADD CONSTRAINT "orders_chk_2" CHECK (subtotal_amount >= 0);
ALTER TABLE "orders" ADD CONSTRAINT "orders_chk_3" CHECK (discount_amount >= 0);
ALTER TABLE "orders" ADD CONSTRAINT "orders_chk_4" CHECK (shipping_amount >= 0);
ALTER TABLE "orders" ADD CONSTRAINT "orders_chk_5" CHECK (total_amount = subtotal_amount - discount_amount + shipping_amount);
ALTER TABLE "orders" ADD CONSTRAINT "orders_chk_6" CHECK (discount_amount <= subtotal_amount);
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_chk_1" CHECK (quantity > 0);
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_chk_2" CHECK (unit_amount >= 0);
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_chk_3" CHECK (line_amount = unit_amount * quantity);
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_chk_1" CHECK (quantity > 0);
ALTER TABLE "payments" ADD CONSTRAINT "payments_chk_1" CHECK (currency = 'IRR');
ALTER TABLE "payments" ADD CONSTRAINT "payments_chk_2" CHECK (amount > 0);
ALTER TABLE "payments" ADD CONSTRAINT "payments_chk_3" CHECK (status <> 'PAID' OR verified_at IS NOT NULL);
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_chk_1" CHECK (amount > 0);
ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_chk_1" CHECK (amount >= 0);

-- Helper: قرارداد Context
--   app.tenant_id  : شناسه مستأجر جاری (توسط لایه سرویس برای هر تراکنش با set_config(..., true) تنظیم می‌شود)
--   مسیرهای محدود و بازبینی‌شده (ورود، شناسایی وب‌هوک، مدیر کل، کارهای زمان‌بندی‌شده) با نقش جدا `botshop_system`
--   (دارای BYPASSRLS) و Connection Pool جدا اجرا می‌شوند؛ نقش برنامه (botshop_app) هیچ راهی برای دور زدن RLS ندارد.
CREATE OR REPLACE FUNCTION app_current_tenant() RETURNS TEXT LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('app.tenant_id', true), '') $$;

ALTER TABLE "tenants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenants" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "tenants" USING ("id" = app_current_tenant()) WITH CHECK ("id" = app_current_tenant());
ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "memberships" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "memberships" USING ("tenant_id" = app_current_tenant()) WITH CHECK ("tenant_id" = app_current_tenant());
ALTER TABLE "stores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stores" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "stores" USING ("tenant_id" = app_current_tenant()) WITH CHECK ("tenant_id" = app_current_tenant());
ALTER TABLE "channel_connections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "channel_connections" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "channel_connections" USING ("tenant_id" = app_current_tenant()) WITH CHECK ("tenant_id" = app_current_tenant());
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "categories" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "categories" USING ("tenant_id" = app_current_tenant()) WITH CHECK ("tenant_id" = app_current_tenant());
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "products" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "products" USING ("tenant_id" = app_current_tenant()) WITH CHECK ("tenant_id" = app_current_tenant());
ALTER TABLE "product_variants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_variants" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "product_variants" USING ("tenant_id" = app_current_tenant()) WITH CHECK ("tenant_id" = app_current_tenant());
ALTER TABLE "product_media" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_media" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "product_media" USING ("tenant_id" = app_current_tenant()) WITH CHECK ("tenant_id" = app_current_tenant());
ALTER TABLE "inventory_locations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_locations" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "inventory_locations" USING ("tenant_id" = app_current_tenant()) WITH CHECK ("tenant_id" = app_current_tenant());
ALTER TABLE "inventory_balances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_balances" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "inventory_balances" USING ("tenant_id" = app_current_tenant()) WITH CHECK ("tenant_id" = app_current_tenant());
ALTER TABLE "inventory_movements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_movements" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "inventory_movements" USING ("tenant_id" = app_current_tenant()) WITH CHECK ("tenant_id" = app_current_tenant());
ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customers" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "customers" USING ("tenant_id" = app_current_tenant()) WITH CHECK ("tenant_id" = app_current_tenant());
ALTER TABLE "customer_identities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customer_identities" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "customer_identities" USING ("tenant_id" = app_current_tenant()) WITH CHECK ("tenant_id" = app_current_tenant());
ALTER TABLE "customer_addresses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customer_addresses" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "customer_addresses" USING ("tenant_id" = app_current_tenant()) WITH CHECK ("tenant_id" = app_current_tenant());
ALTER TABLE "carts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "carts" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "carts" USING ("tenant_id" = app_current_tenant()) WITH CHECK ("tenant_id" = app_current_tenant());
ALTER TABLE "cart_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cart_items" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "cart_items" USING ("tenant_id" = app_current_tenant()) WITH CHECK ("tenant_id" = app_current_tenant());
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orders" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "orders" USING ("tenant_id" = app_current_tenant()) WITH CHECK ("tenant_id" = app_current_tenant());
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_items" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "order_items" USING ("tenant_id" = app_current_tenant()) WITH CHECK ("tenant_id" = app_current_tenant());
ALTER TABLE "order_status_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_status_history" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "order_status_history" USING ("tenant_id" = app_current_tenant()) WITH CHECK ("tenant_id" = app_current_tenant());
ALTER TABLE "stock_reservations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_reservations" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "stock_reservations" USING ("tenant_id" = app_current_tenant()) WITH CHECK ("tenant_id" = app_current_tenant());
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payments" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "payments" USING ("tenant_id" = app_current_tenant()) WITH CHECK ("tenant_id" = app_current_tenant());
ALTER TABLE "payment_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payment_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "payment_events" USING ("tenant_id" = app_current_tenant()) WITH CHECK ("tenant_id" = app_current_tenant());
ALTER TABLE "refunds" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "refunds" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "refunds" USING ("tenant_id" = app_current_tenant()) WITH CHECK ("tenant_id" = app_current_tenant());
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscriptions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "subscriptions" USING ("tenant_id" = app_current_tenant()) WITH CHECK ("tenant_id" = app_current_tenant());
ALTER TABLE "subscription_invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscription_invoices" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "subscription_invoices" USING ("tenant_id" = app_current_tenant()) WITH CHECK ("tenant_id" = app_current_tenant());
ALTER TABLE "webhook_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "webhook_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "webhook_events" USING ("tenant_id" = app_current_tenant()) WITH CHECK ("tenant_id" = app_current_tenant());
ALTER TABLE "outbound_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "outbound_messages" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "outbound_messages" USING ("tenant_id" = app_current_tenant()) WITH CHECK ("tenant_id" = app_current_tenant());
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "audit_logs" USING ("tenant_id" = app_current_tenant()) WITH CHECK ("tenant_id" = app_current_tenant());

-- جداول فقط‌افزودنی: هرگونه UPDATE/DELETE رد می‌شود.
CREATE OR REPLACE FUNCTION forbid_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'جدول % فقط‌افزودنی است', TG_TABLE_NAME USING ERRCODE = 'integrity_constraint_violation'; END $$;
CREATE TRIGGER audit_logs_append_only BEFORE UPDATE OR DELETE ON "audit_logs" FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER inventory_movements_append_only BEFORE UPDATE OR DELETE ON "inventory_movements" FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER order_status_history_append_only BEFORE UPDATE OR DELETE ON "order_status_history" FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER payment_events_append_only BEFORE UPDATE OR DELETE ON "payment_events" FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- اعطای دسترسی به نقش برنامه (نقش با رمز در محیط ساخته می‌شود؛ نه در Git). اگر نقش وجود نداشته باشد نادیده گرفته می‌شود.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'botshop_app') THEN
    GRANT USAGE ON SCHEMA public TO botshop_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO botshop_app;
    REVOKE UPDATE, DELETE ON audit_logs, inventory_movements, order_status_history, payment_events FROM botshop_app;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO botshop_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'botshop_system') THEN
    GRANT USAGE ON SCHEMA public TO botshop_system;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO botshop_system;
    REVOKE UPDATE, DELETE ON audit_logs, inventory_movements, order_status_history, payment_events FROM botshop_system;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO botshop_system;
  END IF;
END $$;
