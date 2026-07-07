-- Proxy/auto-bid ceiling. Additive nullable column; NULL = a plain bid.
-- Apply once:
--   npx prisma db execute --file prisma/migrations/manual_bid_max_amount.sql --schema prisma/schema.prisma

ALTER TABLE `bids`
  ADD COLUMN `max_amount` DECIMAL(10, 2) NULL;
