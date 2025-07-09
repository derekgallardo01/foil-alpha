// src/app/types/freecurrencyapi.d.ts
declare module '@everapi/freecurrencyapi-js' {
    interface FreecurrencyApiResponse {
        data: Record<string, number>;
        meta?: {
            last_updated_at: string;
        };
    }

    interface FreecurrencyApiOptions {
        base_currency?: string;
        currencies?: string;
    }

    class Freecurrencyapi {
        constructor(apiKey: string);

        latest(options?: FreecurrencyApiOptions): Promise<FreecurrencyApiResponse>;
        historical(options?: FreecurrencyApiOptions & { date: string }): Promise<FreecurrencyApiResponse>;
        status(): Promise<any>;
        currencies(): Promise<any>;
    }

    export default Freecurrencyapi;
  }