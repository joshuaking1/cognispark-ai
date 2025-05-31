// src/app/settings/page.tsx
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

        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profile) {
          setProfile(profile);
          const profileFormData = {
            full_name: profile.full_name || "",
            date_of_birth: profile.date_of_birth || "",
            grade_level: profile.grade_level || "",
            subjects_of_interest: (profile.subjects_of_interest || []).map((subject: string) => ({ 
              id: subject, 
              text: subject 
            })),
            learning_goals: (profile.learning_goals || []).map((goal: string) => ({ 
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

      if (result.success) {
        toast.success("Profile updated successfully!");
        setProfile(result.data);
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
    
    if (!passwordData.new_password || !passwordData.confirm_password) {
      toast.error("Please fill in all password fields");
      return;
    }

    if (passwordData.new_password !== passwordData.confirm_password) {
      toast.error("New passwords don't match");
      return;
    }

    if (passwordData.new_password.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }

    setIsChangingPassword(true);
    try {
      const result = await changeUserPasswordAction(passwordData.new_password);

      if (result.success) {
        toast.success("Password changed successfully!");
        setPasswordData({
          current_password: "",
          new_password: "",
          confirm_password: ""
        });
      } else {
        toast.error("Failed to change password", { description: result.error });
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

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error("Please select a valid image file");
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be less than 5MB");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const result = await uploadAvatarAction(formData);
      
      if (result.success) {
        toast.success("Profile picture updated!");
        setProfile(prev => prev ? { ...prev, avatar_url: result.data.avatar_url } : null);
      } else {
        toast.error("Failed to upload profile picture", { description: result.error });
      }
    } catch (error: any) {
      toast.error("Error uploading profile picture", { description: error.message });
    } finally {
      setIsUploading(false);
      // Clear the file input
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
        toast.success("Account deleted successfully");
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
    if (strength <= 3) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getPasswordStrengthText = (strength: number) => {
    if (strength <= 2) return "Weak";
    if (strength <= 3) return "Medium";
    return "Strong";
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8">
            <div className="h-10 bg-muted rounded w-1/4 mb-3 animate-pulse"></div>
            <div className="h-5 bg-muted rounded w-1/2 animate-pulse"></div>
          </div>
          
          {/* Skeleton tabs */}
          <div className="flex mb-8 space-x-2 bg-muted/20 p-1 rounded-lg w-fit">
            <div className="h-10 w-28 bg-muted rounded-md animate-pulse"></div>
            <div className="h-10 w-28 bg-muted/50 rounded-md animate-pulse"></div>
            <div className="h-10 w-28 bg-muted/50 rounded-md animate-pulse"></div>
          </div>
          
          <Card className="border border-muted/30 shadow-sm">
            <CardContent className="p-8">
              <div className="animate-pulse space-y-8">
                <div className="flex items-center gap-6">
                  <div className="w-24 h-24 bg-muted rounded-full ring-4 ring-muted/30"></div>
                  <div className="space-y-3">
                    <div className="h-5 bg-muted rounded w-40"></div>
                    <div className="h-4 bg-muted rounded w-56"></div>
                    <div className="h-9 bg-muted rounded w-48"></div>
                  </div>
                </div>
                <div className="h-px w-full bg-muted/50"></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div className="h-4 bg-muted rounded w-24"></div>
                    <div className="h-10 bg-muted rounded"></div>
                  </div>
                  <div className="space-y-3">
                    <div className="h-4 bg-muted rounded w-24"></div>
                    <div className="h-10 bg-muted rounded"></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-12 px-4 min-h-screen">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header with gradient */}
        <div className="space-y-3 relative pb-6">
          <div className="absolute top-0 left-0 w-full h-40 bg-gradient-to-r from-primary/5 to-primary/10 rounded-xl -z-10 blur-xl opacity-80"></div>
          <div className="flex items-center gap-3">
            <Settings className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/70">Settings</h1>
          </div>
          <p className="text-muted-foreground text-lg max-w-2xl">
            Manage your account settings, preferences, and security options.
          </p>
        </div>
        
        {/* Tabs Navigation */}
        <Tabs defaultValue="profile" className="w-full" onValueChange={setActiveTab}>

        <TabsList className="mb-8 grid grid-cols-3 md:w-fit">
          <TabsTrigger value="profile" className="flex items-center gap-2 px-4 py-2.5">
            <UserIcon className="h-4 w-4" />
            <span>Profile</span>
          </TabsTrigger>
          <TabsTrigger value="password" className="flex items-center gap-2 px-4 py-2.5">
            <KeyRound className="h-4 w-4" />
            <span>Password</span>
          </TabsTrigger>
          <TabsTrigger value="danger" className="flex items-center gap-2 px-4 py-2.5">
            <ShieldAlert className="h-4 w-4" />
            <span>Account</span>
          </TabsTrigger>
        </TabsList>

        {/* Profile Section */}
        <TabsContent value="profile" className="mt-0 space-y-4">
          <Card className="border-none shadow-md bg-card transition-all duration-200 hover:shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-2xl flex items-center gap-2 text-primary">
                <UserCircle2 className="h-6 w-6" />
                Profile Settings
              </CardTitle>
              <CardDescription className="text-base">
                Update your personal information and learning preferences
              </CardDescription>
            </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Avatar Upload */}
              <div className="flex flex-col sm:flex-row items-center gap-8 p-6 bg-gradient-to-br from-primary/5 via-background to-background rounded-xl">
                <div className="relative group">
                  <div className="w-28 h-28 rounded-full overflow-hidden bg-white dark:bg-gray-950 flex items-center justify-center ring-4 ring-primary/10 shadow-xl transition-all duration-300 group-hover:ring-primary/30">
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt="Profile"
                        className="w-full h-full object-cover transition-all duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="bg-gradient-to-br from-primary/10 to-primary/20 w-full h-full flex items-center justify-center">
                        <UserCircle2 className="w-14 h-14 text-primary/60" />
                      </div>
                    )}
                    
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 cursor-pointer">
                      <Camera className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleAvatarUpload}
                    accept="image/*"
                    className="hidden"
                    aria-label="Upload profile picture"
                  />
                  
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="absolute -bottom-1 -right-1 h-9 w-9 rounded-full p-0 shadow-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                
                <div className="text-center sm:text-left">
                  <h3 className="font-semibold text-xl text-primary/90 mb-1">Profile Picture</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Upload a professional photo for your profile
                  </p>
                  <div className="flex gap-3 flex-wrap justify-center sm:justify-start">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="bg-white dark:bg-gray-950 hover:bg-gray-50 dark:hover:bg-gray-900 shadow-sm border-primary/20 hover:border-primary/50 transition-all duration-200"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <UploadCloud className="mr-2 h-4 w-4" />
                          Choose image
                        </>
                      )}
                    </Button>
                    
                    {profile?.avatar_url && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive transition-colors duration-200"
                        onClick={() => {
                          // Handle remove avatar functionality
                          // This would need a backend function to be implemented
                          toast.info("Remove avatar functionality would be implemented here");
                        }}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Remove
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    JPG, PNG or GIF (max 5MB)
                  </p>
                </div>
              </div>

              <Separator className="my-6" />

              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                {/* Name */}
                <div className="space-y-2.5">
                  <Label htmlFor="full_name" className="text-sm font-medium text-foreground/90">Full Name</Label>
                  <div className="relative group">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors duration-200" />
                    <Input
                      id="full_name"
                      name="full_name"
                      value={formData.full_name}
                      onChange={handleInputChange}
                      placeholder="Enter your full name"
                      className="pl-10 bg-white dark:bg-gray-950 border-muted/30 shadow-sm hover:border-primary/50 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all duration-200"
                    />
                  </div>
                </div>

                {/* Date of Birth */}
                <div className="space-y-2.5">
                  <Label htmlFor="date_of_birth" className="text-sm font-medium text-foreground/90">Date of Birth</Label>
                  <div className="relative">
                    <Input
                      id="date_of_birth"
                      name="date_of_birth"
                      type="date"
                      value={formData.date_of_birth}
                      onChange={handleInputChange}
                      className="bg-white dark:bg-gray-950 border-muted/30 shadow-sm hover:border-primary/50 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all duration-200"
                    />
                  </div>
                </div>
              </div>

              {/* Grade Level */}
              <div className="space-y-2.5">
                <Label htmlFor="grade_level" className="text-sm font-medium text-foreground/90">Grade Level</Label>
                <Select
                  value={formData.grade_level}
                  onValueChange={(value) => handleSelectChange('grade_level', value)}
                >
                  <SelectTrigger className="bg-white dark:bg-gray-950 border-muted/30 shadow-sm hover:border-primary/50 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all duration-200">
                    <SelectValue placeholder="Select your grade level" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-gray-950 border-muted/30 shadow-md animate-in fade-in-80 zoom-in-95 rounded-lg">
                    {gradeLevels.map((grade) => (
                      <SelectItem 
                        key={grade.value} 
                        value={grade.value}
                        className="focus:bg-primary/10 focus:text-primary cursor-pointer transition-colors"
                      >
                        {grade.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Subjects of Interest */}
              <div className="space-y-2.5">
                <Label className="text-sm font-medium text-foreground/90">Subjects of Interest</Label>
                <TagInput
                  tags={formData.subjects_of_interest}
                  setTags={(tags) => handleTagChange('subjects_of_interest', tags)}
                  placeholder="Add subjects you're interested in..."
                  className="min-h-[48px] bg-white dark:bg-gray-950 border-muted/30 shadow-sm hover:border-primary/50 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 transition-all duration-200"
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground mt-1.5">
                  <span className="flex items-center gap-1">
                    <Edit3 className="h-3 w-3" />
                    Press Enter or comma to add a subject
                  </span>
                  {formData.subjects_of_interest.length > 0 && (
                    <Badge variant="secondary" className="ml-2 bg-primary/10 hover:bg-primary/20 text-primary transition-colors duration-200">
                      {formData.subjects_of_interest.length} selected
                    </Badge>
                  )}
                </div>
              </div>

              {/* Learning Goals */}
              <div className="space-y-2.5">
                <Label className="text-sm font-medium text-foreground/90">Learning Goals</Label>
                <TagInput
                  tags={formData.learning_goals}
                  setTags={(tags) => handleTagChange('learning_goals', tags)}
                  placeholder="Add your learning goals..."
                  className="min-h-[48px] bg-white dark:bg-gray-950 border-muted/30 shadow-sm hover:border-primary/50 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 transition-all duration-200"
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground mt-1.5">
                  <span className="flex items-center gap-1">
                    <Edit3 className="h-3 w-3" />
                    Press Enter or comma to add a goal
                  </span>
                  {formData.learning_goals.length > 0 && (
                    <Badge variant="secondary" className="ml-2 bg-primary/10 hover:bg-primary/20 text-primary transition-colors duration-200">
                      {formData.learning_goals.length} set
                    </Badge>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-6">
                <Button 
                  type="submit" 
                  disabled={isSaving || !hasUnsavedChanges} 
                  className="flex-1 sm:flex-none bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all duration-200 font-medium"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving Changes...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
                {hasUnsavedChanges && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={resetForm}
                    className="flex-1 sm:flex-none bg-white dark:bg-gray-950 hover:bg-gray-100 dark:hover:bg-gray-900 border-muted/50 hover:border-muted transition-all duration-200"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Discard Changes
                  </Button>
                )}
              </div>
              
              {hasUnsavedChanges && (
                <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-3.5 rounded-lg border border-amber-200 dark:border-amber-800/50 shadow-sm animate-pulse">
                  <Edit3 className="h-4 w-4 flex-shrink-0" />
                  <span>You have unsaved changes. Don't forget to save them!</span>
                </div>
              )}
            </form>
          </CardContent>
        </Card>

        </TabsContent>

        {/* Password Section */}
        <TabsContent value="password" className="mt-0 space-y-4">
          <Card className="border-none shadow-md bg-card transition-all duration-200 hover:shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-2xl flex items-center gap-2 text-primary">
                <KeyRound className="h-6 w-6" />
                Security Settings
              </CardTitle>
              <CardDescription className="text-base">
                Update your account password for better security
              </CardDescription>
            </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-6">
              <div className="space-y-2.5">
                <Label htmlFor="current_password" className="text-sm font-medium text-foreground/90">Current Password</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors duration-200" />
                  <Input
                    id="current_password"
                    name="current_password"
                    type={showPassword.current ? "text" : "password"}
                    value={passwordData.current_password}
                    onChange={handlePasswordChange}
                    placeholder="Enter your current password"
                    className="pl-10 pr-10 bg-white dark:bg-gray-950 border-muted/30 shadow-sm hover:border-primary/50 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all duration-200"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent focus:bg-transparent hover:text-primary focus:text-primary transition-colors"
                    onClick={() => togglePasswordVisibility('current')}
                  >
                    {showPassword.current ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2.5">
                <Label htmlFor="new_password" className="text-sm font-medium text-foreground/90">New Password</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors duration-200" />
                  <Input
                    id="new_password"
                    name="new_password"
                    type={showPassword.new ? "text" : "password"}
                    value={passwordData.new_password}
                    onChange={handlePasswordChange}
                    placeholder="Enter your new password"
                    minLength={6}
                    className="pl-10 pr-10 bg-white dark:bg-gray-950 border-muted/30 shadow-sm hover:border-primary/50 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all duration-200"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent focus:bg-transparent hover:text-primary focus:text-primary transition-colors"
                    onClick={() => togglePasswordVisibility('new')}
                  >
                    {showPassword.new ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {passwordData.new_password && (
                  <div className="space-y-2 mt-2">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-medium">
                          Password Strength: <span className={`${getPasswordStrengthColor(passwordStrength).replace('bg-', 'text-')}`}>{getPasswordStrengthText(passwordStrength)}</span>
                        </span>
                        <span className="text-xs font-medium">
                          {passwordStrength}/5
                        </span>
                      </div>
                      <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-2.5 overflow-hidden shadow-inner">
                        <div
                          className={`h-2.5 rounded-full transition-all ${getPasswordStrengthColor(passwordStrength)}`}
                          style={{ width: `${(passwordStrength / 5) * 100}%` }}
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 mt-3">
                      <div className={`text-xs flex items-center gap-1.5 ${passwordData.new_password.length >= 8 ? 'text-green-500' : 'text-muted-foreground'}`}>
                        {passwordData.new_password.length >= 8 ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                        At least 8 characters
                      </div>
                      <div className={`text-xs flex items-center gap-1.5 ${passwordData.new_password.match(/[a-z]/) ? 'text-green-500' : 'text-muted-foreground'}`}>
                        {passwordData.new_password.match(/[a-z]/) ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                        Lowercase letters
                      </div>
                      <div className={`text-xs flex items-center gap-1.5 ${passwordData.new_password.match(/[A-Z]/) ? 'text-green-500' : 'text-muted-foreground'}`}>
                        {passwordData.new_password.match(/[A-Z]/) ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                        Uppercase letters
                      </div>
                      <div className={`text-xs flex items-center gap-1.5 ${passwordData.new_password.match(/[0-9]/) ? 'text-green-500' : 'text-muted-foreground'}`}>
                        {passwordData.new_password.match(/[0-9]/) ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                        Numbers
                      </div>
                      <div className={`text-xs flex items-center gap-1.5 ${passwordData.new_password.match(/[^a-zA-Z0-9]/) ? 'text-green-500' : 'text-muted-foreground'}`}>
                        {passwordData.new_password.match(/[^a-zA-Z0-9]/) ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                        Special characters
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2.5">
                <Label htmlFor="confirm_password" className="text-sm font-medium text-foreground/90">Confirm New Password</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors duration-200" />
                  <Input
                    id="confirm_password"
                    name="confirm_password"
                    type={showPassword.confirm ? "text" : "password"}
                    value={passwordData.confirm_password}
                    onChange={handlePasswordChange}
                    placeholder="Confirm your new password"
                    minLength={6}
                    className="pl-10 pr-10 bg-white dark:bg-gray-950 border-muted/30 shadow-sm hover:border-primary/50 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all duration-200"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent focus:bg-transparent hover:text-primary focus:text-primary transition-colors"
                    onClick={() => togglePasswordVisibility('confirm')}
                  >
                    {showPassword.confirm ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {passwordData.confirm_password && (
                  <div className="flex items-center gap-2 mt-1.5">
                    {passwordData.new_password !== passwordData.confirm_password ? (
                      <div className="text-sm text-red-500 flex items-center gap-1.5 bg-red-50 dark:bg-red-950/30 px-3 py-1.5 rounded-md border border-red-100 dark:border-red-900/50 w-full">
                        <X className="h-4 w-4 flex-shrink-0" />
                        <span>Passwords don't match</span>
                      </div>
                    ) : (
                      <div className="text-sm text-green-500 flex items-center gap-1.5 bg-green-50 dark:bg-green-950/30 px-3 py-1.5 rounded-md border border-green-100 dark:border-green-900/50 w-full">
                        <Check className="h-4 w-4 flex-shrink-0" />
                        <span>Passwords match</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <Button 
                type="submit" 
                disabled={isChangingPassword || !passwordData.new_password || !passwordData.confirm_password || passwordData.new_password !== passwordData.confirm_password} 
                className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all duration-200 font-medium mt-2"
              >
                {isChangingPassword ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Changing Password...
                  </>
                ) : (
                  <>
                    <KeyRound className="mr-2 h-4 w-4" />
                    Change Password
                  </>
                )}
              </Button>
              
              {/* Security tips */}
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-100 dark:border-blue-900/30">
                <h4 className="text-sm font-medium text-blue-700 dark:text-blue-400 flex items-center gap-2 mb-2">
                  <ShieldAlert className="h-4 w-4" />
                  Security Tips
                </h4>
                <ul className="text-xs text-muted-foreground space-y-1.5">
                  <li className="flex items-start gap-1.5">
                    <Check className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                    Use a unique password you don't use on other websites
                  </li>
                  <li className="flex items-start gap-1.5">
                    <Check className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                    Mix uppercase, lowercase, numbers and symbols
                  </li>
                  <li className="flex items-start gap-1.5">
                    <Check className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                    Consider using a password manager for stronger security
                  </li>
                </ul>
              </div>
            </form>
          </CardContent>
        </Card>

        </TabsContent>

        {/* Danger Zone */}
        <TabsContent value="danger" className="mt-0 space-y-4">
          <Card className="border-destructive/30 bg-gradient-to-br from-destructive/5 to-destructive/10 shadow-md transition-all duration-200 hover:shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-2xl text-destructive flex items-center gap-2">
                <div className="p-1.5 bg-red-100 dark:bg-red-900/30 rounded-full">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                Danger Zone
              </CardTitle>
              <CardDescription className="text-destructive/80 text-base">
                Irreversible and destructive actions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="p-6 bg-destructive/10 rounded-lg border border-destructive/20">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center">
                        <Trash2 className="h-5 w-5 text-destructive" />
                      </div>
                    </div>
                    <div className="flex-1 space-y-4">
                      <div>
                        <h3 className="font-semibold text-destructive text-lg">Delete Account</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Once you delete your account, there is no going back. Please be certain.
                        </p>
                      </div>
                      
                      <div className="space-y-3 p-4 border border-destructive/20 rounded-lg bg-white/50 dark:bg-gray-950/50 shadow-sm">
                        <h4 className="font-medium text-destructive/90 flex items-center gap-2">
                          <Trash2 className="h-4 w-4" />
                          Account Deletion Details
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          All your data will be permanently deleted including your profile, learning progress, and saved content.
                        </p>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="destructive" 
                              className="mt-3 group relative overflow-hidden shadow-md hover:shadow-lg transition-all duration-200"
                            >
                              <span className="absolute inset-0 w-full h-full bg-gradient-to-br from-red-600 to-red-700 dark:from-red-700 dark:to-red-800 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                              <span className="relative flex items-center">
                                <Trash className="mr-2 h-4 w-4" />
                                Delete Account
                              </span>
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="border-destructive/30 shadow-lg">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-destructive flex items-center gap-2 text-xl">
                                <div className="p-1.5 bg-red-100 dark:bg-red-900/30 rounded-full">
                                  <AlertTriangle className="h-5 w-5" />
                                </div>
                                Are you absolutely sure?
                              </AlertDialogTitle>
                              <AlertDialogDescription className="space-y-4 pt-2">
                                <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-md border border-red-100 dark:border-red-900/50 text-sm">
                                  This action <span className="font-semibold">cannot be undone</span>. This will permanently delete your account and remove all your data from our servers.
                                </div>
                                
                                <div className="mt-4 space-y-2">
                                  <Label htmlFor="delete-confirmation" className="text-sm font-medium block">
                                    Type <span className="font-mono font-bold text-destructive">DELETE</span> to confirm:
                                  </Label>
                                  <Input
                                    id="delete-confirmation"
                                    value={deleteConfirmation}
                                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                                    className="border-muted/50 focus:border-destructive focus:ring-1 focus:ring-destructive/30"
                                    placeholder="Type DELETE in all caps"
                                  />
                                </div>
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="gap-2 pt-2">
                              <AlertDialogCancel className="border-muted/30 shadow-sm hover:shadow transition-all duration-200">
                                Cancel
                              </AlertDialogCancel>
                              <Button
                                variant="destructive"
                                onClick={handleDeleteAccount}
                                disabled={deleteConfirmation !== "DELETE" || isDeletingAccount}
                                className={`shadow-md hover:shadow-lg transition-all duration-200 ${isDeletingAccount ? "opacity-70 cursor-not-allowed" : ""} ${deleteConfirmation === "DELETE" ? "animate-pulse" : ""}`}
                              >
                                {isDeletingAccount ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Deleting...
                                  </>
                                ) : (
                                  <>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete Forever
                                  </>
                                )}
                              </Button>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                      
                      {/* Additional warning */}
                      <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-100 dark:border-amber-900/30 flex gap-3">
                        <div className="flex-shrink-0 text-amber-500">
                          <Info className="h-5 w-5" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-sm font-medium text-amber-700 dark:text-amber-400">
                            Before you delete your account
                          </h4>
                          <ul className="text-xs text-muted-foreground space-y-1.5">
                            <li className="flex items-start gap-1.5">
                              <ArrowRight className="h-3 w-3 mt-0.5 flex-shrink-0" />
                              Download any important data or resources you wish to keep
                            </li>
                            <li className="flex items-start gap-1.5">
                              <ArrowRight className="h-3 w-3 mt-0.5 flex-shrink-0" />
                              Consider contacting support if you're experiencing any issues
                            </li>
                            <li className="flex items-start gap-1.5">
                              <ArrowRight className="h-3 w-3 mt-0.5 flex-shrink-0" />
                              Remember that deleting your account will lose all learning progress
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}