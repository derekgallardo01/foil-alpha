-- Stripe Connect account id for seller payouts. Additive: new nullable column.
-- Apply once:
--   npx prisma db execute --file prisma/migrations/manual_user_stripe_connect.sql --schema prisma/schema.prisma

ALTER TABLE `users`
  ADD COLUMN `stripe_connect_account_id` VARCHAR(255) NULL;
