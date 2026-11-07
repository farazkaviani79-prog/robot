-- Initial schema (generated from the data model; hand-reviewed).

CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'SUSPENDED');
CREATE TYPE "tenant_status" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');
CREATE TYPE "role" AS ENUM ('OWNER', 'ADMIN', 'MANAGER', 'STAFF');
CREATE TYPE "channel" AS ENUM ('BALE', 'TELEGRAM');
CREATE TYPE "bot_mode" AS ENUM ('CENTRAL', 'DEDICATED');
CREATE TYPE "connection_status" AS ENUM ('PENDING', 'ACTIVE', 'DISABLED', 'ERROR');
CREATE TYPE "product_status" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "movement_type" AS ENUM ('RECEIPT', 'ADJUSTMENT', 'RESERVE', 'RELEASE', 'SALE', 'RETURN');
CREATE TYPE "cart_status" AS ENUM ('ACTIVE', 'CONVERTED', 'ABANDONED');
CREATE TYPE "order_status" AS ENUM ('PENDING', 'AWAITING_PAYMENT', 'PAID', 'PROCESSING', 'SHIPPED', 'COMPLETED', 'CANCELLED', 'REFUNDED');
CREATE TYPE "reservation_status" AS ENUM ('ACTIVE', 'COMMITTED', 'RELEASED', 'EXPIRED');
CREATE TYPE "payment_provider" AS ENUM ('MOCK', 'BALE');
CREATE TYPE "payment_status" AS ENUM ('INITIATED', 'PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED');
CREATE TYPE "refund_status" AS ENUM ('REQUESTED', 'PROCESSING', 'SUCCEEDED', 'FAILED');
CREATE TYPE "billing_period" AS ENUM ('MONTHLY', 'YEARLY');
CREATE TYPE "subscription_status" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED');
CREATE TYPE "invoice_status" AS ENUM ('OPEN', 'PAID', 'VOID', 'FAILED');
CREATE TYPE "webhook_status" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED');
CREATE TYPE "outbound_status" AS ENUM ('QUEUED', 'SENDING', 'SENT', 'FAILED');
CREATE TYPE "actor_type" AS ENUM ('USER', 'CUSTOMER', 'SYSTEM', 'PLATFORM_ADMIN');

