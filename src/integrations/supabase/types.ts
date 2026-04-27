export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      applications: {
        Row: {
          applied_at: string | null
          company: string
          cover_letter: string | null
          created_at: string
          id: string
          job_id: string | null
          job_title: string
          job_url: string | null
          keywords: string[] | null
          match_score: number | null
          next_action_at: string | null
          notes: string | null
          status: Database["public"]["Enums"]["application_status"]
          tailored_cv: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          applied_at?: string | null
          company: string
          cover_letter?: string | null
          created_at?: string
          id?: string
          job_id?: string | null
          job_title: string
          job_url?: string | null
          keywords?: string[] | null
          match_score?: number | null
          next_action_at?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          tailored_cv?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          applied_at?: string | null
          company?: string
          cover_letter?: string | null
          created_at?: string
          id?: string
          job_id?: string | null
          job_title?: string
          job_url?: string | null
          keywords?: string[] | null
          match_score?: number | null
          next_action_at?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          tailored_cv?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          candidate_id: string
          created_at: string
          id: string
          recruiter_id: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          id?: string
          recruiter_id: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          id?: string
          recruiter_id?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cv_analyses: {
        Row: {
          created_at: string
          cv_text: string | null
          gaps: Json | null
          id: string
          language: string | null
          market_positioning: string | null
          recommendations: Json | null
          score: number | null
          strengths: Json | null
          summary: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          cv_text?: string | null
          gaps?: Json | null
          id?: string
          language?: string | null
          market_positioning?: string | null
          recommendations?: Json | null
          score?: number | null
          strengths?: Json | null
          summary?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          cv_text?: string | null
          gaps?: Json | null
          id?: string
          language?: string | null
          market_positioning?: string | null
          recommendations?: Json | null
          score?: number | null
          strengths?: Json | null
          summary?: string | null
          user_id?: string
        }
        Relationships: []
      }
      jobs: {
        Row: {
          company: string
          company_logo_url: string | null
          country_code: string | null
          created_at: string
          description: string | null
          employment_type: Database["public"]["Enums"]["employment_type"] | null
          external_id: string | null
          id: string
          is_active: boolean | null
          location: string | null
          market: Database["public"]["Enums"]["market_type"] | null
          posted_at: string | null
          posted_by: string | null
          required_skills: string[] | null
          salary_currency: string | null
          salary_max: number | null
          salary_min: number | null
          source_name: string | null
          source_url: string | null
          title: string
          updated_at: string
          work_type: Database["public"]["Enums"]["work_type"] | null
        }
        Insert: {
          company: string
          company_logo_url?: string | null
          country_code?: string | null
          created_at?: string
          description?: string | null
          employment_type?:
            | Database["public"]["Enums"]["employment_type"]
            | null
          external_id?: string | null
          id?: string
          is_active?: boolean | null
          location?: string | null
          market?: Database["public"]["Enums"]["market_type"] | null
          posted_at?: string | null
          posted_by?: string | null
          required_skills?: string[] | null
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          source_name?: string | null
          source_url?: string | null
          title: string
          updated_at?: string
          work_type?: Database["public"]["Enums"]["work_type"] | null
        }
        Update: {
          company?: string
          company_logo_url?: string | null
          country_code?: string | null
          created_at?: string
          description?: string | null
          employment_type?:
            | Database["public"]["Enums"]["employment_type"]
            | null
          external_id?: string | null
          id?: string
          is_active?: boolean | null
          location?: string | null
          market?: Database["public"]["Enums"]["market_type"] | null
          posted_at?: string | null
          posted_by?: string | null
          required_skills?: string[] | null
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          source_name?: string | null
          source_url?: string | null
          title?: string
          updated_at?: string
          work_type?: Database["public"]["Enums"]["work_type"] | null
        }
        Relationships: []
      }
      learning_paths: {
        Row: {
          created_at: string
          gaps: Json | null
          id: string
          language: string | null
          recommendations: Json | null
          target_role: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          gaps?: Json | null
          id?: string
          language?: string | null
          recommendations?: Json | null
          target_role?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          gaps?: Json | null
          id?: string
          language?: string | null
          recommendations?: Json | null
          target_role?: string | null
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          country_code: string | null
          created_at: string
          cv_raw_text: string | null
          cv_structured: Json | null
          cv_url: string | null
          email_contact: string | null
          employability_score: number | null
          experience_years: number | null
          full_name: string | null
          headline: string | null
          id: string
          languages: string[] | null
          links: Json | null
          location: string | null
          market_preference: Database["public"]["Enums"]["market_type"] | null
          phone: string | null
          preferred_country: string | null
          preferred_language: string | null
          preferred_template: string | null
          recruiter_visible: boolean | null
          skills: string[] | null
          target_role: string | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          country_code?: string | null
          created_at?: string
          cv_raw_text?: string | null
          cv_structured?: Json | null
          cv_url?: string | null
          email_contact?: string | null
          employability_score?: number | null
          experience_years?: number | null
          full_name?: string | null
          headline?: string | null
          id?: string
          languages?: string[] | null
          links?: Json | null
          location?: string | null
          market_preference?: Database["public"]["Enums"]["market_type"] | null
          phone?: string | null
          preferred_country?: string | null
          preferred_language?: string | null
          preferred_template?: string | null
          recruiter_visible?: boolean | null
          skills?: string[] | null
          target_role?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          country_code?: string | null
          created_at?: string
          cv_raw_text?: string | null
          cv_structured?: Json | null
          cv_url?: string | null
          email_contact?: string | null
          employability_score?: number | null
          experience_years?: number | null
          full_name?: string | null
          headline?: string | null
          id?: string
          languages?: string[] | null
          links?: Json | null
          location?: string | null
          market_preference?: Database["public"]["Enums"]["market_type"] | null
          phone?: string | null
          preferred_country?: string | null
          preferred_language?: string | null
          preferred_template?: string | null
          recruiter_visible?: boolean | null
          skills?: string[] | null
          target_role?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "candidate" | "recruiter" | "admin"
      application_status:
        | "saved"
        | "applied"
        | "interview"
        | "offer"
        | "rejected"
      employment_type:
        | "full_time"
        | "part_time"
        | "contract"
        | "internship"
        | "freelance"
      market_type: "tunisia" | "international" | "both"
      work_type: "remote" | "hybrid" | "onsite"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["candidate", "recruiter", "admin"],
      application_status: [
        "saved",
        "applied",
        "interview",
        "offer",
        "rejected",
      ],
      employment_type: [
        "full_time",
        "part_time",
        "contract",
        "internship",
        "freelance",
      ],
      market_type: ["tunisia", "international", "both"],
      work_type: ["remote", "hybrid", "onsite"],
    },
  },
} as const
