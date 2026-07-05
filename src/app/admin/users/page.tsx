// app/admin/users/page.tsx
import AdminUsersClient from "./admin-users-client";

// Export metadata to override the default title for this page
export const metadata = {
  title: "Admin - Users - Foil Alpha",
};

export default function AdminUsersPage() {
  return <AdminUsersClient />;
}