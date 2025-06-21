import { getCurrentDevUserForAPI } from './dev-auth';

// Define a custom headers type to include x-dev-user-id
type CustomHeaders = HeadersInit & {
  'x-dev-user-id'?: string;
  'Content-Type'?: string; // Explicitly allow Content-Type
}

// Define the shape of updateData for apiUpdateCard
interface CardUpdateData {
  [key: string]: string | number | boolean | null; // Adjust based on actual fields
  // Example specific fields:
  // name?: string;
  // description?: string;
  // price?: number;
}

export const apiCall = async (url: string, options: RequestInit = {}) => {
  const devUser = getCurrentDevUserForAPI();

  const headers: CustomHeaders = {
    'Content-Type': 'application/json',
  };

  // Spread options.headers, ensuring compatibility
  if (options.headers) {
    const incomingHeaders = options.headers as Record<string, string> | Headers;
    if (incomingHeaders instanceof Headers) {
      incomingHeaders.forEach((value, key) => {
        headers[key] = value;
      });
    } else {
      Object.entries(incomingHeaders).forEach(([key, value]) => {
        if (value !== undefined) {
          headers[key] = value;
        }
      });
    }
  }

  // Add dev user header in development
  if (process.env.NODE_ENV === 'development' && devUser) {
    headers['x-dev-user-id'] = devUser.id.toString();
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
      amount: amount,
    }),
  });
};

export const apiPurchase = async (userCardId: number) => {
  return apiCall('/api/transactions', {
    method: 'POST',
    body: JSON.stringify({
      user_card_id: userCardId,
      transaction_type: 'PURCHASE',
    }),
  });
};

export const apiUpdateCard = async (userCardId: number, updateData: CardUpdateData) => {
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