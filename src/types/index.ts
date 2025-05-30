// src/types/index.ts
// Common type definitions used across the application

export interface Conversation {
  id: string;
  title: string;
  // Add any other properties your conversations might have
}

export interface UserProfile {
  id: string;
  avatar_url?: string | null;
  full_name?: string | null;
  email?: string;
  // Add any other user profile properties
}
