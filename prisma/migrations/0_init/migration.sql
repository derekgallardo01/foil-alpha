-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `role` VARCHAR(50) NOT NULL DEFAULT 'user',
    `subscriptionStatus` VARCHAR(50) NOT NULL DEFAULT 'inactive',
    `last_login_at` DATETIME(0) NULL,
    `discord_access_token` VARCHAR(255) NULL,
    `discord_refresh_token` VARCHAR(255) NULL,
    `google_access_token` VARCHAR(255) NULL,
    `google_refresh_token` VARCHAR(255) NULL,
    `google_scopes` VARCHAR(255) NULL,
    `registeredAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `is_verified` TINYINT NULL DEFAULT 0,
    `verification_code` VARCHAR(10) NULL,
    `stripe_connect_account_id` VARCHAR(255) NULL,

    UNIQUE INDEX `email`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cards` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `price_tracker_id` VARCHAR(100) NOT NULL,
    `tcg_player_id` VARCHAR(100) NULL,
    `name` VARCHAR(255) NOT NULL,
    `card_number` VARCHAR(50) NOT NULL,
    `total_set_number` VARCHAR(50) NULL,
    `rarity` VARCHAR(100) NOT NULL,
    `card_type` VARCHAR(100) NULL,
    `hp` INTEGER NULL,
    `stage` VARCHAR(50) NULL,
    `set_id` VARCHAR(100) NOT NULL,
    `set_name` VARCHAR(255) NOT NULL,
    `image_url` VARCHAR(500) NULL,
    `market_price` DECIMAL(10, 2) NULL,
    `price_listings` INTEGER NULL,
    `primary_condition` VARCHAR(50) NULL,
    `price_last_updated` DATETIME(0) NULL,
    `tcg_player_url` VARCHAR(500) NULL,
    `artist` VARCHAR(255) NULL,
    `retreat_cost` INTEGER NULL,
    `data_completeness` INTEGER NULL DEFAULT 0,
    `needs_detailed_scrape` BOOLEAN NULL DEFAULT false,
    `last_scraped_at` DATETIME(0) NULL,
    `attacks_data` JSON NULL,
    `weakness_data` JSON NULL,
    `resistance_data` JSON NULL,
    `prices_data` JSON NULL,
    `ebay_data` JSON NULL,
    `price_history_data` JSON NULL,
    `price_source` VARCHAR(50) NULL,
    `last_updated` DATETIME(0) NULL,
    `sync_enabled` BOOLEAN NOT NULL DEFAULT true,
    `sync_errors` INTEGER NOT NULL DEFAULT 0,
    `source` ENUM('API', 'MANUAL', 'MIXED') NOT NULL DEFAULT 'API',
    `featured` BOOLEAN NOT NULL DEFAULT false,
    `view_count` INTEGER NOT NULL DEFAULT 0,
    `notes` TEXT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,
    `product_type` VARCHAR(20) NOT NULL DEFAULT 'CARD',
    `tcg` VARCHAR(50) NULL,
    `external_source` VARCHAR(30) NULL,
    `external_id` VARCHAR(100) NULL,

    UNIQUE INDEX `cards_price_tracker_id_key`(`price_tracker_id`),
    INDEX `cards_price_tracker_id_idx`(`price_tracker_id`),
    INDEX `cards_tcg_player_id_idx`(`tcg_player_id`),
    INDEX `cards_name_idx`(`name`),
    INDEX `cards_set_id_idx`(`set_id`),
    INDEX `cards_set_name_idx`(`set_name`),
    INDEX `cards_rarity_idx`(`rarity`),
    INDEX `cards_card_type_idx`(`card_type`),
    INDEX `cards_market_price_idx`(`market_price`),
    INDEX `cards_sync_enabled_idx`(`sync_enabled`),
    INDEX `cards_last_updated_idx`(`last_updated`),
    INDEX `cards_last_scraped_at_idx`(`last_scraped_at`),
    UNIQUE INDEX `uniq_cards_external`(`external_source`, `external_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `watchlist` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `retailer_name` VARCHAR(255) NOT NULL,
    `product_url` VARCHAR(255) NULL,
    `product_title` VARCHAR(255) NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `stock_quantity` INTEGER NULL,
    `stock_status` VARCHAR(50) NULL,
    `user_id` INTEGER NOT NULL,

    INDEX `user_id`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `waitlist` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(255) NOT NULL,
    `phone_number` VARCHAR(20) NULL,
    `name` VARCHAR(255) NOT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `status` VARCHAR(50) NULL DEFAULT 'PENDING',
    `source` VARCHAR(50) NULL DEFAULT 'WEBSITE',
    `metadata` JSON NULL,

    UNIQUE INDEX `email`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `activitylog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ActivityLog_userId_fkey`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reset_tokens` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(255) NOT NULL,
    `token` VARCHAR(64) NOT NULL,
    `expires` DATETIME(0) NOT NULL,

    UNIQUE INDEX `token`(`token`),
    INDEX `idx_expires`(`expires`),
    INDEX `idx_token`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_cards` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `owner_id` INTEGER NOT NULL,
    `card_id` INTEGER NOT NULL,
    `condition` VARCHAR(50) NULL,
    `is_for_sale` BOOLEAN NOT NULL DEFAULT false,
    `sale_type` VARCHAR(50) NULL,
    `fixed_price` DECIMAL(10, 2) NULL,
    `reserve_price` DECIMAL(10, 2) NULL,
    `auction_end` DATETIME(0) NULL,
    `is_sold` BOOLEAN NOT NULL DEFAULT false,
    `notes` VARCHAR(255) NULL,
    `acquired_date` DATETIME(0) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `is_graded` BOOLEAN NOT NULL DEFAULT false,
    `grade_label` VARCHAR(50) NULL,
    `acquired_market_price` DECIMAL(10, 2) NULL,
    `external_owned_id` VARCHAR(100) NULL,

    UNIQUE INDEX `uniq_uc_external_owned`(`external_owned_id`),
    INDEX `user_cards_owner_id_idx`(`owner_id`),
    INDEX `user_cards_card_id_idx`(`card_id`),
    INDEX `user_cards_is_for_sale_idx`(`is_for_sale`),
    INDEX `user_cards_is_sold_idx`(`is_sold`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bids` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userCardId` INTEGER NOT NULL,
    `bidderId` INTEGER NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `max_amount` DECIMAL(10, 2) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `bids_bidderId_fkey`(`bidderId`),
    INDEX `bids_userCardId_fkey`(`userCardId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `card_transaction_history` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userCardId` INTEGER NOT NULL,
    `fromUserId` INTEGER NULL,
    `toUserId` INTEGER NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `action` VARCHAR(50) NOT NULL,
    `notes` VARCHAR(255) NULL,

    INDEX `card_transaction_history_fromUserId_fkey`(`fromUserId`),
    INDEX `card_transaction_history_toUserId_fkey`(`toUserId`),
    INDEX `card_transaction_history_userCardId_fkey`(`userCardId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_wallets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `balance` DECIMAL(10, 2) NOT NULL,
    `frozen_balance` DECIMAL(10, 2) NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    UNIQUE INDEX `user_wallets_user_id_key`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wallet_transactions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `wallet_id` INTEGER NOT NULL,
    `transaction_type` VARCHAR(50) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `balance_before` DECIMAL(10, 2) NOT NULL,
    `balance_after` DECIMAL(10, 2) NOT NULL,
    `description` VARCHAR(255) NULL,
    `reference_type` VARCHAR(50) NOT NULL,
    `reference_id` INTEGER NULL,
    `admin_id` INTEGER NULL,
    `idempotency_key` VARCHAR(255) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `wallet_transactions_idempotency_key_key`(`idempotency_key`),
    INDEX `wallet_transactions_user_id_fkey`(`user_id`),
    INDEX `wallet_transactions_wallet_id_fkey`(`wallet_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wallet_withdrawals` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    `method` VARCHAR(100) NULL,
    `admin_id` INTEGER NULL,
    `admin_note` VARCHAR(255) NULL,
    `requested_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `processed_at` DATETIME(0) NULL,
    `stripe_transfer_id` VARCHAR(255) NULL,

    INDEX `wallet_withdrawals_user_id_idx`(`user_id`),
    INDEX `wallet_withdrawals_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `type` VARCHAR(50) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `message` TEXT NOT NULL,
    `data` JSON NULL,
    `read` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `notifications_user_id_read_idx`(`user_id`, `read`),
    INDEX `notifications_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `price_history` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `card_id` INTEGER NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `source` VARCHAR(50) NOT NULL DEFAULT 'pokemon_price_tracker_v2',
    `recorded_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `price_type` VARCHAR(50) NULL,
    `condition` VARCHAR(50) NULL,
    `tcg_player_id` VARCHAR(100) NULL,
    `listing_count` INTEGER NULL,
    `volume` INTEGER NULL,
    `data_source` VARCHAR(50) NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_card_date`(`card_id`, `recorded_at`),
    INDEX `idx_card_id`(`card_id`),
    INDEX `idx_recorded_at`(`recorded_at`),
    INDEX `idx_source`(`source`),
    INDEX `idx_tcg_player_id`(`tcg_player_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transactions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_card_id` INTEGER NOT NULL,
    `buyer_id` INTEGER NOT NULL,
    `seller_id` INTEGER NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `transaction_type` VARCHAR(50) NOT NULL,
    `status` VARCHAR(50) NOT NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `transactions_user_card_id_idx`(`user_card_id`),
    INDEX `transactions_buyer_id_idx`(`buyer_id`),
    INDEX `transactions_seller_id_idx`(`seller_id`),
    INDEX `transactions_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reviews` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `transaction_id` INTEGER NOT NULL,
    `reviewer_id` INTEGER NOT NULL,
    `seller_id` INTEGER NOT NULL,
    `rating` INTEGER NOT NULL,
    `comment` VARCHAR(500) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `reviews_transaction_id_key`(`transaction_id`),
    INDEX `reviews_seller_id_idx`(`seller_id`),
    INDEX `reviews_reviewer_id_idx`(`reviewer_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_wallet` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `wallet_type` ENUM('PLATFORM') NULL DEFAULT 'PLATFORM',
    `balance` DECIMAL(12, 2) NULL DEFAULT 0.00,
    `total_commissions` DECIMAL(12, 2) NULL DEFAULT 0.00,
    `total_marketplace_sales` DECIMAL(12, 2) NULL DEFAULT 0.00,
    `created_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_wallet_transactions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `admin_wallet_id` INTEGER NOT NULL,
    `transaction_type` ENUM('COMMISSION', 'MARKETPLACE_SALE', 'WITHDRAWAL', 'ADJUSTMENT') NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `balance_before` DECIMAL(12, 2) NOT NULL,
    `balance_after` DECIMAL(12, 2) NOT NULL,
    `description` VARCHAR(255) NULL,
    `reference_type` VARCHAR(50) NULL,
    `reference_id` INTEGER NULL,
    `user_card_id` INTEGER NULL,
    `buyer_id` INTEGER NULL,
    `seller_id` INTEGER NULL,
    `card_id` INTEGER NULL,
    `commission_rate` DECIMAL(5, 2) NULL,
    `admin_id` INTEGER NULL,
    `created_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `admin_wallet_id`(`admin_wallet_id`),
    INDEX `idx_created_at`(`created_at`),
    INDEX `idx_reference`(`reference_type`, `reference_id`),
    INDEX `idx_transaction_type`(`transaction_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `commission_settings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `setting_type` ENUM('GLOBAL', 'RARITY') NOT NULL,
    `setting_key` VARCHAR(50) NOT NULL,
    `commission_rate` DECIMAL(5, 2) NOT NULL,
    `is_active` BOOLEAN NULL DEFAULT true,
    `created_by` INTEGER NULL,
    `created_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_active`(`is_active`),
    INDEX `idx_setting_type`(`setting_type`),
    UNIQUE INDEX `unique_setting`(`setting_type`, `setting_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `catalog_inventory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `card_id` INTEGER NOT NULL,
    `quantity_available` INTEGER NOT NULL DEFAULT 0,
    `quantity_sold` INTEGER NOT NULL DEFAULT 0,
    `last_restock_date` DATETIME(0) NULL,
    `created_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `unique_card_inventory`(`card_id`),
    INDEX `idx_quantity_available`(`quantity_available`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `price_sync_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sync_type` VARCHAR(50) NOT NULL,
    `cards_processed` INTEGER NOT NULL DEFAULT 0,
    `cards_updated` INTEGER NOT NULL DEFAULT 0,
    `cards_failed` INTEGER NOT NULL DEFAULT 0,
    `cards_skipped` INTEGER NOT NULL DEFAULT 0,
    `total_api_requests` INTEGER NOT NULL DEFAULT 0,
    `api_errors` INTEGER NOT NULL DEFAULT 0,
    `rate_limit_hits` INTEGER NOT NULL DEFAULT 0,
    `start_time` DATETIME(0) NOT NULL,
    `end_time` DATETIME(0) NOT NULL,
    `duration_seconds` INTEGER NOT NULL DEFAULT 0,
    `error_details` JSON NULL,
    `performance_stats` JSON NULL,
    `triggered_by` VARCHAR(100) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `price_sync_logs_sync_type_idx`(`sync_type`),
    INDEX `price_sync_logs_start_time_idx`(`start_time`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `products` (
    `product_id` INTEGER NOT NULL,
    `tcin` VARCHAR(50) NULL,
    `retailer` VARCHAR(100) NULL,
    `title` VARCHAR(500) NULL,
    `url` VARCHAR(1000) NULL,
    `image` VARCHAR(1000) NULL,
    `screenshot` VARCHAR(1000) NULL,
    `stock_status` VARCHAR(100) NULL,
    `release_date` DATE NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `products_tcin_key`(`tcin`),
    PRIMARY KEY (`product_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pricehistory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `product_id` INTEGER NOT NULL,
    `retailer` VARCHAR(100) NULL,
    `price` DECIMAL(10, 2) NULL,
    `recorded_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `stock_status` VARCHAR(100) NULL,
    `store_quantity` INTEGER NULL DEFAULT 0,
    `ship_quantity` INTEGER NULL DEFAULT 0,

    INDEX `idx_ph_product`(`product_id`),
    INDEX `idx_ph_recorded`(`recorded_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

