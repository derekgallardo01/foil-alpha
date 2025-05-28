// app/admin/users/page.tsx
import AdminUsersClient from "./admin-users-client";

// Export metadata to override the default title for this page
export const metadata = {
  title: "Admin - Users - TCG Market",
};

export default function AdminUsersPage() {
  return <AdminUsersClient />;
}