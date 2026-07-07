-- Wallet withdrawals (seller cash-out requests). Additive: new table only.
-- Apply to prod once:  npx prisma db execute --file prisma/migrations/manual_wallet_withdrawals.sql --schema prisma/schema.prisma
-- (This repo has no prisma migration history — it uses db push / manual SQL.)

CREATE TABLE IF NOT EXISTS `wallet_withdrawals` (
  `id`           INT NOT NULL AUTO_INCREMENT,
  `user_id`      INT NOT NULL,
  `amount`       DECIMAL(10,2) NOT NULL,
  `status`       VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  `method`       VARCHAR(100) NULL,
  `admin_id`     INT NULL,
  `admin_note`   VARCHAR(255) NULL,
  `requested_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `processed_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  INDEX `wallet_withdrawals_user_id_idx` (`user_id`),
  INDEX `wallet_withdrawals_status_idx` (`status`)
);