CREATE TABLE "users" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "email" TEXT,
  "phone" TEXT,
  "password_hash" TEXT NOT NULL,
  "display_name" TEXT,
  "is_platform_admin" BOOLEAN NOT NULL DEFAULT FALSE,
  "status" "user_status" NOT NULL DEFAULT 'ACTIVE',
  "failed_login_count" INTEGER NOT NULL DEFAULT 0,
  "locked_until" TIMESTAMP(3),
  "last_login_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tenants" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "status" "tenant_status" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "refresh_sessions" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "user_id" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "revoked_at" TIMESTAMP(3),
  "user_agent" TEXT,
  "ip" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "refresh_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "plans" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "price_amount" BIGINT NOT NULL,
  "billing_period" "billing_period" NOT NULL DEFAULT 'MONTHLY',
  "limits" JSONB NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "memberships" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "role" "role" NOT NULL DEFAULT 'STAFF',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stores" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'IRR',
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "channel_connections" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL,
  "store_id" TEXT NOT NULL,
  "channel" "channel" NOT NULL,
  "mode" "bot_mode" NOT NULL DEFAULT 'DEDICATED',
  "bot_username" TEXT,
  "bot_token_enc" TEXT,
  "webhook_key" TEXT NOT NULL,
  "webhook_secret_enc" TEXT,
  "status" "connection_status" NOT NULL DEFAULT 'PENDING',
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "channel_connections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "categories" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL,
  "store_id" TEXT NOT NULL,
  "parent_id" TEXT,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "products" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL,
  "store_id" TEXT NOT NULL,
  "category_id" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "product_status" NOT NULL DEFAULT 'DRAFT',
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_variants" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "sku" TEXT NOT NULL,
  "title" TEXT NOT NULL DEFAULT 'پیش‌فرض',
  "options" JSONB NOT NULL DEFAULT '{}',
  "price_amount" BIGINT NOT NULL,
  "compare_at_amount" BIGINT,
  "track_inventory" BOOLEAN NOT NULL DEFAULT TRUE,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_media" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "variant_id" TEXT,
  "storage_key" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "alt_text" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_media_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inventory_locations" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL,
  "store_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "is_default" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_locations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inventory_balances" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL,
  "variant_id" TEXT NOT NULL,
  "location_id" TEXT NOT NULL,
  "on_hand" INTEGER NOT NULL DEFAULT 0,
  "reserved" INTEGER NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_balances_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inventory_movements" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL,
  "variant_id" TEXT NOT NULL,
  "location_id" TEXT NOT NULL,
  "type" "movement_type" NOT NULL,
  "on_hand_delta" INTEGER NOT NULL DEFAULT 0,
  "reserved_delta" INTEGER NOT NULL DEFAULT 0,
  "reason" TEXT,
  "ref_type" TEXT,
  "ref_id" TEXT,
  "actor_user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customers" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL,
  "full_name" TEXT,
  "phone" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customer_identities" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "channel" "channel" NOT NULL,
  "external_id" TEXT NOT NULL,
  "username" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_identities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customer_addresses" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "title" TEXT,
  "recipient_name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "province" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "address_line" TEXT NOT NULL,
  "postal_code" TEXT,
  "is_default" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_addresses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "carts" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL,
  "store_id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "status" "cart_status" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cart_items" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL,
  "cart_id" TEXT NOT NULL,
  "variant_id" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "orders" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL,
  "store_id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "order_number" TEXT NOT NULL,
  "status" "order_status" NOT NULL DEFAULT 'PENDING',
  "currency" TEXT NOT NULL DEFAULT 'IRR',
  "subtotal_amount" BIGINT NOT NULL,
  "discount_amount" BIGINT NOT NULL DEFAULT 0,
  "shipping_amount" BIGINT NOT NULL DEFAULT 0,
  "total_amount" BIGINT NOT NULL,
  "coupon_code" TEXT,
  "shipping_address" JSONB,
  "customer_snapshot" JSONB NOT NULL,
  "note" TEXT,
  "idempotency_key" TEXT,
  "placed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "order_items" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "variant_id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "product_name" TEXT NOT NULL,
  "variant_title" TEXT NOT NULL,
  "sku" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unit_amount" BIGINT NOT NULL,
  "line_amount" BIGINT NOT NULL,
  CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "order_status_history" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "from_status" "order_status",
  "to_status" "order_status" NOT NULL,
  "actor_type" "actor_type" NOT NULL DEFAULT 'SYSTEM',
  "actor_id" TEXT,
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stock_reservations" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "variant_id" TEXT NOT NULL,
  "location_id" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "status" "reservation_status" NOT NULL DEFAULT 'ACTIVE',
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_reservations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payments" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "provider" "payment_provider" NOT NULL,
  "status" "payment_status" NOT NULL DEFAULT 'INITIATED',
  "amount" BIGINT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'IRR',
  "invoice_payload" TEXT NOT NULL,
  "provider_ref" TEXT,
  "verified_at" TIMESTAMP(3),
  "failure_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payment_events" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL,
  "payment_id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "dedupe_key" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "refunds" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL,
  "payment_id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "amount" BIGINT NOT NULL,
  "status" "refund_status" NOT NULL DEFAULT 'REQUESTED',
  "reason" TEXT,
  "provider_ref" TEXT,
  "created_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "subscriptions" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL,
  "plan_id" TEXT NOT NULL,
  "status" "subscription_status" NOT NULL DEFAULT 'TRIALING',
  "current_period_start" TIMESTAMP(3) NOT NULL,
  "current_period_end" TIMESTAMP(3) NOT NULL,
  "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "subscription_invoices" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL,
  "subscription_id" TEXT NOT NULL,
  "amount" BIGINT NOT NULL,
  "status" "invoice_status" NOT NULL DEFAULT 'OPEN',
  "period_start" TIMESTAMP(3) NOT NULL,
  "period_end" TIMESTAMP(3) NOT NULL,
  "paid_at" TIMESTAMP(3),
  "provider_ref" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "subscription_invoices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "webhook_events" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL,
  "connection_id" TEXT NOT NULL,
  "channel" "channel" NOT NULL,
  "external_event_id" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "webhook_status" NOT NULL DEFAULT 'RECEIVED',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT,
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processed_at" TIMESTAMP(3),
  CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "outbound_messages" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL,
  "connection_id" TEXT NOT NULL,
  "chat_id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "outbound_status" NOT NULL DEFAULT 'QUEUED',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT,
  "provider_message_id" TEXT,
  "idempotency_key" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sent_at" TIMESTAMP(3),
  CONSTRAINT "outbound_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_logs" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT,
  "actor_user_id" TEXT,
  "actor_type" "actor_type" NOT NULL DEFAULT 'USER',
  "action" TEXT NOT NULL,
  "entity_type" TEXT,
  "entity_id" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "ip" TEXT,
  "user_agent" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");
