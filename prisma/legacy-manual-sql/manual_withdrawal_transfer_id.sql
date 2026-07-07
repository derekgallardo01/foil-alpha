-- Persist the Stripe transfer id on a withdrawal (payout idempotency source of
-- truth). Additive: new nullable column.
-- Apply once:
--   npx prisma db execute --file prisma/migrations/manual_withdrawal_transfer_id.sql --schema prisma/schema.prisma

ALTER TABLE `wallet_withdrawals`
  ADD COLUMN `stripe_transfer_id` VARCHAR(255) NULL;
