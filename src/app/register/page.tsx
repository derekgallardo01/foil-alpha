// app/register/page.tsx
import RegisterClient from "./register-client";

// Export metadata to override the default title for this page
export const metadata = {
  title: "Register - Foil Alpha",
};

export default function RegisterPage() {
  return <RegisterClient />;
}