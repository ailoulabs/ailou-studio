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
          created_at: string
          cut_length_cm: number
          description: string
          director_rules: string
          fabric_width_cm: number
          family: string
          id: string
          name: string
          params: Json
          slug: string
          sort_order: number
          suggested_role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          cut_length_cm?: number
          description?: string
          director_rules?: string
          fabric_width_cm?: number
          family: string
          id: string
          name: string
          params?: Json
          slug: string
          sort_order?: number
          suggested_role: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          cut_length_cm?: number
          description?: string
          director_rules?: string
          fabric_width_cm?: number
          family?: string
          id?: string
          name?: string
          params?: Json
          slug?: string
          sort_order?: number
          suggested_role?: string
          updated_at?: string
        }
        Relationships: []
      }
      collections: {
        Row: {
          brief: Json
          created_at: string
          direction: Json | null
          id: string
          motif_sheet_filtered_path: string | null
          motif_sheet_path: string | null
          motifs: Json
          name: string
          palette: string[]
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          brief?: Json
          created_at?: string
          direction?: Json | null
          id?: string
          motif_sheet_filtered_path?: string | null
          motif_sheet_path?: string | null
          motifs?: Json
          name?: string
          palette?: string[]
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          brief?: Json
          created_at?: string
          direction?: Json | null
          id?: string
          motif_sheet_filtered_path?: string | null
          motif_sheet_path?: string | null
          motifs?: Json
          name?: string
          palette?: string[]
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      credits_ledger: {
        Row: {
          created_at: string
          delta: number
          id: string
          reason: string
          ref_collection_id: string | null
          ref_piece_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          reason: string
          ref_collection_id?: string | null
          ref_piece_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          reason?: string
          ref_collection_id?: string | null
          ref_piece_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credits_ledger_ref_collection_id_fkey"
            columns: ["ref_collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credits_ledger_ref_piece_id_fkey"
            columns: ["ref_piece_id"]
            isOneToOne: false
            referencedRelation: "pieces"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_jobs: {
        Row: {
          base_url: string | null
          cancel_requested: boolean
          collection_id: string
          created_at: string
          error: string | null
          finished_at: string | null
          heartbeat_at: string | null
          id: string
          plan: Json
          started_at: string | null
          status: string
          step: string
          updated_at: string
          user_id: string
        }
        Insert: {
          base_url?: string | null
          cancel_requested?: boolean
          collection_id: string
          created_at?: string
          error?: string | null
          finished_at?: string | null
          heartbeat_at?: string | null
          id?: string
          plan?: Json
          started_at?: string | null
          status?: string
          step?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          base_url?: string | null
          cancel_requested?: boolean
          collection_id?: string
          created_at?: string
          error?: string | null
          finished_at?: string | null
          heartbeat_at?: string | null
          id?: string
          plan?: Json
          started_at?: string | null
          status?: string
          step?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generation_jobs_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_units: {
        Row: {
          attempt: number
          collection_id: string
          created_at: string
          dedupe_key: string | null
          error: string | null
          finished_at: string | null
          id: string
          job_id: string
          kind: string
          lease_token: string | null
          lease_until: string | null
          options: Json
          piece_id: string | null
          result: Json | null
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempt?: number
          collection_id: string
          created_at?: string
          dedupe_key?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          job_id: string
          kind: string
          lease_token?: string | null
          lease_until?: string | null
          options?: Json
          piece_id?: string | null
          result?: Json | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempt?: number
          collection_id?: string
          created_at?: string
          dedupe_key?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          job_id?: string
          kind?: string
          lease_token?: string | null
          lease_until?: string | null
          options?: Json
          piece_id?: string | null
          result?: Json | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "generation_units_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generation_units_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "generation_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generation_units_piece_id_fkey"
            columns: ["piece_id"]
            isOneToOne: false
            referencedRelation: "pieces"
            referencedColumns: ["id"]
          },
        ]
      }
      kits: {
        Row: {
          application_ids: string[]
          created_at: string
          name: string
          sort_order: number
          updated_at: string
          usage: string
        }
        Insert: {
          application_ids?: string[]
          created_at?: string
          name: string
          sort_order?: number
          updated_at?: string
          usage: string
        }
        Update: {
          application_ids?: string[]
          created_at?: string
          name?: string
          sort_order?: number
          updated_at?: string
          usage?: string
        }
        Relationships: []
      }
      piece_versions: {
        Row: {
          collection_id: string
          created_at: string
          id: string
          image_path: string
          kind: string
          label: string
          piece_id: string
          seam: Json | null
          updated_at: string
        }
        Insert: {
          collection_id: string
          created_at?: string
          id?: string
          image_path: string
          kind?: string
          label?: string
          piece_id: string
          seam?: Json | null
          updated_at?: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          id?: string
          image_path?: string
          kind?: string
          label?: string
          piece_id?: string
          seam?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "piece_versions_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "piece_versions_piece_id_fkey"
            columns: ["piece_id"]
            isOneToOne: false
            referencedRelation: "pieces"
            referencedColumns: ["id"]
          },
        ]
      }
      pieces: {
        Row: {
          application_id: string
          collection_id: string
          composition: Json | null
          created_at: string
          cut_image_path: string | null
          error: string | null
          free_retry_used: boolean
          id: string
          image_path: string | null
          image_print_path: string | null
          made_by: string
          overrides: Json
          position: number
          print_dpi: number | null
          prompt: string | null
          role: string
          seam: Json | null
          seam_fix_free_used: boolean
          status: string
          timings: Json | null
          updated_at: string
        }
        Insert: {
          application_id: string
          collection_id: string
          composition?: Json | null
          created_at?: string
          cut_image_path?: string | null
          error?: string | null
          free_retry_used?: boolean
          id?: string
          image_path?: string | null
          image_print_path?: string | null
          made_by?: string
          overrides?: Json
          position?: number
          print_dpi?: number | null
          prompt?: string | null
          role?: string
          seam?: Json | null
          seam_fix_free_used?: boolean
          status?: string
          timings?: Json | null
          updated_at?: string
        }
        Update: {
          application_id?: string
          collection_id?: string
          composition?: Json | null
          created_at?: string
          cut_image_path?: string | null
          error?: string | null
          free_retry_used?: boolean
          id?: string
          image_path?: string | null
          image_print_path?: string | null
          made_by?: string
          overrides?: Json
          position?: number
          print_dpi?: number | null
          prompt?: string | null
          role?: string
          seam?: Json | null
          seam_fix_free_used?: boolean
          status?: string
          timings?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pieces_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pieces_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
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
          role: Database["public"]["Enums"]["app_role"]
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
      arm_generation_sweeper: { Args: never; Returns: undefined }
      cancel_generation_job: { Args: { _job_id: string }; Returns: boolean }
      claim_generation_units: {
        Args: {
          _job_id: string
          _kind?: string
          _lease_seconds: number
          _limit: number
          _max_attempts?: number
          _token: string
        }
        Returns: {
          attempt: number
          collection_id: string
          created_at: string
          dedupe_key: string | null
          error: string | null
          finished_at: string | null
          id: string
          job_id: string
          kind: string
          lease_token: string | null
          lease_until: string | null
          options: Json
          piece_id: string | null
          result: Json | null
          started_at: string | null
          status: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "generation_units"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      finish_generation_unit: {
        Args: {
          _error: string
          _id: string
          _result: Json
          _status: string
          _token: string
        }
        Returns: boolean
      }
      get_credit_balance: { Args: never; Returns: number }
      get_generation_worker_secret: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      kick_generation_worker: { Args: { _job_id: string }; Returns: undefined }
      sync_generation_worker_config: {
        Args: { _base_url: string; _secret: string }
        Returns: undefined
      }
      touch_generation_unit: {
        Args: { _id: string; _lease_seconds: number; _token: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "user"],
    },
  },
} as const
