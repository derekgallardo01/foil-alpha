import { ReactNode } from "react";
import ClientLayout from "./client-layout"; // We'll create this next

// Export metadata for the default title
export const metadata = {
  title: "Foil Alpha - The Future of Pokémon Trading",
  description: "Join the elite network of Pokémon card traders with smart market insights. Get early access to limited-edition cards and exclusive deals.",
  keywords: "pokemon trading, pokemon cards, trading cards, market insights, price tracking",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}