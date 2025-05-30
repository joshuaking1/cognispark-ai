// src/app/chat/page.tsx
import ChatInterface from "@/components/chat/ChatInterface";
import { createSupabaseServerComponentClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function ChatPage() {
  const supabase = createSupabaseServerComponentClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?message=Please login to chat with Nova.");
  }

  return (
    // This div will be a flex child of the <main> tag from RootLayout
    // Let ChatInterface itself define its desired height or be flex-grow
    <div className="flex-grow flex flex-col"> {/* Allow this page content to grow */}
      <ChatInterface />
    </div>
  );
}
