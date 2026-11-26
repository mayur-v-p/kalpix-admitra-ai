export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      ai_scene_types: {
        Row: {
          active: boolean;
          created_at: string;
          credit_cost: number;
          default_mode: string;
          description: string;
          id: string;
          industries: string[];
          name: string;
          preview_style: string;
          prompt_template: string;
          prompt_version: number;
          sort: number;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          created_at?: string;
          credit_cost?: number;
          default_mode?: string;
          description: string;
          id: string;
          industries: string[];
          name: string;
          preview_style: string;
          prompt_template: string;
          prompt_version?: number;
          sort?: number;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          credit_cost?: number;
          default_mode?: string;
          description?: string;
          id?: string;
          industries?: string[];
          name?: string;
          preview_style?: string;
          prompt_template?: string;
          prompt_version?: number;
          sort?: number;
        };
        Relationships: [];
      };
      ai_video_clips: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          aspect_ratio: string;
          cache_key: string;
          cost: number;
          created_at: string;
          created_by: string | null;
          duration_seconds: number | null;
          error: string | null;
          file_path: string | null;
          free_regeneration: boolean;
          id: string;
          mode: string;
          model: string;
          poster_path: string | null;
          product_id: string | null;
          prompt_version: number;
          provider: string;
          provider_job_id: string | null;
          rejected_at: string | null;
          scene_type_id: string;
          source_image_path: string;
          status: string;
          updated_at: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          aspect_ratio?: string;
          cache_key: string;
          cost?: number;
          created_at?: string;
          created_by?: string | null;
          duration_seconds?: number | null;
          error?: string | null;
          file_path?: string | null;
          free_regeneration?: boolean;
          id?: string;
          mode?: string;
          model: string;
          poster_path?: string | null;
          product_id?: string | null;
          prompt_version: number;
          provider: string;
          provider_job_id?: string | null;
          rejected_at?: string | null;
          scene_type_id: string;
          source_image_path: string;
          status?: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          aspect_ratio?: string;
          cache_key?: string;
          cost?: number;
          created_at?: string;
          created_by?: string | null;
          duration_seconds?: number | null;
          error?: string | null;
          file_path?: string | null;
          free_regeneration?: boolean;
          id?: string;
          mode?: string;
          model?: string;
          poster_path?: string | null;
          product_id?: string | null;
          prompt_version?: number;
          provider?: string;
          provider_job_id?: string | null;
          rejected_at?: string | null;
          scene_type_id?: string;
          source_image_path?: string;
          status?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'ai_video_clips_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ai_video_clips_scene_type_id_fkey';
            columns: ['scene_type_id'];
            isOneToOne: false;
            referencedRelation: 'ai_scene_types';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ai_video_clips_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      audit_events: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          entity: string;
          entity_id: string | null;
          id: number;
          workspace_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          entity: string;
          entity_id?: string | null;
          id?: never;
          workspace_id?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          entity?: string;
          entity_id?: string | null;
          id?: never;
          workspace_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'audit_events_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      brand_kits: {
        Row: {
          accent_color: string;
          business_id: string;
          created_at: string;
          font_body: string;
          font_heading: string;
          id: string;
          logo_path: string | null;
          primary_color: string;
          secondary_color: string;
          tone: string;
          updated_at: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          accent_color?: string;
          business_id: string;
          created_at?: string;
          font_body?: string;
          font_heading?: string;
          id?: string;
          logo_path?: string | null;
          primary_color?: string;
          secondary_color?: string;
          tone?: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          accent_color?: string;
          business_id?: string;
          created_at?: string;
          font_body?: string;
          font_heading?: string;
          id?: string;
          logo_path?: string | null;
          primary_color?: string;
          secondary_color?: string;
          tone?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'brand_kits_business_id_workspace_id_fkey';
            columns: ['business_id', 'workspace_id'];
            isOneToOne: false;
            referencedRelation: 'business_profiles';
            referencedColumns: ['id', 'workspace_id'];
          },
          {
            foreignKeyName: 'brand_kits_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: true;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      business_locations: {
        Row: {
          address: string;
          business_id: string;
          city: string;
          confirmed_at: string | null;
          confirmed_by: string | null;
          created_at: string;
          id: string;
          label: string | null;
          map_url: string | null;
          updated_at: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          address: string;
          business_id: string;
          city: string;
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          created_at?: string;
          id?: string;
          label?: string | null;
          map_url?: string | null;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          address?: string;
          business_id?: string;
          city?: string;
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          created_at?: string;
          id?: string;
          label?: string | null;
          map_url?: string | null;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'business_locations_business_id_workspace_id_fkey';
            columns: ['business_id', 'workspace_id'];
            isOneToOne: false;
            referencedRelation: 'business_profiles';
            referencedColumns: ['id', 'workspace_id'];
          },
          {
            foreignKeyName: 'business_locations_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      business_profiles: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          industry: string;
          languages: string[];
          name: string;
          phone: string | null;
          phone_confirmed_at: string | null;
          phone_confirmed_by: string | null;
          updated_at: string;
          website: string | null;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          industry: string;
          languages?: string[];
          name: string;
          phone?: string | null;
          phone_confirmed_at?: string | null;
          phone_confirmed_by?: string | null;
          updated_at?: string;
          website?: string | null;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          industry?: string;
          languages?: string[];
          name?: string;
          phone?: string | null;
          phone_confirmed_at?: string | null;
          phone_confirmed_by?: string | null;
          updated_at?: string;
          website?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'business_profiles_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: true;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      campaigns: {
        Row: {
          business_id: string;
          caption: string | null;
          created_at: string;
          cta: string;
          end_date: string | null;
          facts_confirmed_at: string | null;
          facts_confirmed_by: string | null;
          goal: string;
          hashtags: string[];
          headline: string | null;
          id: string;
          language: string;
          name: string;
          offer_text: string | null;
          outline_style: string;
          product_id: string | null;
          scene_clip_id: string | null;
          start_date: string | null;
          status: string;
          style_id: string;
          updated_at: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          business_id: string;
          caption?: string | null;
          created_at?: string;
          cta?: string;
          end_date?: string | null;
          facts_confirmed_at?: string | null;
          facts_confirmed_by?: string | null;
          goal?: string;
          hashtags?: string[];
          headline?: string | null;
          id?: string;
          language?: string;
          name: string;
          offer_text?: string | null;
          outline_style?: string;
          product_id?: string | null;
          scene_clip_id?: string | null;
          start_date?: string | null;
          status?: string;
          style_id?: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          business_id?: string;
          caption?: string | null;
          created_at?: string;
          cta?: string;
          end_date?: string | null;
          facts_confirmed_at?: string | null;
          facts_confirmed_by?: string | null;
          goal?: string;
          hashtags?: string[];
          headline?: string | null;
          id?: string;
          language?: string;
          name?: string;
          offer_text?: string | null;
          outline_style?: string;
          product_id?: string | null;
          scene_clip_id?: string | null;
          start_date?: string | null;
          status?: string;
          style_id?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'campaigns_business_id_workspace_id_fkey';
            columns: ['business_id', 'workspace_id'];
            isOneToOne: false;
            referencedRelation: 'business_profiles';
            referencedColumns: ['id', 'workspace_id'];
          },
          {
            foreignKeyName: 'campaigns_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'campaigns_scene_clip_id_fkey';
            columns: ['scene_clip_id'];
            isOneToOne: false;
            referencedRelation: 'ai_video_clips';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'campaigns_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      creative_assets: {
        Row: {
          bytes: number | null;
          campaign_id: string | null;
          created_at: string;
          duration_seconds: number | null;
          format: string;
          height: number;
          id: string;
          job_id: string;
          kind: string;
          path: string;
          width: number;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          bytes?: number | null;
          campaign_id?: string | null;
          created_at?: string;
          duration_seconds?: number | null;
          format: string;
          height: number;
          id?: string;
          job_id: string;
          kind: string;
          path: string;
          width: number;
          workspace_id: string;
        };
        Update: {
          bytes?: number | null;
          campaign_id?: string | null;
          created_at?: string;
          duration_seconds?: number | null;
          format?: string;
          height?: number;
          id?: string;
          job_id?: string;
          kind?: string;
          path?: string;
          width?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'creative_assets_campaign_id_fkey';
            columns: ['campaign_id'];
            isOneToOne: false;
            referencedRelation: 'campaigns';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'creative_assets_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: false;
            referencedRelation: 'generation_jobs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'creative_assets_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      credit_balances: {
        Row: {
          available: number;
          reserved: number;
          updated_at: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          available?: number;
          reserved?: number;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          available?: number;
          reserved?: number;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'credit_balances_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: true;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      credit_ledger: {
        Row: {
          amount: number;
          created_at: string;
          id: number;
          job_id: string | null;
          kind: string;
          note: string | null;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          created_at?: string;
          id?: never;
          job_id?: string | null;
          kind: string;
          note?: string | null;
          workspace_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          id?: never;
          job_id?: string | null;
          kind?: string;
          note?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'credit_ledger_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      generation_jobs: {
        Row: {
          attempts: number;
          campaign_id: string | null;
          cost: number;
          created_at: string;
          created_by: string | null;
          error: string | null;
          finished_at: string | null;
          formats: string[];
          id: string;
          lease_until: string | null;
          max_attempts: number;
          params: NonNullable<Json>;
          progress: number;
          started_at: string | null;
          status: string;
          template_id: string;
          template_version: string | null;
          type: string;
          updated_at: string;
          worker_id: string | null;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          attempts?: number;
          campaign_id?: string | null;
          cost?: number;
          created_at?: string;
          created_by?: string | null;
          error?: string | null;
          finished_at?: string | null;
          formats: string[];
          id?: string;
          lease_until?: string | null;
          max_attempts?: number;
          params: NonNullable<Json>;
          progress?: number;
          started_at?: string | null;
          status?: string;
          template_id: string;
          template_version?: string | null;
          type: string;
          updated_at?: string;
          worker_id?: string | null;
          workspace_id: string;
        };
        Update: {
          attempts?: number;
          campaign_id?: string | null;
          cost?: number;
          created_at?: string;
          created_by?: string | null;
          error?: string | null;
          finished_at?: string | null;
          formats?: string[];
          id?: string;
          lease_until?: string | null;
          max_attempts?: number;
          params?: NonNullable<Json>;
          progress?: number;
          started_at?: string | null;
          status?: string;
          template_id?: string;
          template_version?: string | null;
          type?: string;
          updated_at?: string;
          worker_id?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'generation_jobs_campaign_id_fkey';
            columns: ['campaign_id'];
            isOneToOne: false;
            referencedRelation: 'campaigns';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'generation_jobs_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      platform_admins: {
        Row: {
          created_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      products: {
        Row: {
          archived_at: string | null;
          business_id: string;
          created_at: string;
          currency: string;
          cutout_error: string | null;
          cutout_path: string | null;
          cutout_provider: string | null;
          cutout_status: string;
          description: string | null;
          enhanced_path: string | null;
          enhanced_provider: string | null;
          enhanced_status: string;
          id: string;
          image_path: string | null;
          name: string;
          outline_status: string;
          outline_svg: string | null;
          price: number | null;
          price_confirmed_at: string | null;
          price_confirmed_by: string | null;
          updated_at: string;
          use_enhanced: boolean;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          business_id: string;
          created_at?: string;
          currency?: string;
          cutout_error?: string | null;
          cutout_path?: string | null;
          cutout_provider?: string | null;
          cutout_status?: string;
          description?: string | null;
          enhanced_path?: string | null;
          enhanced_provider?: string | null;
          enhanced_status?: string;
          id?: string;
          image_path?: string | null;
          name: string;
          outline_status?: string;
          outline_svg?: string | null;
          price?: number | null;
          price_confirmed_at?: string | null;
          price_confirmed_by?: string | null;
          updated_at?: string;
          use_enhanced?: boolean;
          workspace_id: string;
        };
        Update: {
          archived_at?: string | null;
          business_id?: string;
          created_at?: string;
          currency?: string;
          cutout_error?: string | null;
          cutout_path?: string | null;
          cutout_provider?: string | null;
          cutout_status?: string;
          description?: string | null;
          enhanced_path?: string | null;
          enhanced_provider?: string | null;
          enhanced_status?: string;
          id?: string;
          image_path?: string | null;
          name?: string;
          outline_status?: string;
          outline_svg?: string | null;
          price?: number | null;
          price_confirmed_at?: string | null;
          price_confirmed_by?: string | null;
          updated_at?: string;
          use_enhanced?: boolean;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'products_business_id_workspace_id_fkey';
            columns: ['business_id', 'workspace_id'];
            isOneToOne: false;
            referencedRelation: 'business_profiles';
            referencedColumns: ['id', 'workspace_id'];
          },
          {
            foreignKeyName: 'products_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          full_name: string | null;
          id: string;
          language: string;
          phone: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          full_name?: string | null;
          id: string;
          language?: string;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          full_name?: string | null;
          id?: string;
          language?: string;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      qr_links: {
        Row: {
          campaign_id: string;
          code: string;
          created_at: string;
          id: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          campaign_id: string;
          code: string;
          created_at?: string;
          id?: string;
          workspace_id: string;
        };
        Update: {
          campaign_id?: string;
          code?: string;
          created_at?: string;
          id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'qr_links_campaign_id_fkey';
            columns: ['campaign_id'];
            isOneToOne: true;
            referencedRelation: 'campaigns';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'qr_links_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      qr_scans: {
        Row: {
          id: number;
          qr_link_id: string;
          scanned_at: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          id?: never;
          qr_link_id: string;
          scanned_at?: string;
          workspace_id: string;
        };
        Update: {
          id?: never;
          qr_link_id?: string;
          scanned_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'qr_scans_qr_link_id_fkey';
            columns: ['qr_link_id'];
            isOneToOne: false;
            referencedRelation: 'qr_links';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'qr_scans_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      rate_limits: {
        Row: {
          count: number;
          key: string;
          window_start: string;
        };
        ComputedFields: never;
        Insert: {
          count?: number;
          key: string;
          window_start: string;
        };
        Update: {
          count?: number;
          key?: string;
          window_start?: string;
        };
        Relationships: [];
      };
      webhook_events: {
        Row: {
          event_id: string;
          id: number;
          processed_at: string | null;
          received_at: string;
          source: string;
        };
        ComputedFields: never;
        Insert: {
          event_id: string;
          id?: never;
          processed_at?: string | null;
          received_at?: string;
          source: string;
        };
        Update: {
          event_id?: string;
          id?: never;
          processed_at?: string | null;
          received_at?: string;
          source?: string;
        };
        Relationships: [];
      };
      workspace_members: {
        Row: {
          created_at: string;
          role: Database['public']['Enums']['member_role'];
          user_id: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          role?: Database['public']['Enums']['member_role'];
          user_id: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          role?: Database['public']['Enums']['member_role'];
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workspace_members_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      workspaces: {
        Row: {
          created_at: string;
          id: string;
          is_trial: boolean;
          name: string;
          owner_id: string;
          type: Database['public']['Enums']['workspace_type'];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          is_trial?: boolean;
          name: string;
          owner_id: string;
          type?: Database['public']['Enums']['workspace_type'];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_trial?: boolean;
          name?: string;
          owner_id?: string;
          type?: Database['public']['Enums']['workspace_type'];
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      ai_clip_ready: {
        Args: { p_clip: string; p_duration: number; p_file_path: string; p_poster_path: string };
        Returns: boolean;
      };
      choose_product_image: {
        Args: { p_product_id: string; p_use_enhanced: boolean };
        Returns: boolean;
      };
      claim_render_job: {
        Args: { p_lease_seconds?: number; p_worker: string };
        Returns: {
          attempts: number;
          campaign_id: string | null;
          cost: number;
          created_at: string;
          created_by: string | null;
          error: string | null;
          finished_at: string | null;
          formats: string[];
          id: string;
          lease_until: string | null;
          max_attempts: number;
          params: NonNullable<Json>;
          progress: number;
          started_at: string | null;
          status: string;
          template_id: string;
          template_version: string | null;
          type: string;
          updated_at: string;
          worker_id: string | null;
          workspace_id: string;
        }[];
        SetofOptions: {
          from: '*';
          to: 'generation_jobs';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      complete_render_job: {
        Args: { p_job: string; p_template_version: string; p_worker: string };
        Returns: boolean;
      };
      confirm_business_phone: { Args: { p_business_id: string }; Returns: string };
      confirm_campaign_facts: { Args: { p_campaign_id: string }; Returns: string };
      confirm_location: { Args: { p_location_id: string }; Returns: string };
      confirm_product_price: { Args: { p_product_id: string }; Returns: string };
      consume_rate_limit: {
        Args: { p_key: string; p_max: number; p_window_seconds: number };
        Returns: boolean;
      };
      create_render_job: { Args: { p_campaign_id: string; p_formats: string[] }; Returns: string };
      fail_ai_clip: { Args: { p_clip: string; p_error: string }; Returns: boolean };
      fail_render_job: {
        Args: { p_error: string; p_job: string; p_retry: boolean; p_worker: string };
        Returns: string;
      };
      heartbeat_render_job: {
        Args: { p_job: string; p_lease_seconds?: number; p_progress: number; p_worker: string };
        Returns: boolean;
      };
      mark_ai_clip_submitted: {
        Args: { p_clip: string; p_provider_job_id: string };
        Returns: boolean;
      };
      reserve_ai_clip: {
        Args: {
          p_mode: string;
          p_model: string;
          p_product_id: string;
          p_provider: string;
          p_scene_type_id: string;
          p_user: string;
        };
        Returns: {
          cached: boolean;
          clip_id: string;
          clip_status: string;
          product_name: string;
          prompt_template: string;
        }[];
      };
      review_ai_clip: { Args: { p_approve: boolean; p_clip: string }; Returns: string };
    };
    Enums: {
      member_role: 'owner' | 'member';
      workspace_type: 'business' | 'agency' | 'franchise';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      member_role: ['owner', 'member'],
      workspace_type: ['business', 'agency', 'franchise'],
    },
  },
} as const;
