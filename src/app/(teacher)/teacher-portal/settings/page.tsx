// src/app/(teacher)/teacher-portal/settings/page.tsx
import { createSupabaseServerComponentClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default async function TeacherSettingsPage() {
    const supabase = createSupabaseServerComponentClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login"); // Layout should also catch this

    const { data: profile } = await supabase.from('profiles').select('full_name, email').eq('id', user.id).single();

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Teacher Settings</h1>
            <Card>
                <CardHeader>
                    <CardTitle>Your Profile</CardTitle>
                    <CardDescription>Basic account information.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                    <p><strong>Name:</strong> {profile?.full_name || "N/A"}</p>
                    <p><strong>Email:</strong> {profile?.email || user.email}</p>
                    <p className="text-sm text-muted-foreground mt-4">
                        More settings (e.g., preferred subjects, notification preferences for teacher tools) will be available here soon.
                        You can update your main profile details (name, avatar, password) in the main <Link href="/settings" className="underline text-primary">Account Settings</Link>.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}