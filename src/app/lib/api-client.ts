import { getCurrentDevUserForAPI } from './dev-auth';

export const apiCall = async (url: string, options: RequestInit = {}) => {
    const devUser = getCurrentDevUserForAPI();

    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    // Add dev user header in development
    if (process.env.NODE_ENV === 'development' && devUser) {
        (headers as any)['x-dev-user-id'] = devUser.id.toString();
        console.log('🔧 API Call as user:', devUser.name, '| URL:', url);
    }

    return fetch(url, {
        ...options,
        headers,
    });
};

// Convenient wrapper functions for common API calls
export const apiBid = async (userCardId: number, amount: number) => {
    return apiCall('/api/bids', {
        method: 'POST',
        body: JSON.stringify({
            user_card_id: userCardId,
            amount: amount
        }),
    });
};

export const apiPurchase = async (userCardId: number) => {
    return apiCall('/api/transactions', {
        method: 'POST',
        body: JSON.stringify({
            user_card_id: userCardId,
            transaction_type: 'PURCHASE'
        }),
    });
};

export const apiUpdateCard = async (userCardId: number, updateData: any) => {
    return apiCall(`/api/user-cards/${userCardId}`, {
        method: 'PUT',
        body: JSON.stringify(updateData),
    });
};

export const apiGetMarketplace = async (searchParams?: URLSearchParams) => {
    const url = searchParams ? `/api/marketplace?${searchParams.toString()}` : '/api/marketplace';
    return apiCall(url);
};

export const apiGetUserCards = async (forSale?: boolean) => {
    const params = forSale !== undefined ? `?forSale=${forSale}` : '';
    return apiCall(`/api/user-cards${params}`);
};