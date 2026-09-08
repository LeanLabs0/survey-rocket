/// <reference types="astro/client" />

interface Window {
  __SR_LOGIN?: {
    waitParam: number;
    supabasePublicUrl: string;
    supabaseKey: string;
    next: string;
    emailPrefill: string;
  };
  __SR_PASSKEY?: {
    supabasePublicUrl: string;
    supabaseKey: string;
  };
}

declare namespace App {
  interface Locals {
    user: { id: string; email: string | null } | null;
    profile: {
      id: string;
      email: string;
      fullName: string | null;
      avatarUrl: string | null;
      theme: string;
      locale: string;
      notifyReviews: boolean;
      isSuperadmin: boolean;
    } | null;
    isSuperadmin: boolean;
  }
}
