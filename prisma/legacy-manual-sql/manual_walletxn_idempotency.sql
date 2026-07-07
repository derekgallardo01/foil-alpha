-- Idempotency key for externally-triggered wallet credits/reversals (Stripe
-- session / refund / dispute ids). Additive: new nullable unique column.
-- Apply once:
--   npx prisma db execute --file prisma/migrations/manual_walletxn_idempotency.sql --schema prisma/schema.prisma

ALTER TABLE `wallet_transactions`
  ADD COLUMN `idempotency_key` VARCHAR(255) NULL,
  ADD UNIQUE INDEX `wallet_transactions_idempotency_key_key` (`idempotency_key`);
