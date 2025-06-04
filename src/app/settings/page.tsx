"use client";

import { useState, useEffect, FormEvent, ChangeEvent, useRef } from "react";
import { createPagesBrowserClient } from "@supabase/auth-helpers-nextjs";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, UploadCloud, UserCircle2, KeyRound, Edit3, HelpCircle, Eye, EyeOff, Camera, Check, X, Settings, ShieldAlert, User as UserIcon, Save, Trash, Trash2, AlertTriangle, ArrowRight, Info } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { updateUserProfile, uploadAvatarAction, changeUserPasswordAction, deleteAccountAction } from "@/app/actions/userSettingsActions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TagInput, type Tag as TagType } from "@/components/ui/tag-input";
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ProfileData {
  full_name: string | null;
  avatar_url: string | null;
  date_of_birth: string | null;
  grade_level: string | null;
  subjects_of_interest: string[];
  learning_goals: string[];
}

interface UpdateProfilePayload {
  fullName?: string | null;
  date_of_birth?: string | null;
  grade_level?: string | null;
  subjects_of_interest?: string[];
  learning_goals?: string[];
  has_completed_onboarding?: boolean;
}

const gradeLevels = [
  { value: "not_specified", label: "Not Specified" },
  { value: "kindergarten", label: "Kindergarten" },
  { value: "grade_1", label: "1st Grade" },
  { value: "grade_2", label: "2nd Grade" },
  { value: "grade_3", label: "3rd Grade" },
  { value: "grade_4", label: "4th Grade" },
  { value: "grade_5", label: "5th Grade" },
  { value: "grade_6", label: "6th Grade" },
  { value: "grade_7", label: "7th Grade" },
  { value: "grade_8", label: "8th Grade" },
  { value: "grade_9", label: "9th Grade" },
  { value: "grade_10", label: "10th Grade (SHS1)" },
  { value: "grade_11", label: "11th Grade (SHS2)" },
  { value: "grade_12", label: "12th Grade (SHS3)" },
  { value: "college", label: "College/University" },
  { value: "adult_learner", label: "Adult Learner" },
  { value: "other", label: "Other" }
];

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState<boolean>(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState<boolean>(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<string>("");
  const [passwordStrength, setPasswordStrength] = useState<number>(0);
  const [activeTab, setActiveTab] = useState('profile');
  const [showPassword, setShowPassword] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    full_name: "",
    date_of_birth: "",
    grade_level: "",
    subjects_of_interest: [] as TagType[],
    learning_goals: [] as TagType[]
  });

  const [originalFormData, setOriginalFormData] = useState({
    full_name: "",
    date_of_birth: "",
    grade_level: "",
    subjects_of_interest: [] as TagType[],
    learning_goals: [] as TagType[]
  });

  const [passwordData, setPasswordData] = useState({
    current_password: "",
    new_password: "",
    confirm_password: ""
  });

  // Check for unsaved changes
  useEffect(() => {
    const hasChanges = JSON.stringify(formData) !== JSON.stringify(originalFormData);
    setHasUnsavedChanges(hasChanges);
  }, [formData, originalFormData]);

  // Password strength checker
  const checkPasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.match(/[a-z]/)) strength++;
    if (password.match(/[A-Z]/)) strength++;
    if (password.match(/[0-9]/)) strength++;
    if (password.match(/[^a-zA-Z0-9]/)) strength++;
    return strength;
  };

  useEffect(() => {
    setPasswordStrength(checkPasswordStrength(passwordData.new_password));
  }, [passwordData.new_password]);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const supabase = createPagesBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          router.push('/login');
          return;
        }

        setUser(user);

        const { data: profileData } = await supabase // Renamed to avoid conflict with state variable
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileData) {
          setProfile(profileData);
          const profileFormData = {
            full_name: profileData.full_name || "",
            date_of_birth: profileData.date_of_birth || "",
            grade_level: profileData.grade_level || "",
            subjects_of_interest: (profileData.subjects_of_interest || []).map((subject: string) => ({ 
              id: subject, 
              text: subject 
            })),
            learning_goals: (profileData.learning_goals || []).map((goal: string) => ({ 
              id: goal, 
              text: goal 
            }))
          };
          setFormData(profileFormData);
          setOriginalFormData(profileFormData);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        toast.error("Failed to load profile data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [router]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleTagChange = (name: string, tags: TagType[]) => {
    setFormData(prev => ({ ...prev, [name]: tags }));
  };

  const handlePasswordChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
  };

  const togglePasswordVisibility = (field: 'current' | 'new' | 'confirm') => {
    setShowPassword(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const resetForm = () => {
    setFormData(originalFormData);
    setHasUnsavedChanges(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const result = await updateUserProfile({
        fullName: formData.full_name || null,
        date_of_birth: formData.date_of_birth || null,
        grade_level: formData.grade_level || null,
        subjects_of_interest: formData.subjects_of_interest.map(tag => tag.text),
        learning_goals: formData.learning_goals.map(tag => tag.text)
      });

      if (result.success && result.data) { // Ensure result.data is checked
        toast.success("Profile updated successfully!");
        // Assuming result.data is the updated profile of type ProfileData
        // If not, adjust this line or how you fetch/update profile state
        setProfile(prev => prev ? { ...prev, ...result.data } : result.data as ProfileData);
        setOriginalFormData(formData);
        setHasUnsavedChanges(false);
      } else {
        toast.error("Failed to update profile", { description: result.error });
      }
    } catch (error: any) {
      toast.error("Error updating profile", { description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!passwordData.current_password || !passwordData.new_password || !passwordData.confirm_password) {
      toast.error("Please fill in all password fields");
      return;
    }

    if (passwordData.new_password !== passwordData.confirm_password) {
      toast.error("New passwords don't match");
      return;
    }

    if (passwordData.new_password.length < 8 || checkPasswordStrength(passwordData.new_password) < 3) {
        toast.error("Password is not strong enough. Please follow the guidelines.");
        return;
    }

    setIsChangingPassword(true);
    try {
        // Note: Supabase's updateUser method is used for password change.
        // It requires the user to be authenticated.
        // The `changeUserPasswordAction` should handle this correctly with Supabase.
        const supabase = createPagesBrowserClient();
        const { error } = await supabase.auth.updateUser({ password: passwordData.new_password });


      if (!error) {
        toast.success("Password changed successfully! You might be signed out and need to log in again.");
        setPasswordData({
          current_password: "",
          new_password: "",
          confirm_password: ""
        });
        // Optionally, sign the user out or prompt them to re-login for security.
        // await supabase.auth.signOut();
        // router.push('/login');
      } else {
        // More specific error handling based on Supabase errors
        if (error.message.includes("same password") || error.message.includes("New password should be different")) {
            toast.error("New password must be different from the old password.");
        } else if (error.message.includes("weak password")) {
             toast.error("The new password is too weak. Please choose a stronger one.");
        }
        else {
            toast.error("Failed to change password", { description: error.message });
        }
      }
    } catch (error: any) {
      toast.error("Error changing password", { description: error.message });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleAvatarUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Please select a valid image file (JPEG, PNG, GIF).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be less than 5MB.");
      return;
    }

    setIsUploading(true);
    try {
      const formDataPayload = new FormData(); // Renamed to avoid conflict
      formDataPayload.append("avatar", file);
      const result = await uploadAvatarAction(formDataPayload);
      
      if (result.success && result.data?.avatar_url) {
        toast.success("Profile picture updated!");
        setProfile(prev => prev ? { ...prev, avatar_url: result.data.avatar_url } : { avatar_url: result.data.avatar_url } as ProfileData);
      } else {
        toast.error("Failed to upload profile picture", { description: result.error });
      }
    } catch (error: any) {
      toast.error("Error uploading profile picture", { description: error.message });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    try {
      const result = await deleteAccountAction();
      if (result.success) {
        toast.success("Account deleted successfully. You will be redirected.");
        await createPagesBrowserClient().auth.signOut(); // Ensure user is signed out
        router.push('/'); 
      } else {
        toast.error("Failed to delete account", { description: result.error });
      }
    } catch (error: any) {
      toast.error("Error deleting account", { description: error.message });
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const getPasswordStrengthColor = (strength: number) => {
    if (strength <= 2) return "bg-red-500";
    if (strength <= 3) return "bg-yellow-500"; // Changed from amber for default tailwind
    return "bg-green-500";
  };

  const getPasswordStrengthText = (strength: number) => {
    if (strength <= 2) return "Weak";
    if (strength <= 3) return "Medium";
    return "Strong";
  };

  if (isLoading) {
    return (
      <div className="bg-gray-50 dark:bg-gray-950 min-h-screen">
        <div className="container mx-auto py-12 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="mb-8">
              <div className="h-10 bg-gray-300 dark:bg-gray-700 rounded w-1/4 mb-3 animate-pulse"></div>
              <div className="h-5 bg-gray-300 dark:bg-gray-700 rounded w-1/2 animate-pulse"></div>
            </div>
            
            <div className="flex mb-8 space-x-2 bg-gray-200 dark:bg-gray-800/50 p-1 rounded-lg w-fit">
              <div className="h-10 w-28 bg-gray-300 dark:bg-gray-700 rounded-md animate-pulse"></div>
              <div className="h-10 w-28 bg-gray-400/50 dark:bg-gray-700/50 rounded-md animate-pulse"></div>
              <div className="h-10 w-28 bg-gray-400/50 dark:bg-gray-700/50 rounded-md animate-pulse"></div>
            </div>
            
            <Card className="border border-gray-200 dark:border-gray-700/50 shadow-sm bg-white dark:bg-gray-900">
              <CardContent className="p-8">
                <div className="animate-pulse space-y-8">
                  <div className="flex items-center gap-6">
                    <div className="w-24 h-24 bg-gray-300 dark:bg-gray-700 rounded-full ring-4 ring-gray-300/30 dark:ring-gray-700/30"></div>
                    <div className="space-y-3">
                      <div className="h-5 bg-gray-300 dark:bg-gray-700 rounded w-40"></div>
                      <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-56"></div>
                      <div className="h-9 bg-gray-300 dark:bg-gray-700 rounded w-48"></div>
                    </div>
                  </div>
                  <div className="h-px w-full bg-gray-300/50 dark:bg-gray-700/50"></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-24"></div>
                      <div className="h-10 bg-gray-300 dark:bg-gray-700 rounded"></div>
                    </div>
                    <div className="space-y-3">
                      <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-24"></div>
                      <div className="h-10 bg-gray-300 dark:bg-gray-700 rounded"></div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-950 min-h-screen">
      <div className="container mx-auto py-12 px-4">
        <div className="max-w-5xl mx-auto space-y-10">
          {/* Header */}
          <div className="space-y-3 relative pb-6">
            <div className="absolute top-0 left-0 w-full h-40 bg-gradient-to-r from-[#fd6a3e]/5 to-[#fd6a3e]/10 rounded-xl -z-10 blur-2xl opacity-70"></div>
            <div className="flex items-center gap-3">
              <Settings className="h-9 w-9 text-[#fd6a3e]" />
              <h1 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[#fd6a3e] to-[#e05c35]">Settings</h1>
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-lg max-w-2xl">
              Manage your account settings, preferences, and security options.
            </p>
          </div>
          
          <Tabs defaultValue="profile" className="w-full" onValueChange={setActiveTab}>
            <TabsList className="mb-8 grid grid-cols-3 md:w-fit bg-gray-100 dark:bg-gray-800/60 p-1 rounded-lg shadow-sm">
              <TabsTrigger value="profile" className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium data-[state=inactive]:text-[#022e7d] data-[state=inactive]:dark:text-sky-300 data-[state=inactive]:hover:bg-[#fd6a3e]/10 data-[state=inactive]:hover:text-[#fd6a3e] data-[state=active]:bg-[#fd6a3e] data-[state=active]:text-white data-[state=active]:shadow-md rounded-md transition-all duration-200">
                <UserIcon className="h-4 w-4" />
                <span>Profile</span>
              </TabsTrigger>
              <TabsTrigger value="password" className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium data-[state=inactive]:text-[#022e7d] data-[state=inactive]:dark:text-sky-300 data-[state=inactive]:hover:bg-[#fd6a3e]/10 data-[state=inactive]:hover:text-[#fd6a3e] data-[state=active]:bg-[#fd6a3e] data-[state=active]:text-white data-[state=active]:shadow-md rounded-md transition-all duration-200">
                <KeyRound className="h-4 w-4" />
                <span>Password</span>
              </TabsTrigger>
              <TabsTrigger value="danger" className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium data-[state=inactive]:text-[#022e7d] data-[state=inactive]:dark:text-sky-300 data-[state=inactive]:hover:bg-[#fd6a3e]/10 data-[state=inactive]:hover:text-[#fd6a3e] data-[state=active]:bg-[#fd6a3e] data-[state=active]:text-white data-[state=active]:shadow-md rounded-md transition-all duration-200">
                <ShieldAlert className="h-4 w-4" />
                <span>Account</span>
              </TabsTrigger>
            </TabsList>

            {/* Profile Section */}
            <TabsContent value="profile" className="mt-0 space-y-4">
              <Card className="bg-white dark:bg-gray-900 shadow-md hover:shadow-lg transition-all duration-200 border-t-4 border-[#fd6a3e] rounded-xl overflow-hidden">
                <CardHeader className="pb-4 bg-gray-50 dark:bg-gray-800/50 border-b dark:border-gray-700/50">
                  <CardTitle className="text-2xl flex items-center gap-2.5 text-[#022e7d] dark:text-sky-400">
                    <UserCircle2 className="h-6 w-6 text-[#fd6a3e]" />
                    Profile Settings
                  </CardTitle>
                  <CardDescription className="text-base text-gray-600 dark:text-gray-400 pt-0.5">
                    Update your personal information and learning preferences.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 md:p-8">
                  <form onSubmit={handleSubmit} className="space-y-8">
                    <div className="flex flex-col sm:flex-row items-center gap-6 p-6 bg-gradient-to-br from-[#fd6a3e]/5 via-transparent to-transparent rounded-lg border border-gray-200 dark:border-gray-700/50 shadow-sm">
                      <div className="relative group">
                        <div className="w-28 h-28 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center ring-4 ring-[#fd6a3e]/20 group-hover:ring-[#fd6a3e]/40 shadow-lg transition-all duration-300">
                          {profile?.avatar_url ? (
                            <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover transition-all duration-300 group-hover:scale-105"/>
                          ) : (
                            <div className="bg-gradient-to-br from-[#fd6a3e]/10 to-[#fd6a3e]/20 w-full h-full flex items-center justify-center">
                              <UserCircle2 className="w-14 h-14 text-[#fd6a3e]/70" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                            <Camera className="h-6 w-6 text-white" />
                          </div>
                        </div>
                        <input type="file" ref={fileInputRef} onChange={handleAvatarUpload} accept="image/*" className="hidden" aria-label="Upload profile picture"/>
                        <Button type="button" variant="secondary" size="icon" className="absolute -bottom-1 -right-1 h-9 w-9 rounded-full p-0 shadow-lg bg-[#fd6a3e] text-white hover:bg-[#e05c35] transition-all duration-200" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                          {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                        </Button>
                      </div>
                      <div className="text-center sm:text-left">
                        <h3 className="font-semibold text-xl text-[#022e7d] dark:text-sky-300 mb-1">Profile Picture</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Enhance your profile with a clear photo.</p>
                        <div className="flex gap-3 flex-wrap justify-center sm:justify-start">
                          <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="border-[#022e7d] text-[#022e7d] hover:bg-[#022e7d]/10 dark:border-[#fd6a3e] dark:text-[#fd6a3e] dark:hover:bg-[#fd6a3e]/10 shadow-sm transition-all">
                            {isUploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...</> : <><UploadCloud className="mr-2 h-4 w-4" /> Choose Image</>}
                          </Button>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">JPG, PNG, GIF (Max 5MB)</p>
                      </div>
                    </div>

                    <Separator className="my-6 bg-gray-200 dark:bg-gray-700/50" />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                      <div className="space-y-2">
                        <Label htmlFor="full_name" className="text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</Label>
                        <div className="relative group">
                          <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500 group-focus-within:text-[#fd6a3e] transition-colors" />
                          <Input id="full_name" name="full_name" value={formData.full_name} onChange={handleInputChange} placeholder="Your Full Name" className="pl-10 bg-gray-50 dark:bg-gray-800/70 border-gray-300 dark:border-gray-700 shadow-sm focus:border-[#fd6a3e] focus:ring-1 focus:ring-[#fd6a3e]/30" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="date_of_birth" className="text-sm font-medium text-gray-700 dark:text-gray-300">Date of Birth</Label>
                        <Input id="date_of_birth" name="date_of_birth" type="date" value={formData.date_of_birth} onChange={handleInputChange} className="bg-gray-50 dark:bg-gray-800/70 border-gray-300 dark:border-gray-700 shadow-sm focus:border-[#fd6a3e] focus:ring-1 focus:ring-[#fd6a3e]/30" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="grade_level" className="text-sm font-medium text-gray-700 dark:text-gray-300">Grade Level</Label>
                      <Select value={formData.grade_level} onValueChange={(value) => handleSelectChange('grade_level', value)}>
                        <SelectTrigger className="bg-gray-50 dark:bg-gray-800/70 border-gray-300 dark:border-gray-700 shadow-sm focus:border-[#fd6a3e] focus:ring-1 focus:ring-[#fd6a3e]/30">
                          <SelectValue placeholder="Select your grade level" />
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 shadow-lg">
                          {gradeLevels.map((grade) => (
                            <SelectItem key={grade.value} value={grade.value} className="focus:bg-[#fd6a3e]/10 focus:text-[#fd6a3e] dark:focus:bg-[#fd6a3e]/20 dark:focus:text-[#fd6a3e] cursor-pointer">
                              {grade.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Subjects of Interest</Label>
                      <TagInput tags={formData.subjects_of_interest} setTags={(tags) => handleTagChange('subjects_of_interest', tags)} placeholder="Add subjects (e.g., Math, Science)" className="min-h-[48px] bg-gray-50 dark:bg-gray-800/70 border-gray-300 dark:border-gray-700 shadow-sm focus-within:border-[#fd6a3e] focus-within:ring-1 focus-within:ring-[#fd6a3e]/30" />
                      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                        <span className="flex items-center gap-1"><Edit3 className="h-3 w-3" /> Press Enter or comma to add</span>
                        {formData.subjects_of_interest.length > 0 && <Badge variant="secondary" className="ml-2 bg-[#fd6a3e]/10 hover:bg-[#fd6a3e]/20 text-[#fd6a3e] dark:bg-[#fd6a3e]/20 dark:hover:bg-[#fd6a3e]/30 dark:text-[#ff8a65]">{formData.subjects_of_interest.length} selected</Badge>}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Learning Goals</Label>
                      <TagInput tags={formData.learning_goals} setTags={(tags) => handleTagChange('learning_goals', tags)} placeholder="Add goals (e.g., Pass exams, Learn new skill)" className="min-h-[48px] bg-gray-50 dark:bg-gray-800/70 border-gray-300 dark:border-gray-700 shadow-sm focus-within:border-[#fd6a3e] focus-within:ring-1 focus-within:ring-[#fd6a3e]/30" />
                       <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                        <span className="flex items-center gap-1"><Edit3 className="h-3 w-3" /> Press Enter or comma to add</span>
                        {formData.learning_goals.length > 0 && <Badge variant="secondary" className="ml-2 bg-[#fd6a3e]/10 hover:bg-[#fd6a3e]/20 text-[#fd6a3e] dark:bg-[#fd6a3e]/20 dark:hover:bg-[#fd6a3e]/30 dark:text-[#ff8a65]">{formData.learning_goals.length} set</Badge>}
                      </div>
                    </div>
                    
                    {hasUnsavedChanges && (
                      <div className="flex items-center gap-2.5 text-sm text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/40 p-3.5 rounded-lg border border-yellow-300 dark:border-yellow-700/60 shadow-sm animate-pulse">
                        <Edit3 className="h-4 w-4 flex-shrink-0" />
                        <span>You have unsaved changes. Don't forget to save them!</span>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-3 pt-4">
                      <Button type="submit" disabled={isSaving || !hasUnsavedChanges} className="flex-1 sm:flex-none bg-[#fd6a3e] hover:bg-[#e05c35] text-white shadow-md hover:shadow-lg transition-all font-medium py-2.5 px-6">
                        {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Save className="mr-2 h-4 w-4" /> Save Changes</>}
                      </Button>
                      {hasUnsavedChanges && (
                        <Button type="button" variant="outline" onClick={resetForm} className="flex-1 sm:flex-none border-[#022e7d] text-[#022e7d] hover:bg-[#022e7d]/10 dark:border-[#fd6a3e] dark:text-[#fd6a3e] dark:hover:bg-[#fd6a3e]/10 shadow-sm transition-all py-2.5 px-6">
                          <X className="mr-2 h-4 w-4" /> Discard
                        </Button>
                      )}
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Password Section */}
            <TabsContent value="password" className="mt-0 space-y-4">
              <Card className="bg-white dark:bg-gray-900 shadow-md hover:shadow-lg transition-all duration-200 border-t-4 border-[#022e7d] rounded-xl overflow-hidden">
                <CardHeader className="pb-4 bg-gray-50 dark:bg-gray-800/50 border-b dark:border-gray-700/50">
                  <CardTitle className="text-2xl flex items-center gap-2.5 text-[#022e7d] dark:text-sky-400">
                    <KeyRound className="h-6 w-6 text-[#fd6a3e]" /> 
                    Security Settings
                  </CardTitle>
                  <CardDescription className="text-base text-gray-600 dark:text-gray-400 pt-0.5">
                    Update your account password for enhanced security.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 md:p-8">
                  <form onSubmit={handlePasswordSubmit} className="space-y-7">
                    <div className="space-y-2">
                      <Label htmlFor="current_password"className="text-sm font-medium text-gray-700 dark:text-gray-300">Current Password</Label>
                      <div className="relative group">
                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500 group-focus-within:text-[#fd6a3e] transition-colors" />
                        <Input id="current_password" name="current_password" type={showPassword.current ? "text" : "password"} value={passwordData.current_password} onChange={handlePasswordChange} placeholder="Enter current password" className="pl-10 pr-10 bg-gray-50 dark:bg-gray-800/70 border-gray-300 dark:border-gray-700 shadow-sm focus:border-[#fd6a3e] focus:ring-1 focus:ring-[#fd6a3e]/30" required/>
                        <Button type="button" variant="ghost" size="icon" className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8 hover:bg-transparent focus:bg-transparent text-gray-500 hover:text-[#fd6a3e]" onClick={() => togglePasswordVisibility('current')}>
                          {showPassword.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="new_password"className="text-sm font-medium text-gray-700 dark:text-gray-300">New Password</Label>
                       <div className="relative group">
                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500 group-focus-within:text-[#fd6a3e] transition-colors" />
                        <Input id="new_password" name="new_password" type={showPassword.new ? "text" : "password"} value={passwordData.new_password} onChange={handlePasswordChange} placeholder="Enter new password" minLength={8} className="pl-10 pr-10 bg-gray-50 dark:bg-gray-800/70 border-gray-300 dark:border-gray-700 shadow-sm focus:border-[#fd6a3e] focus:ring-1 focus:ring-[#fd6a3e]/30" required/>
                        <Button type="button" variant="ghost" size="icon" className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8 hover:bg-transparent focus:bg-transparent text-gray-500 hover:text-[#fd6a3e]" onClick={() => togglePasswordVisibility('new')}>
                          {showPassword.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                      {passwordData.new_password && (
                        <div className="space-y-2.5 mt-2.5 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-md border border-gray-200 dark:border-gray-700/50">
                          <div className="flex items-center justify-between text-xs font-medium">
                            <span>Strength: <span className={`${getPasswordStrengthColor(passwordStrength).replace('bg-', 'text-')} font-semibold`}>{getPasswordStrengthText(passwordStrength)}</span></span>
                            <span>{passwordStrength}/5</span>
                          </div>
                          <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden shadow-inner">
                            <div className={`h-full rounded-full transition-all duration-300 ${getPasswordStrengthColor(passwordStrength)}`} style={{ width: `${(passwordStrength / 5) * 100}%` }}/>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5 pt-2 text-xs">
                            {[
                              { check: passwordData.new_password.length >= 8, label: "At least 8 characters" },
                              { check: /[a-z]/.test(passwordData.new_password), label: "Lowercase letter (a-z)" },
                              { check: /[A-Z]/.test(passwordData.new_password), label: "Uppercase letter (A-Z)" },
                              { check: /[0-9]/.test(passwordData.new_password), label: "Number (0-9)" },
                              { check: /[^a-zA-Z0-9]/.test(passwordData.new_password), label: "Special character (!@#)" },
                            ].map(item => (
                              <div key={item.label} className={`flex items-center gap-1.5 ${item.check ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                                {item.check ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />} {item.label}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirm_password"className="text-sm font-medium text-gray-700 dark:text-gray-300">Confirm New Password</Label>
                      <div className="relative group">
                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500 group-focus-within:text-[#fd6a3e] transition-colors" />
                        <Input id="confirm_password" name="confirm_password" type={showPassword.confirm ? "text" : "password"} value={passwordData.confirm_password} onChange={handlePasswordChange} placeholder="Confirm new password" minLength={8} className="pl-10 pr-10 bg-gray-50 dark:bg-gray-800/70 border-gray-300 dark:border-gray-700 shadow-sm focus:border-[#fd6a3e] focus:ring-1 focus:ring-[#fd6a3e]/30" required/>
                         <Button type="button" variant="ghost" size="icon" className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8 hover:bg-transparent focus:bg-transparent text-gray-500 hover:text-[#fd6a3e]" onClick={() => togglePasswordVisibility('confirm')}>
                          {showPassword.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                      {passwordData.confirm_password && passwordData.new_password && (
                        <div className={`flex items-center gap-1.5 mt-1.5 text-sm px-3 py-1.5 rounded-md border w-full ${passwordData.new_password !== passwordData.confirm_password ? 'text-red-600 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/50' : 'text-green-600 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800/50'}`}>
                          {passwordData.new_password !== passwordData.confirm_password ? <><X className="h-4 w-4 flex-shrink-0" /> Passwords don't match</> : <><Check className="h-4 w-4 flex-shrink-0" /> Passwords match</>}
                        </div>
                      )}
                    </div>

                    <Button type="submit" disabled={isChangingPassword || !passwordData.new_password || !passwordData.confirm_password || passwordData.new_password !== passwordData.confirm_password || checkPasswordStrength(passwordData.new_password) < 3} className="w-full sm:w-auto bg-[#fd6a3e] hover:bg-[#e05c35] text-white shadow-md hover:shadow-lg transition-all font-medium py-2.5 px-6 mt-3">
                      {isChangingPassword ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Changing...</> : <><KeyRound className="mr-2 h-4 w-4" /> Change Password</>}
                    </Button>
                    
                    <div className="mt-8 p-4 bg-blue-50 dark:bg-[#022e7d]/20 rounded-lg border border-blue-200 dark:border-[#022e7d]/40">
                      <h4 className="text-sm font-semibold text-[#022e7d] dark:text-sky-300 flex items-center gap-2 mb-2.5">
                        <ShieldAlert className="h-5 w-5" /> Security Best Practices
                      </h4>
                      <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1.5">
                        <li className="flex items-start gap-1.5"><Check className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" /> Use a unique, strong password not used on other sites.</li>
                        <li className="flex items-start gap-1.5"><Check className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" /> Combine uppercase, lowercase, numbers, and symbols.</li>
                        <li className="flex items-start gap-1.5"><Check className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" /> Consider a password manager for secure storage.</li>
                      </ul>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Danger Zone */}
            <TabsContent value="danger" className="mt-0 space-y-4">
              <Card className="bg-white dark:bg-gray-900 shadow-md hover:shadow-lg transition-all duration-200 border-t-4 border-red-500 rounded-xl overflow-hidden">
                <CardHeader className="pb-4 bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-700/50">
                  <CardTitle className="text-2xl flex items-center gap-2.5 text-red-600 dark:text-red-500">
                    <div className="p-1.5 bg-red-100 dark:bg-red-500/20 rounded-full"><AlertTriangle className="h-5 w-5" /></div>
                    Danger Zone
                  </CardTitle>
                  <CardDescription className="text-base text-red-600/90 dark:text-red-500/90 pt-0.5">
                    Irreversible actions related to your account.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 md:p-8">
                  <div className="space-y-8">
                    <div className="p-6 bg-red-50/50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-700/40 shadow-sm">
                      <div className="flex flex-col sm:flex-row items-start gap-4">
                        <div className="flex-shrink-0 mt-1 sm:mt-0">
                          <div className="w-11 h-11 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center ring-2 ring-red-200 dark:ring-red-500/30">
                            <Trash2 className="h-5 w-5 text-red-600 dark:text-red-500" />
                          </div>
                        </div>
                        <div className="flex-1 space-y-3">
                          <div>
                            <h3 className="font-semibold text-red-600 dark:text-red-500 text-lg">Delete Account Permanently</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              Once your account is deleted, all data will be lost and cannot be recovered. Please proceed with extreme caution.
                            </p>
                          </div>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" className="mt-2 shadow-md hover:shadow-lg transition-all">
                                <Trash className="mr-2 h-4 w-4" /> Delete My Account
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="border-red-400 dark:border-red-600 shadow-xl bg-white dark:bg-gray-900">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-red-600 dark:text-red-500 flex items-center gap-2 text-xl">
                                  <AlertTriangle className="h-6 w-6" /> Are you absolutely sure?
                                </AlertDialogTitle>
                                <AlertDialogDescription className="space-y-3 pt-2 text-gray-600 dark:text-gray-400">
                                  <div className="p-3 bg-red-50 dark:bg-red-950/40 rounded-md border border-red-200 dark:border-red-700/50 text-sm">
                                    This action <span className="font-bold">cannot be undone</span>. This will permanently erase your profile, learning progress, and all associated data.
                                  </div>
                                  <div className="mt-2 space-y-1.5">
                                    <Label htmlFor="delete-confirmation" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                      To confirm, type <span className="font-mono font-bold text-red-600 dark:text-red-500">DELETE</span> below:
                                    </Label>
                                    <Input id="delete-confirmation" value={deleteConfirmation} onChange={(e) => setDeleteConfirmation(e.target.value)} className="border-gray-300 dark:border-gray-600 focus:border-red-500 focus:ring-1 focus:ring-red-500/30 bg-gray-50 dark:bg-gray-800" placeholder="DELETE"/>
                                  </div>
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter className="gap-2 pt-3">
                                <AlertDialogCancel className="border-gray-300 dark:border-gray-600 shadow-sm hover:shadow transition-all">Cancel</AlertDialogCancel>
                                <Button variant="destructive" onClick={handleDeleteAccount} disabled={deleteConfirmation !== "DELETE" || isDeletingAccount} className={`shadow-md hover:shadow-lg transition-all ${isDeletingAccount ? "opacity-70 cursor-not-allowed" : ""} ${deleteConfirmation === "DELETE" && !isDeletingAccount ? "animate-pulse" : ""}`}>
                                  {isDeletingAccount ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...</> : <><Trash2 className="mr-2 h-4 w-4" /> Delete Forever</>}
                                </Button>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg border border-yellow-200 dark:border-yellow-700/50 flex gap-3 items-start">
                      <div className="flex-shrink-0 text-yellow-500 dark:text-yellow-400 mt-0.5"><Info className="h-5 w-5" /></div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-yellow-700 dark:text-yellow-300">Before Deleting Your Account:</h4>
                        <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                          <li className="flex items-start gap-1.5"><ArrowRight className="h-3 w-3 mt-0.5 flex-shrink-0" /> Download any important data you wish to keep.</li>
                          <li className="flex items-start gap-1.5"><ArrowRight className="h-3 w-3 mt-0.5 flex-shrink-0" /> Contact support if you're facing issues that might be resolvable.</li>
                          <li className="flex items-start gap-1.5"><ArrowRight className="h-3 w-3 mt-0.5 flex-shrink-0" /> This action will remove all your learning progress and created content.</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}