CREATE UNIQUE INDEX "refresh_sessions_token_hash_key" ON "refresh_sessions"("token_hash");
CREATE INDEX "refresh_sessions_user_id_idx" ON "refresh_sessions"("user_id");
CREATE UNIQUE INDEX "plans_code_key" ON "plans"("code");
CREATE UNIQUE INDEX "memberships_tenant_id_id_key" ON "memberships"("tenant_id", "id");
CREATE UNIQUE INDEX "memberships_tenant_id_user_id_key" ON "memberships"("tenant_id", "user_id");
CREATE INDEX "memberships_user_id_idx" ON "memberships"("user_id");
CREATE UNIQUE INDEX "stores_tenant_id_id_key" ON "stores"("tenant_id", "id");
CREATE UNIQUE INDEX "stores_tenant_id_slug_key" ON "stores"("tenant_id", "slug");
CREATE UNIQUE INDEX "channel_connections_webhook_key_key" ON "channel_connections"("webhook_key");
CREATE UNIQUE INDEX "channel_connections_tenant_id_id_key" ON "channel_connections"("tenant_id", "id");
CREATE UNIQUE INDEX "channel_connections_tenant_id_store_id_channel_key" ON "channel_connections"("tenant_id", "store_id", "channel");
CREATE UNIQUE INDEX "categories_tenant_id_id_key" ON "categories"("tenant_id", "id");
CREATE UNIQUE INDEX "categories_tenant_id_store_id_slug_key" ON "categories"("tenant_id", "store_id", "slug");
CREATE INDEX "categories_tenant_id_parent_id_idx" ON "categories"("tenant_id", "parent_id");
CREATE UNIQUE INDEX "products_tenant_id_id_key" ON "products"("tenant_id", "id");
CREATE INDEX "products_tenant_id_store_id_status_idx" ON "products"("tenant_id", "store_id", "status");
CREATE INDEX "products_tenant_id_store_id_idx" ON "products"("tenant_id", "store_id");
CREATE INDEX "products_tenant_id_category_id_idx" ON "products"("tenant_id", "category_id");
CREATE UNIQUE INDEX "product_variants_tenant_id_id_key" ON "product_variants"("tenant_id", "id");
CREATE UNIQUE INDEX "product_variants_tenant_id_sku_key" ON "product_variants"("tenant_id", "sku");
CREATE INDEX "product_variants_tenant_id_product_id_idx" ON "product_variants"("tenant_id", "product_id");
CREATE UNIQUE INDEX "product_media_tenant_id_id_key" ON "product_media"("tenant_id", "id");
CREATE INDEX "product_media_tenant_id_product_id_idx" ON "product_media"("tenant_id", "product_id");
CREATE INDEX "product_media_tenant_id_variant_id_idx" ON "product_media"("tenant_id", "variant_id");
CREATE UNIQUE INDEX "inventory_locations_tenant_id_id_key" ON "inventory_locations"("tenant_id", "id");
CREATE UNIQUE INDEX "inventory_locations_tenant_id_store_id_name_key" ON "inventory_locations"("tenant_id", "store_id", "name");
CREATE UNIQUE INDEX "inventory_balances_tenant_id_id_key" ON "inventory_balances"("tenant_id", "id");
CREATE UNIQUE INDEX "inventory_balances_tenant_id_variant_id_location_id_key" ON "inventory_balances"("tenant_id", "variant_id", "location_id");
CREATE INDEX "inventory_balances_tenant_id_location_id_idx" ON "inventory_balances"("tenant_id", "location_id");
CREATE UNIQUE INDEX "inventory_movements_tenant_id_id_key" ON "inventory_movements"("tenant_id", "id");
CREATE INDEX "inventory_movements_tenant_id_variant_id_created_at_idx" ON "inventory_movements"("tenant_id", "variant_id", "created_at");
CREATE INDEX "inventory_movements_tenant_id_ref_type_ref_id_idx" ON "inventory_movements"("tenant_id", "ref_type", "ref_id");
CREATE INDEX "inventory_movements_tenant_id_variant_id_idx" ON "inventory_movements"("tenant_id", "variant_id");
CREATE INDEX "inventory_movements_tenant_id_location_id_idx" ON "inventory_movements"("tenant_id", "location_id");
CREATE UNIQUE INDEX "customers_tenant_id_id_key" ON "customers"("tenant_id", "id");
CREATE INDEX "customers_tenant_id_phone_idx" ON "customers"("tenant_id", "phone");
CREATE UNIQUE INDEX "customer_identities_tenant_id_id_key" ON "customer_identities"("tenant_id", "id");
CREATE UNIQUE INDEX "customer_identities_tenant_id_channel_external_id_key" ON "customer_identities"("tenant_id", "channel", "external_id");
CREATE INDEX "customer_identities_tenant_id_customer_id_idx" ON "customer_identities"("tenant_id", "customer_id");
CREATE UNIQUE INDEX "customer_addresses_tenant_id_id_key" ON "customer_addresses"("tenant_id", "id");
CREATE INDEX "customer_addresses_tenant_id_customer_id_idx" ON "customer_addresses"("tenant_id", "customer_id");
CREATE UNIQUE INDEX "carts_tenant_id_id_key" ON "carts"("tenant_id", "id");
CREATE INDEX "carts_tenant_id_store_id_customer_id_status_idx" ON "carts"("tenant_id", "store_id", "customer_id", "status");
CREATE INDEX "carts_tenant_id_store_id_idx" ON "carts"("tenant_id", "store_id");
CREATE INDEX "carts_tenant_id_customer_id_idx" ON "carts"("tenant_id", "customer_id");
CREATE UNIQUE INDEX "cart_items_tenant_id_id_key" ON "cart_items"("tenant_id", "id");
CREATE UNIQUE INDEX "cart_items_tenant_id_cart_id_variant_id_key" ON "cart_items"("tenant_id", "cart_id", "variant_id");
CREATE INDEX "cart_items_tenant_id_variant_id_idx" ON "cart_items"("tenant_id", "variant_id");
CREATE UNIQUE INDEX "orders_tenant_id_id_key" ON "orders"("tenant_id", "id");
CREATE UNIQUE INDEX "orders_tenant_id_store_id_order_number_key" ON "orders"("tenant_id", "store_id", "order_number");
CREATE UNIQUE INDEX "orders_tenant_id_idempotency_key_key" ON "orders"("tenant_id", "idempotency_key");
CREATE INDEX "orders_tenant_id_status_created_at_idx" ON "orders"("tenant_id", "status", "created_at");
CREATE INDEX "orders_tenant_id_customer_id_idx" ON "orders"("tenant_id", "customer_id");
CREATE UNIQUE INDEX "order_items_tenant_id_id_key" ON "order_items"("tenant_id", "id");
CREATE INDEX "order_items_tenant_id_order_id_idx" ON "order_items"("tenant_id", "order_id");
CREATE INDEX "order_items_tenant_id_variant_id_idx" ON "order_items"("tenant_id", "variant_id");
CREATE UNIQUE INDEX "order_status_history_tenant_id_id_key" ON "order_status_history"("tenant_id", "id");
CREATE INDEX "order_status_history_tenant_id_order_id_idx" ON "order_status_history"("tenant_id", "order_id");
CREATE UNIQUE INDEX "stock_reservations_tenant_id_id_key" ON "stock_reservations"("tenant_id", "id");
CREATE INDEX "stock_reservations_status_expires_at_idx" ON "stock_reservations"("status", "expires_at");
CREATE INDEX "stock_reservations_tenant_id_order_id_idx" ON "stock_reservations"("tenant_id", "order_id");
CREATE INDEX "stock_reservations_tenant_id_variant_id_idx" ON "stock_reservations"("tenant_id", "variant_id");
CREATE INDEX "stock_reservations_tenant_id_location_id_idx" ON "stock_reservations"("tenant_id", "location_id");
CREATE UNIQUE INDEX "payments_tenant_id_id_key" ON "payments"("tenant_id", "id");
CREATE UNIQUE INDEX "payments_tenant_id_invoice_payload_key" ON "payments"("tenant_id", "invoice_payload");
CREATE UNIQUE INDEX "payments_provider_provider_ref_key" ON "payments"("provider", "provider_ref");
CREATE INDEX "payments_tenant_id_order_id_idx" ON "payments"("tenant_id", "order_id");
CREATE UNIQUE INDEX "payment_events_tenant_id_id_key" ON "payment_events"("tenant_id", "id");
CREATE UNIQUE INDEX "payment_events_tenant_id_dedupe_key_key" ON "payment_events"("tenant_id", "dedupe_key");
CREATE INDEX "payment_events_tenant_id_payment_id_idx" ON "payment_events"("tenant_id", "payment_id");
CREATE UNIQUE INDEX "refunds_tenant_id_id_key" ON "refunds"("tenant_id", "id");
CREATE INDEX "refunds_tenant_id_payment_id_idx" ON "refunds"("tenant_id", "payment_id");
CREATE INDEX "refunds_tenant_id_order_id_idx" ON "refunds"("tenant_id", "order_id");
CREATE UNIQUE INDEX "subscriptions_tenant_id_id_key" ON "subscriptions"("tenant_id", "id");
CREATE INDEX "subscriptions_tenant_id_status_idx" ON "subscriptions"("tenant_id", "status");
CREATE INDEX "subscriptions_plan_id_idx" ON "subscriptions"("plan_id");
CREATE UNIQUE INDEX "subscription_invoices_tenant_id_id_key" ON "subscription_invoices"("tenant_id", "id");
CREATE INDEX "subscription_invoices_tenant_id_subscription_id_idx" ON "subscription_invoices"("tenant_id", "subscription_id");
CREATE UNIQUE INDEX "webhook_events_tenant_id_id_key" ON "webhook_events"("tenant_id", "id");
CREATE UNIQUE INDEX "webhook_events_tenant_id_connection_id_external_event_id_key" ON "webhook_events"("tenant_id", "connection_id", "external_event_id");
CREATE INDEX "webhook_events_status_received_at_idx" ON "webhook_events"("status", "received_at");
CREATE UNIQUE INDEX "outbound_messages_tenant_id_id_key" ON "outbound_messages"("tenant_id", "id");
CREATE UNIQUE INDEX "outbound_messages_tenant_id_idempotency_key_key" ON "outbound_messages"("tenant_id", "idempotency_key");
CREATE INDEX "outbound_messages_status_created_at_idx" ON "outbound_messages"("status", "created_at");
CREATE INDEX "outbound_messages_tenant_id_connection_id_idx" ON "outbound_messages"("tenant_id", "connection_id");
CREATE INDEX "audit_logs_tenant_id_created_at_idx" ON "audit_logs"("tenant_id", "created_at");
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

