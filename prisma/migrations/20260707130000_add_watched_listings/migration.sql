-- AlterTable
ALTER TABLE `user_cards` ADD COLUMN `ending_soon_notified` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `watched_listings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `user_card_id` INTEGER NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `watched_listings_user_id_idx`(`user_id`),
    INDEX `watched_listings_user_card_id_idx`(`user_card_id`),
    UNIQUE INDEX `watched_listings_user_id_user_card_id_key`(`user_id`, `user_card_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

