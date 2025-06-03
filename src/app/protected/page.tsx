// /src/app/protected/page.tsx
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";


const ProtectedPage = async () => {
  // Get the session directly without needing authOptions import
  const session = await getServerSession();

  if (!session) {
    // Redirect to the sign-in page if not authenticated
    return NextResponse.redirect("/auth/signin");
  }

  // If session exists, render the protected page
  return (
    <div>
      <h1>Welcome to your protected page, {session.user.email}!</h1>
      {/* Your protected content goes here */}
    </div>
  );
};

export default ProtectedPage;
