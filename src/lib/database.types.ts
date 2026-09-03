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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      cook_logs: {
        Row: {
          cooked_at: string
          id: string
          notes: string | null
          rating: number | null
          recipe_id: string
          servings_made: number | null
          user_id: string
        }
        Insert: {
          cooked_at?: string
          id?: string
          notes?: string | null
          rating?: number | null
          recipe_id: string
          servings_made?: number | null
          user_id: string
        }
        Update: {
          cooked_at?: string
          id?: string
          notes?: string | null
          rating?: number | null
          recipe_id?: string
          servings_made?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cook_logs_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cook_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plan_entries: {
        Row: {
          created_at: string
          id: string
          planned_on: string
          position: number
          recipe_id: string
          slot: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          planned_on: string
          position?: number
          recipe_id: string
          slot?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          planned_on?: string
          position?: number
          recipe_id?: string
          slot?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plan_entries_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plan_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
        }
        Relationships: []
      }
      recipe_ingredients: {
        Row: {
          id: string
          name: string
          notes: string | null
          position: number
          quantity: number | null
          recipe_id: string
          unit: string | null
        }
        Insert: {
          id?: string
          name: string
          notes?: string | null
          position: number
          quantity?: number | null
          recipe_id: string
          unit?: string | null
        }
        Update: {
          id?: string
          name?: string
          notes?: string | null
          position?: number
          quantity?: number | null
          recipe_id?: string
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_riffs: {
        Row: {
          cook_log_id: string
          created_at: string
          created_by: string
          id: string
          label: string
          recipe_id: string
          what_changed: string | null
        }
        Insert: {
          cook_log_id: string
          created_at?: string
          created_by: string
          id?: string
          label: string
          recipe_id: string
          what_changed?: string | null
        }
        Update: {
          cook_log_id?: string
          created_at?: string
          created_by?: string
          id?: string
          label?: string
          recipe_id?: string
          what_changed?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recipe_riffs_cook_log_id_fkey"
            columns: ["cook_log_id"]
            isOneToOne: false
            referencedRelation: "cook_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_riffs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_riffs_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_steps: {
        Row: {
          id: string
          instruction: string
          note: string | null
          position: number
          recipe_id: string
        }
        Insert: {
          id?: string
          instruction: string
          note?: string | null
          position: number
          recipe_id: string
        }
        Update: {
          id?: string
          instruction?: string
          note?: string | null
          position?: number
          recipe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_steps_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_tags: {
        Row: {
          recipe_id: string
          tag_id: string
        }
        Insert: {
          recipe_id: string
          tag_id: string
        }
        Update: {
          recipe_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_tags_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_versions: {
        Row: {
          created_at: string
          id: string
          is_original: boolean
          label: string
          recipe_id: string
          snapshot: Json
        }
        Insert: {
          created_at?: string
          id?: string
          is_original?: boolean
          label?: string
          recipe_id: string
          snapshot: Json
        }
        Update: {
          created_at?: string
          id?: string
          is_original?: boolean
          label?: string
          recipe_id?: string
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "recipe_versions_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          cook_minutes: number | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          owner_id: string
          prep_minutes: number | null
          servings: number | null
          source_name: string | null
          source_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          cook_minutes?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          owner_id: string
          prep_minutes?: number | null
          servings?: number | null
          source_name?: string | null
          source_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          cook_minutes?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          owner_id?: string
          prep_minutes?: number | null
          servings?: number | null
          source_name?: string | null
          source_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipes_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      build_shopping_list: { Args: { recipe_ids: string[] }; Returns: Json }
      convert_measurement: {
        Args: { quantity: number; target: string; unit: string }
        Returns: Json
      }
      convert_measurements: {
        Args: { items: Json; target: string }
        Returns: Json
      }
      create_recipe: {
        Args: { payload: Json }
        Returns: {
          cook_minutes: number | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          owner_id: string
          prep_minutes: number | null
          servings: number | null
          source_name: string | null
          source_url: string | null
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "recipes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_riff: {
        Args: { cook_log_id: string; label: string; what_changed?: string }
        Returns: {
          cook_log_id: string
          created_at: string
          created_by: string
          id: string
          label: string
          recipe_id: string
          what_changed: string | null
        }
        SetofOptions: {
          from: "*"
          to: "recipe_riffs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      log_cook: {
        Args: {
          notes?: string
          rating?: number
          recipe_id: string
          servings_made?: number
        }
        Returns: {
          cooked_at: string
          id: string
          notes: string | null
          rating: number | null
          recipe_id: string
          servings_made: number | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "cook_logs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      plan_meal: {
        Args: { planned_on: string; recipe_id: string; slot?: string }
        Returns: {
          created_at: string
          id: string
          planned_on: string
          position: number
          recipe_id: string
          slot: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "meal_plan_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      predicted_servings: { Args: { recipe_id: string }; Returns: Json }
      suggest_meals: {
        Args: { exclude_weeks?: number; limit_count?: number }
        Returns: {
          cook_minutes: number | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          owner_id: string
          prep_minutes: number | null
          servings: number | null
          source_name: string | null
          source_url: string | null
          title: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "recipes"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      update_recipe: {
        Args: { payload: Json }
        Returns: {
          cook_minutes: number | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          owner_id: string
          prep_minutes: number | null
          servings: number | null
          source_name: string | null
          source_url: string | null
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "recipes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
