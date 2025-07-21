// src/app/lib/commission-utils.ts
import { prisma } from './prisma';

export interface CommissionCalculation {
    commission_rate: number;
    commission_amount: number;
    buyer_pays: number;
    seller_receives: number;
    admin_receives: number;
}

/**
 * Calculate commission for a card transaction
 * @param cardPrice - The base price of the card
 * @param cardRarity - The rarity of the card
 * @returns Commission calculation details
 */
export async function calculateCommission(
    cardPrice: number,
    cardRarity: string
): Promise<CommissionCalculation> {
    try {
        // Get rarity-specific commission rate first
        const rarityCommission = await prisma.$queryRaw`
      SELECT commission_rate FROM commission_settings 
      WHERE setting_type = 'RARITY' 
      AND setting_key = ${cardRarity} 
      AND is_active = TRUE
      LIMIT 1
    ` as any[];

        let commissionRate: number;

        if (rarityCommission.length > 0) {
            // Use rarity-specific rate
            commissionRate = Number(rarityCommission[0].commission_rate);
        } else {
            // Fall back to global rate
            const globalCommission = await prisma.$queryRaw`
        SELECT commission_rate FROM commission_settings 
        WHERE setting_type = 'GLOBAL' 
        AND setting_key = 'global' 
        AND is_active = TRUE
        LIMIT 1
      ` as any[];

            commissionRate = globalCommission.length > 0
                ? Number(globalCommission[0].commission_rate)
                : 5.00; // Default fallback
        }

        const commissionAmount = (cardPrice * commissionRate) / 100;

        return {
            commission_rate: commissionRate,
            commission_amount: commissionAmount,
            buyer_pays: cardPrice + commissionAmount,
            seller_receives: cardPrice - commissionAmount,
            admin_receives: commissionAmount
        };

    } catch (error) {
        console.error('Error calculating commission:', error);

        // Fallback to 5% global rate on error
        const commissionAmount = (cardPrice * 5) / 100;
        return {
            commission_rate: 5.00,
            commission_amount: commissionAmount,
            buyer_pays: cardPrice + commissionAmount,
            seller_receives: cardPrice - commissionAmount,
            admin_receives: commissionAmount
        };
    }
}

/**
 * Record commission transaction in admin wallet
 */
export async function recordCommissionTransaction(
    transactionDetails: {
        transaction_type: 'COMMISSION' | 'MARKETPLACE_SALE';
        amount: number;
        description: string;
        reference_type: string;
        reference_id?: number;
        user_card_id?: number;
        buyer_id?: number;
        seller_id?: number;
        card_id?: number;
        commission_rate?: number;
    },
    tx?: any // Prisma transaction
) {
    const prismaClient = tx || prisma;

    try {
        // Get or create admin wallet
        let adminWallet = await prismaClient.$queryRaw`
      SELECT * FROM admin_wallet WHERE wallet_type = 'PLATFORM' LIMIT 1
    ` as any[];

        if (adminWallet.length === 0) {
            await prismaClient.$executeRaw`
        INSERT INTO admin_wallet (wallet_type, balance, total_commissions, total_marketplace_sales)
        VALUES ('PLATFORM', 0.00, 0.00, 0.00)
      `;

            adminWallet = await prismaClient.$queryRaw`
        SELECT * FROM admin_wallet WHERE wallet_type = 'PLATFORM' LIMIT 1
      ` as any[];
        }

        const wallet = adminWallet[0];
        const currentBalance = Number(wallet.balance);
        const newBalance = currentBalance + transactionDetails.amount;

        // Update admin wallet balance
        if (transactionDetails.transaction_type === 'COMMISSION') {
            await prismaClient.$executeRaw`
        UPDATE admin_wallet 
        SET balance = balance + ${transactionDetails.amount},
            total_commissions = total_commissions + ${transactionDetails.amount}
        WHERE id = ${wallet.id}
      `;
        } else if (transactionDetails.transaction_type === 'MARKETPLACE_SALE') {
            await prismaClient.$executeRaw`
        UPDATE admin_wallet 
        SET balance = balance + ${transactionDetails.amount},
            total_marketplace_sales = total_marketplace_sales + ${transactionDetails.amount}
        WHERE id = ${wallet.id}
      `;
        }

        // Record transaction
        await prismaClient.$executeRaw`
      INSERT INTO admin_wallet_transactions 
      (admin_wallet_id, transaction_type, amount, balance_before, balance_after, description, 
       reference_type, reference_id, user_card_id, buyer_id, seller_id, card_id, commission_rate)
      VALUES (${wallet.id}, ${transactionDetails.transaction_type}, ${transactionDetails.amount}, 
              ${currentBalance}, ${newBalance}, ${transactionDetails.description},
              ${transactionDetails.reference_type}, ${transactionDetails.reference_id || null},
              ${transactionDetails.user_card_id || null}, ${transactionDetails.buyer_id || null},
              ${transactionDetails.seller_id || null}, ${transactionDetails.card_id || null},
              ${transactionDetails.commission_rate || null})
    `;

    } catch (error) {
        console.error('Error recording commission transaction:', error);
        throw error;
    }
}