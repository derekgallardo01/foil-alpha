-- Seller reviews: one per completed transaction (buyer rates seller).
-- Apply once:
--   npx prisma db execute --file prisma/migrations/manual_reviews.sql --schema prisma/schema.prisma

CREATE TABLE IF NOT EXISTS `reviews` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `transaction_id` INT NOT NULL,
  `reviewer_id` INT NOT NULL,
  `seller_id` INT NOT NULL,
  `rating` INT NOT NULL,
  `comment` VARCHAR(500) NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `reviews_transaction_id_key` (`transaction_id`),
  KEY `reviews_seller_id_idx` (`seller_id`),
  KEY `reviews_reviewer_id_idx` (`reviewer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