ALTER TABLE "refresh_sessions" ADD CONSTRAINT "refresh_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stores" ADD CONSTRAINT "stores_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "channel_connections" ADD CONSTRAINT "channel_connections_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "channel_connections" ADD CONSTRAINT "channel_connections_tenant_id_store_id_fkey" FOREIGN KEY ("tenant_id", "store_id") REFERENCES "stores"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "categories" ADD CONSTRAINT "categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "categories" ADD CONSTRAINT "categories_tenant_id_store_id_fkey" FOREIGN KEY ("tenant_id", "store_id") REFERENCES "stores"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "categories" ADD CONSTRAINT "categories_tenant_id_parent_id_fkey" FOREIGN KEY ("tenant_id", "parent_id") REFERENCES "categories"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_tenant_id_store_id_fkey" FOREIGN KEY ("tenant_id", "store_id") REFERENCES "stores"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_tenant_id_category_id_fkey" FOREIGN KEY ("tenant_id", "category_id") REFERENCES "categories"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_tenant_id_product_id_fkey" FOREIGN KEY ("tenant_id", "product_id") REFERENCES "products"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_tenant_id_product_id_fkey" FOREIGN KEY ("tenant_id", "product_id") REFERENCES "products"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_tenant_id_variant_id_fkey" FOREIGN KEY ("tenant_id", "variant_id") REFERENCES "product_variants"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_locations" ADD CONSTRAINT "inventory_locations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_locations" ADD CONSTRAINT "inventory_locations_tenant_id_store_id_fkey" FOREIGN KEY ("tenant_id", "store_id") REFERENCES "stores"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_tenant_id_variant_id_fkey" FOREIGN KEY ("tenant_id", "variant_id") REFERENCES "product_variants"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_tenant_id_location_id_fkey" FOREIGN KEY ("tenant_id", "location_id") REFERENCES "inventory_locations"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_tenant_id_variant_id_fkey" FOREIGN KEY ("tenant_id", "variant_id") REFERENCES "product_variants"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_tenant_id_location_id_fkey" FOREIGN KEY ("tenant_id", "location_id") REFERENCES "inventory_locations"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_identities" ADD CONSTRAINT "customer_identities_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_identities" ADD CONSTRAINT "customer_identities_tenant_id_customer_id_fkey" FOREIGN KEY ("tenant_id", "customer_id") REFERENCES "customers"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_tenant_id_customer_id_fkey" FOREIGN KEY ("tenant_id", "customer_id") REFERENCES "customers"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "carts" ADD CONSTRAINT "carts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "carts" ADD CONSTRAINT "carts_tenant_id_store_id_fkey" FOREIGN KEY ("tenant_id", "store_id") REFERENCES "stores"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "carts" ADD CONSTRAINT "carts_tenant_id_customer_id_fkey" FOREIGN KEY ("tenant_id", "customer_id") REFERENCES "customers"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_tenant_id_cart_id_fkey" FOREIGN KEY ("tenant_id", "cart_id") REFERENCES "carts"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_tenant_id_variant_id_fkey" FOREIGN KEY ("tenant_id", "variant_id") REFERENCES "product_variants"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_tenant_id_store_id_fkey" FOREIGN KEY ("tenant_id", "store_id") REFERENCES "stores"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_tenant_id_customer_id_fkey" FOREIGN KEY ("tenant_id", "customer_id") REFERENCES "customers"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_tenant_id_order_id_fkey" FOREIGN KEY ("tenant_id", "order_id") REFERENCES "orders"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_tenant_id_variant_id_fkey" FOREIGN KEY ("tenant_id", "variant_id") REFERENCES "product_variants"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_tenant_id_order_id_fkey" FOREIGN KEY ("tenant_id", "order_id") REFERENCES "orders"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_tenant_id_order_id_fkey" FOREIGN KEY ("tenant_id", "order_id") REFERENCES "orders"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_tenant_id_variant_id_fkey" FOREIGN KEY ("tenant_id", "variant_id") REFERENCES "product_variants"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_tenant_id_location_id_fkey" FOREIGN KEY ("tenant_id", "location_id") REFERENCES "inventory_locations"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_id_order_id_fkey" FOREIGN KEY ("tenant_id", "order_id") REFERENCES "orders"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_tenant_id_payment_id_fkey" FOREIGN KEY ("tenant_id", "payment_id") REFERENCES "payments"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_tenant_id_payment_id_fkey" FOREIGN KEY ("tenant_id", "payment_id") REFERENCES "payments"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_tenant_id_order_id_fkey" FOREIGN KEY ("tenant_id", "order_id") REFERENCES "orders"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_tenant_id_subscription_id_fkey" FOREIGN KEY ("tenant_id", "subscription_id") REFERENCES "subscriptions"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_tenant_id_connection_id_fkey" FOREIGN KEY ("tenant_id", "connection_id") REFERENCES "channel_connections"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "outbound_messages" ADD CONSTRAINT "outbound_messages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "outbound_messages" ADD CONSTRAINT "outbound_messages_tenant_id_connection_id_fkey" FOREIGN KEY ("tenant_id", "connection_id") REFERENCES "channel_connections"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
