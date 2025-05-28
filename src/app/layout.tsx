import { ReactNode } from "react";
import ClientLayout from "./client-layout"; // We'll create this next

// Export metadata for the default title
export const metadata = {
  title: "TCG Market",
  description: "Welcome to TCG Market",

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