// src/app/settings/page.tsx
"use client";

import { useState, useEffect, FormEvent, ChangeEvent, useRef } from "react";
// Use createBrowserClient for App Router client components generally
import { createPagesBrowserClient } from "@supabase/auth-helpers-nextjs";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, UploadCloud, UserCircle2, KeyRound, Edit3, BookOpen, CalendarDays, HelpCircle } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { updateUserProfile, uploadAvatarAction, changeUserPasswordAction, deleteAccountAction } from "@/app/actions/userSettingsActions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ProfileData {
  full_name: string | null;
  avatar_url: string | null;
  date_of_birth: string | null;
  grade_level: string | null;
  subjects_of_interest: string[];
}

const gradeLevels = [
  "Not Specified", "Kindergarten", "1st Grade", "2nd Grade", "3rd Grade", "4th Grade", "5th Grade",
  "6th Grade", "7th Grade", "8th Grade", "9th Grade", "10th Grade (SHS1)",
  "11th Grade (SHS2)", "12th Grade (SHS3)", "College/University", "Adult Learner", "Other"
];

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileData | Partial<ProfileData> | null>(null);
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [fullNameInput, setFullNameInput] = useState("");
  const [dobInput, setDobInput] = useState("");
  const [gradeLevelInput, setGradeLevelInput] = useState("");
  const [subjectsInput, setSubjectsInput] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const handleDeleteAccount = async () => {
    try {
      setIsDeletingAccount(true);
      const result = await deleteAccountAction();
      
      if (result.success) {
        toast.success("Account deleted successfully");
        router.push("/");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to delete account");
      }
    } catch (error) {
      console.error("Error deleting account:", error);
      toast.error("Failed to delete account");
    } finally {
      setIsDeletingAccount(false);
    }
  };

  // Initialize Supabase client for client-side operations
  // Note: Ensure your environment variables NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.
  const [supabase] = useState(() => createPagesBrowserClient());

  useEffect(() => {
    console.log("Settings page mounted");
    console.log("Supabase client initialized:", !!supabase);
    console.log("Environment variables:", {
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    });

    const fetchInitialData = async () => {
      console.log("Fetching initial data...");
      setIsLoadingPage(true);
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session?.user) {
        toast.error("Authentication Error", { description: "Could not retrieve user session. Redirecting to login." });
        router.push("/login");
        return;
      }
      setUser(session.user);

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, avatar_url, date_of_birth, grade_level, subjects_of_interest')
        .eq('id', session.user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        toast.error(`Could not fetch profile: ${profileError.message}`);
      } else if (profileData) {
        setProfile(profileData);
        setFullNameInput(profileData.full_name || "");
        setAvatarPreviewUrl(profileData.avatar_url || null);
        setDobInput(profileData.date_of_birth || "");
        setGradeLevelInput(profileData.grade_level || "Not Specified");
        setSubjectsInput((profileData.subjects_of_interest as string[] || []).join(", "));
      } else {
        // No profile yet, but user exists (e.g. profile creation trigger failed or is delayed)
        setFullNameInput("");
        setAvatarPreviewUrl(null);
        setGradeLevelInput("Not Specified");
      }
      setIsLoadingPage(false);
    };

    fetchInitialData();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT') {
          // Clear local state and redirect
          setUser(null);
          setProfile(null);
          setFullNameInput("");
          setAvatarPreviewUrl(null);
          setDobInput("");
          setGradeLevelInput("Not Specified");
          setSubjectsInput("");
          router.push('/login');
        } else if (session?.user && session.user.id !== user?.id) {
          // User changed, re-fetch data (less common on settings page itself)
          setUser(session.user);
          fetchInitialData(); // Re-fetch for the new user
        } else if (session?.user) {
            setUser(session.user); // Update user object if it changed (e.g. metadata)
        }
      }
    );
    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [supabase, router, user?.id]); // Added user?.id to dependency array for safety if user object identity changes

  const handleProfileUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) {
      toast.error("Not Authenticated", { description: "Please log in again." });
      return;
    }
    const subjectsArray = subjectsInput.split(',').map(s => s.trim()).filter(s => s.length > 0);
    const currentSubjects = (profile?.subjects_of_interest as string[] || []);
    const subjectsChanged = subjectsArray.length !== currentSubjects.length ||
                            !subjectsArray.every(subject => currentSubjects.includes(subject));
    if (fullNameInput.trim() === (profile?.full_name || "") &&
        dobInput === (profile?.date_of_birth || "") &&
        gradeLevelInput === (profile?.grade_level || "Not Specified") &&
        !subjectsChanged
    ) {
        toast.info("No changes made to profile details.");
        return;
    }
    setIsSavingProfile(true);
    try {
      const payload = {
        full_name: fullNameInput.trim() === "" ? null : fullNameInput.trim(),
        date_of_birth: dobInput === "" ? null : dobInput,
        grade_level: gradeLevelInput === "Not Specified" ? null : gradeLevelInput,
        subjects_of_interest: subjectsArray,
      };
      const result = await updateUserProfile(payload as any);
      if (result.success) {
        toast.success("Profile updated successfully!");
        setProfile(prev => ({
            ...(prev || {}),
            full_name: payload.full_name,
            date_of_birth: payload.date_of_birth,
            grade_level: payload.grade_level,
            subjects_of_interest: payload.subjects_of_interest,
        }));
      } else {
        toast.error(result.error || "Profile Update Failed");
      }
    } catch (e: any) { toast.error(e.message || "Profile Update Error");}
    finally { setIsSavingProfile(false); }
  };

  const handleAvatarFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error("Invalid file type", { description: "JPG, PNG, WEBP only." });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("File too large", { description: "Max 2MB." });
      return;
    }
    setSelectedAvatarFile(file);
    setAvatarPreviewUrl(URL.createObjectURL(file));
  };

  const handleAvatarUpload = async () => {
    if (!selectedAvatarFile || !user) {
      toast.error("No avatar selected or not logged in.");
      return;
    }
    setIsUploadingAvatar(true);
    const formData = new FormData();
    formData.append("avatar", selectedAvatarFile);
    try {
      const result = await uploadAvatarAction(formData);
      if (result.success && result.avatarUrl) {
        toast.success("Avatar updated successfully!");
        setProfile(prev => ({ ...(prev || {}), avatar_url: result.avatarUrl! }));
        setAvatarPreviewUrl(result.avatarUrl);
        setSelectedAvatarFile(null);
        if (avatarFileInputRef.current) avatarFileInputRef.current.value = "";
        window.dispatchEvent(new CustomEvent('profileUpdated'));
      } else {
        toast.error(result.error || "Avatar Upload Failed");
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleChangePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    if (newPassword !== confirmNewPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setIsChangingPassword(true);
    try {
      const result = await changeUserPasswordAction(newPassword);
      if (result.success) {
        toast.success("Password updated successfully!");
        setNewPassword("");
        setConfirmNewPassword("");
      } else {
        toast.error(result.error || "Password Update Failed");
      }
    } catch (e: any) {
      toast.error(e.message || "Password Update Error");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleShowWelcomeModal = async () => {
    try {
      // First, set has_completed_onboarding to false
      const result = await updateUserProfile({ has_completed_onboarding: false });
      if (result.success) {
        // Then navigate to dashboard where the modal will show
        router.push('/dashboard');
      } else {
        toast.error("Failed to reset onboarding status");
      }
    } catch (error) {
      console.error("Error resetting onboarding status:", error);
      toast.error("Failed to show welcome guide");
    }
  };

  if (isLoadingPage) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-0 flex justify-center items-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Loading settings...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-0">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Not Authorized</CardTitle>
            <CardDescription>
              You must be logged in to view your settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center py-8">
            <Button onClick={() => router.push('/login')}>
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 md:px-0">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl md:text-3xl">Account Settings</CardTitle>
          <CardDescription>
            Manage your profile, preferences, and account security.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-10">
          {/* Profile Information Form */}
          <form onSubmit={handleProfileUpdate} className="space-y-6">
            <h3 className="text-xl font-semibold border-b pb-3 flex items-center">
              <Edit3 className="mr-2 h-5 w-5 text-primary"/> Personal Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              <div className="space-y-1">
                <Label htmlFor="email" className="font-medium">Email</Label>
                <Input id="email" type="email" value={user.email || ""} readOnly disabled className="bg-muted/50" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="fullName" className="font-medium">Full Name</Label>
                <Input 
                  id="fullName" 
                  type="text" 
                  value={fullNameInput} 
                  onChange={(e) => setFullNameInput(e.target.value)} 
                  placeholder="Your full name" 
                  disabled={isSavingProfile} 
                />
              </div>
              {/* Date of Birth Input */}
              <div className="space-y-1">
                <Label htmlFor="dob" className="font-medium">Date of Birth</Label>
                <Input 
                  id="dob" 
                  type="date" 
                  value={dobInput} 
                  onChange={(e) => setDobInput(e.target.value)} 
                  disabled={isSavingProfile} 
                  className="block w-full" 
                />
              </div>
            </div>
            {/* Learning Preferences Section */}
            <div className="pt-4 space-y-4">
                <h4 className="text-lg font-medium flex items-center"><BookOpen className="mr-2 h-5 w-5 text-primary"/> Learning Preferences</h4>
                <div className="space-y-1">
                    <Label htmlFor="gradeLevel" className="font-medium">Grade Level</Label>
                    <Select
                        value={gradeLevelInput}
                        onValueChange={(value: string) => setGradeLevelInput(value)}
                        disabled={isSavingProfile}
                    >
                        <SelectTrigger className="w-full text-base">
                        <SelectValue placeholder="Select your grade level" />
                        </SelectTrigger>
                        <SelectContent>
                        {gradeLevels.map((grade) => (
                            <SelectItem key={grade} value={grade}>
                            {grade}
                            </SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1">
                    <Label htmlFor="subjectsOfInterest" className="font-medium">Subjects of Interest</Label>
                    <Input
                        id="subjectsOfInterest"
                        value={subjectsInput}
                        onChange={(e) => setSubjectsInput(e.target.value)}
                        placeholder="e.g., Math, Physics, History, Python Programming"
                        className="mt-1 text-base"
                        disabled={isSavingProfile}
                    />
                    <p className="text-xs text-muted-foreground">Enter subjects separated by commas.</p>
                </div>
            </div>
            <Button type="submit" disabled={isSavingProfile} className="w-full sm:w-auto">
              {isSavingProfile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Profile & Preferences
            </Button>
          </form>
          {/* Avatar Upload Section */}
          <div className="border-t pt-8 space-y-4">
            <h3 className="text-xl font-semibold border-b pb-3 flex items-center">
              <UserCircle2 className="mr-2 h-5 w-5 text-primary"/> Profile Picture
            </h3>
            <div className="flex flex-col items-center sm:flex-row sm:items-start gap-6">
              {avatarPreviewUrl ? (
                <img src={avatarPreviewUrl} alt="User avatar" className="h-24 w-24 md:h-32 md:w-32 rounded-full border object-cover shadow-sm" />
              ) : (
                <div className="h-24 w-24 md:h-32 md:w-32 rounded-full bg-muted flex items-center justify-center border">
                  <UserCircle2 className="h-16 w-16 text-muted-foreground" />
                </div>
              )}
              <div className="flex-grow space-y-3 text-center sm:text-left">
                <Label htmlFor="avatarUpload" className="cursor-pointer group">
                  <div className={`inline-flex items-center justify-center px-4 py-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${isUploadingAvatar ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <UploadCloud className="mr-2 h-5 w-5" />
                    {selectedAvatarFile ? "Change Photo" : "Upload Photo"}
                  </div>
                  <Input
                    id="avatarUpload"
                    type="file"
                    ref={avatarFileInputRef}
                    onChange={handleAvatarFileChange}
                    accept="image/png, image/jpeg, image/webp"
                    className="sr-only"
                    disabled={isUploadingAvatar}
                  />
                </Label>
                <p className="text-xs text-muted-foreground">JPG, PNG, WEBP. Max 2MB.</p>
                {selectedAvatarFile && !isUploadingAvatar && (
                  <div className="flex flex-col sm:flex-row gap-2 mt-2">
                    <Button onClick={handleAvatarUpload} className="flex-grow" disabled={isUploadingAvatar}>
                      {isUploadingAvatar ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      {isUploadingAvatar ? "Uploading..." : "Save Avatar"}
                    </Button>
                    <Button variant="outline" onClick={() => {
                        setSelectedAvatarFile(null);
                        setAvatarPreviewUrl(profile?.avatar_url || null);
                        if(avatarFileInputRef.current) avatarFileInputRef.current.value = "";
                    }} className="flex-grow" disabled={isUploadingAvatar}>
                        Cancel
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* Password Change Section */}
          <form onSubmit={handleChangePassword} className="border-t pt-8 space-y-6">
            <h3 className="text-xl font-semibold border-b pb-3 flex items-center">
              <KeyRound className="mr-2 h-5 w-5 text-primary"/> Change Password
            </h3>
            <div className="space-y-1">
              <Label htmlFor="newPassword">New Password</Label>
              <Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} disabled={isChangingPassword} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="confirmNewPassword">Confirm New Password</Label>
              <Input id="confirmNewPassword" type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} required minLength={6} disabled={isChangingPassword} />
            </div>
            <Button type="submit" disabled={isChangingPassword} className="w-full sm:w-auto">
              {isChangingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Update Password
            </Button>
          </form>
          {/* Account Actions Section (Delete Account) */}
          <div className="border-t pt-8">
            <h3 className="text-xl font-semibold text-destructive border-b pb-3">Danger Zone</h3>
            <div className="mt-4 p-4 border border-destructive/50 rounded-lg bg-destructive/5">
              <h4 className="text-lg font-medium text-destructive">Delete Your Account</h4>
              <p className="mt-1 text-sm text-destructive/90">
                This action is irreversible. All your data, including chats, notes, essays,
                and profile information, will be permanently erased.
              </p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="mt-4 w-full sm:w-auto" disabled={isDeletingAccount}>
                    {isDeletingAccount ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Delete My Account
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-destructive">Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete your account
                      and remove all your associated data from CogniSpark AI.
                      <br />
                      To confirm, please type "<strong>DELETE</strong>" in the box below.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <Input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder='Type "DELETE" here'
                    className="my-4 border-destructive focus-visible:ring-destructive"
                  />
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setDeleteConfirmText("")} disabled={isDeletingAccount}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAccount}
                      disabled={deleteConfirmText !== "DELETE" || isDeletingAccount}
                      className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                    >
                      {isDeletingAccount ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Yes, Delete My Account
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
          {/* Add this section before the Delete Account section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <HelpCircle className="h-5 w-5" />
                Help & Support
              </CardTitle>
              <CardDescription>
                Need help getting started or want to learn more about CogniSpark AI?
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  View our welcome guide again to learn about all the features and how to make the most of CogniSpark AI.
                </p>
                <Button
                  variant="outline"
                  onClick={handleShowWelcomeModal}
                  className="w-full sm:w-auto"
                >
                  <HelpCircle className="mr-2 h-4 w-4" />
                  Show Welcome Guide Again
                </Button>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}