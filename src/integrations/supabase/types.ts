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
      account_audit: {
        Row: {
          action: string
          created_at: string
          detail: string | null
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          detail?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          detail?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      account_deletion_requests: {
        Row: {
          created_at: string
          email: string | null
          handled_at: string | null
          handled_by: string | null
          id: string
          reason: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          reason?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          reason?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_password_reset_audit: {
        Row: {
          admin_id: string
          created_at: string
          executive_id: string
          executive_user_id: string | null
          id: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          executive_id: string
          executive_user_id?: string | null
          id?: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          executive_id?: string
          executive_user_id?: string | null
          id?: string
        }
        Relationships: []
      }
      admin_role_audit: {
        Row: {
          action: string
          actor_email: string | null
          actor_user_id: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          target_email: string | null
          target_user_id: string
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_user_id?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          target_email?: string | null
          target_user_id: string
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_user_id?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          target_email?: string | null
          target_user_id?: string
        }
        Relationships: []
      }
      agreement_signatures: {
        Row: {
          agreement_status_at_signing: string
          agreement_text_sha256: string
          agreement_version_id: string
          company_id: string | null
          created_at: string
          id: string
          ip_address: string | null
          pdf_path: string | null
          signature_image_path: string
          signed_at: string
          signed_name: string
          signed_title: string | null
          signer_type: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          agreement_status_at_signing?: string
          agreement_text_sha256: string
          agreement_version_id: string
          company_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          pdf_path?: string | null
          signature_image_path: string
          signed_at?: string
          signed_name: string
          signed_title?: string | null
          signer_type: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          agreement_status_at_signing?: string
          agreement_text_sha256?: string
          agreement_version_id?: string
          company_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          pdf_path?: string | null
          signature_image_path?: string
          signed_at?: string
          signed_name?: string
          signed_title?: string | null
          signer_type?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agreement_signatures_agreement_version_id_fkey"
            columns: ["agreement_version_id"]
            isOneToOne: false
            referencedRelation: "agreement_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreement_signatures_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      agreement_versions: {
        Row: {
          body_markdown: string
          created_at: string
          created_by: string | null
          doc_type: string
          effective_date: string
          finalized_at: string | null
          finalized_by: string | null
          id: string
          is_current: boolean
          requires_resign: boolean
          status: string
          title: string
          version: string
        }
        Insert: {
          body_markdown: string
          created_at?: string
          created_by?: string | null
          doc_type?: string
          effective_date?: string
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          is_current?: boolean
          requires_resign?: boolean
          status?: string
          title?: string
          version: string
        }
        Update: {
          body_markdown?: string
          created_at?: string
          created_by?: string | null
          doc_type?: string
          effective_date?: string
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          is_current?: boolean
          requires_resign?: boolean
          status?: string
          title?: string
          version?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          audience: string
          body: string
          created_at: string
          created_by: string | null
          id: string
          published_at: string
          title: string
          updated_at: string
        }
        Insert: {
          audience?: string
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          published_at?: string
          title: string
          updated_at?: string
        }
        Update: {
          audience?: string
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          published_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          created_at: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      application_review_audit: {
        Row: {
          action: string
          actor_email: string | null
          actor_user_id: string | null
          application_id: string | null
          created_at: string
          id: string
          membership_application_id: string | null
          reason: string | null
          subject_company_id: string | null
          subject_user_id: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_user_id?: string | null
          application_id?: string | null
          created_at?: string
          id?: string
          membership_application_id?: string | null
          reason?: string | null
          subject_company_id?: string | null
          subject_user_id?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_user_id?: string | null
          application_id?: string | null
          created_at?: string
          id?: string
          membership_application_id?: string | null
          reason?: string | null
          subject_company_id?: string | null
          subject_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "application_review_audit_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "collective_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_review_audit_membership_application_id_fkey"
            columns: ["membership_application_id"]
            isOneToOne: false
            referencedRelation: "membership_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_review_audit_subject_company_id_fkey"
            columns: ["subject_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_milestones: {
        Row: {
          amount: number | null
          created_at: string
          fee_pct: number
          id: string
          invoice_issued_at: string | null
          invoice_number: string | null
          label: string
          milestone_key: string
          mission_id: string
          paid_at: string | null
          payment_due_date: string | null
          payment_note: string | null
          payment_reference: string | null
          sort_order: number
          status: string
          trigger_pct: number | null
          triggered_at: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          fee_pct: number
          id?: string
          invoice_issued_at?: string | null
          invoice_number?: string | null
          label: string
          milestone_key: string
          mission_id: string
          paid_at?: string | null
          payment_due_date?: string | null
          payment_note?: string | null
          payment_reference?: string | null
          sort_order: number
          status?: string
          trigger_pct?: number | null
          triggered_at?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          fee_pct?: number
          id?: string
          invoice_issued_at?: string | null
          invoice_number?: string | null
          label?: string
          milestone_key?: string
          mission_id?: string
          paid_at?: string | null
          payment_due_date?: string | null
          payment_note?: string | null
          payment_reference?: string | null
          sort_order?: number
          status?: string
          trigger_pct?: number | null
          triggered_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_milestones_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_members: {
        Row: {
          channel_id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          channel_id: string
          joined_at?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_reads: {
        Row: {
          channel_id: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          channel_id: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_reads_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          mission_id: string | null
          name: string | null
          type: Database["public"]["Enums"]["channel_type"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          mission_id?: string | null
          name?: string | null
          type: Database["public"]["Enums"]["channel_type"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          mission_id?: string | null
          name?: string | null
          type?: Database["public"]["Enums"]["channel_type"]
        }
        Relationships: [
          {
            foreignKeyName: "channels_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      collective_applications: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          linkedin_url: string
          mandate_description: string
          markets: string[]
          primary_domain: string
          reference: string
          referral_source: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          role_title: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id?: string
          linkedin_url: string
          mandate_description: string
          markets?: string[]
          primary_domain: string
          reference: string
          referral_source: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          role_title: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          linkedin_url?: string
          mandate_description?: string
          markets?: string[]
          primary_domain?: string
          reference?: string
          referral_source?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          role_title?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          application_id: string | null
          billing_contact_email: string | null
          billing_contact_name: string | null
          country: string | null
          created_at: string
          description: string | null
          hq_city: string | null
          id: string
          interests: string[]
          legal_name: string
          logo_path: string | null
          markets: string[]
          membership_since: string | null
          membership_status: string
          registration_no: string | null
          sector: string | null
          size_band: string | null
          trading_name: string | null
          updated_at: string
          website: string | null
          year_founded: number | null
        }
        Insert: {
          application_id?: string | null
          billing_contact_email?: string | null
          billing_contact_name?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          hq_city?: string | null
          id?: string
          interests?: string[]
          legal_name: string
          logo_path?: string | null
          markets?: string[]
          membership_since?: string | null
          membership_status?: string
          registration_no?: string | null
          sector?: string | null
          size_band?: string | null
          trading_name?: string | null
          updated_at?: string
          website?: string | null
          year_founded?: number | null
        }
        Update: {
          application_id?: string | null
          billing_contact_email?: string | null
          billing_contact_name?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          hq_city?: string | null
          id?: string
          interests?: string[]
          legal_name?: string
          logo_path?: string | null
          markets?: string[]
          membership_since?: string | null
          membership_status?: string
          registration_no?: string | null
          sector?: string | null
          size_band?: string | null
          trading_name?: string | null
          updated_at?: string
          website?: string | null
          year_founded?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_application_fk"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "membership_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      company_members: {
        Row: {
          company_id: string
          id: string
          invited_by: string | null
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          company_id: string
          id?: string
          invited_by?: string | null
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          company_id?: string
          id?: string
          invited_by?: string | null
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category: string
          created_at: string
          file_name: string
          file_size: number
          file_type: string
          id: string
          mission_id: string
          storage_path: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          file_name: string
          file_size: number
          file_type: string
          id?: string
          mission_id: string
          storage_path: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          file_name?: string
          file_size?: number
          file_type?: string
          id?: string
          mission_id?: string
          storage_path?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      engagement_nda_parties: {
        Row: {
          agreement_status_at_signing: string | null
          company_id: string | null
          company_name: string | null
          country: string | null
          created_at: string
          email: string | null
          id: string
          ip_address: string | null
          name: string
          nda_id: string
          party_kind: string
          pdf_path: string | null
          sign_token: string | null
          signature_image_path: string | null
          signed_at: string | null
          signed_by_user_id: string | null
          signed_name: string | null
          signed_title: string | null
          sort_order: number
          status: string
          text_sha256: string | null
          token_expires_at: string | null
          token_used_at: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          agreement_status_at_signing?: string | null
          company_id?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          ip_address?: string | null
          name: string
          nda_id: string
          party_kind: string
          pdf_path?: string | null
          sign_token?: string | null
          signature_image_path?: string | null
          signed_at?: string | null
          signed_by_user_id?: string | null
          signed_name?: string | null
          signed_title?: string | null
          sort_order?: number
          status?: string
          text_sha256?: string | null
          token_expires_at?: string | null
          token_used_at?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          agreement_status_at_signing?: string | null
          company_id?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          ip_address?: string | null
          name?: string
          nda_id?: string
          party_kind?: string
          pdf_path?: string | null
          sign_token?: string | null
          signature_image_path?: string | null
          signed_at?: string | null
          signed_by_user_id?: string | null
          signed_name?: string | null
          signed_title?: string | null
          sort_order?: number
          status?: string
          text_sha256?: string | null
          token_expires_at?: string | null
          token_used_at?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "engagement_nda_parties_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_nda_parties_nda_id_fkey"
            columns: ["nda_id"]
            isOneToOne: false
            referencedRelation: "engagement_ndas"
            referencedColumns: ["id"]
          },
        ]
      }
      engagement_ndas: {
        Row: {
          agreement_version_id: string
          created_at: string
          created_by: string | null
          executed_at: string | null
          executed_pdf_path: string | null
          id: string
          mission_id: string
          schedule: Json
          status: string
        }
        Insert: {
          agreement_version_id: string
          created_at?: string
          created_by?: string | null
          executed_at?: string | null
          executed_pdf_path?: string | null
          id?: string
          mission_id: string
          schedule?: Json
          status?: string
        }
        Update: {
          agreement_version_id?: string
          created_at?: string
          created_by?: string | null
          executed_at?: string | null
          executed_pdf_path?: string | null
          id?: string
          mission_id?: string
          schedule?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "engagement_ndas_agreement_version_id_fkey"
            columns: ["agreement_version_id"]
            isOneToOne: false
            referencedRelation: "agreement_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_ndas_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      featured_executives: {
        Row: {
          avatar_bg_color: string
          avatar_initials: string
          avatar_text_color: string
          avatar_url: string | null
          created_at: string
          display_order: number
          domain_tags: string[]
          full_name: string
          id: string
          is_primary: boolean
          is_visible: boolean
          linkedin_url: string | null
          role_subtitle: string | null
          role_title: string
          tenure_line: string | null
        }
        Insert: {
          avatar_bg_color?: string
          avatar_initials: string
          avatar_text_color?: string
          avatar_url?: string | null
          created_at?: string
          display_order?: number
          domain_tags?: string[]
          full_name: string
          id?: string
          is_primary?: boolean
          is_visible?: boolean
          linkedin_url?: string | null
          role_subtitle?: string | null
          role_title: string
          tenure_line?: string | null
        }
        Update: {
          avatar_bg_color?: string
          avatar_initials?: string
          avatar_text_color?: string
          avatar_url?: string | null
          created_at?: string
          display_order?: number
          domain_tags?: string[]
          full_name?: string
          id?: string
          is_primary?: boolean
          is_visible?: boolean
          linkedin_url?: string | null
          role_subtitle?: string | null
          role_title?: string
          tenure_line?: string | null
        }
        Relationships: []
      }
      founder_applications: {
        Row: {
          challenge: string
          company_name: string
          consent: boolean
          country: string
          created_at: string
          email: string
          full_name: string
          id: string
          linkedin_url: string | null
          needs: string[]
          reference: string
          sector: string
          stage: string
          website: string | null
        }
        Insert: {
          challenge: string
          company_name: string
          consent?: boolean
          country: string
          created_at?: string
          email: string
          full_name: string
          id?: string
          linkedin_url?: string | null
          needs: string[]
          reference: string
          sector: string
          stage: string
          website?: string | null
        }
        Update: {
          challenge?: string
          company_name?: string
          consent?: boolean
          country?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          linkedin_url?: string | null
          needs?: string[]
          reference?: string
          sector?: string
          stage?: string
          website?: string | null
        }
        Relationships: []
      }
      fractional_executives: {
        Row: {
          availability: Database["public"]["Enums"]["availability_status"]
          avatar_path: string | null
          bio: string | null
          company: string | null
          created_at: string
          email: string | null
          expertise: string[]
          id: string
          linkedin_url: string | null
          markets: string[]
          name: string
          role: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          availability?: Database["public"]["Enums"]["availability_status"]
          avatar_path?: string | null
          bio?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          expertise?: string[]
          id?: string
          linkedin_url?: string | null
          markets?: string[]
          name: string
          role: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          availability?: Database["public"]["Enums"]["availability_status"]
          avatar_path?: string | null
          bio?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          expertise?: string[]
          id?: string
          linkedin_url?: string | null
          markets?: string[]
          name?: string
          role?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      insights: {
        Row: {
          author_id: string | null
          content: string
          cover_image_url: string | null
          created_at: string
          domain: string | null
          excerpt: string | null
          id: string
          published: boolean
          published_at: string | null
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          content?: string
          cover_image_url?: string | null
          created_at?: string
          domain?: string | null
          excerpt?: string | null
          id?: string
          published?: boolean
          published_at?: string | null
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          content?: string
          cover_image_url?: string | null
          created_at?: string
          domain?: string | null
          excerpt?: string | null
          id?: string
          published?: boolean
          published_at?: string | null
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insights_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_sequence: {
        Row: {
          created_at: string
          id: number
          mission_id: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          mission_id?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          mission_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_sequence_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_myr: number
          billing_cycle: string
          company_id: string | null
          created_at: string
          draft_pricing: boolean
          due_at: string
          id: string
          issued_at: string
          membership_id: string
          notes: string | null
          number: string
          paid_at: string | null
          payment_reference: string | null
          pdf_path: string | null
          period_end: string | null
          period_start: string | null
          plan_id: string
          status: string
          stripe_invoice_id: string | null
          tax_rate: number
          total_myr: number
          user_id: string | null
        }
        Insert: {
          amount_myr: number
          billing_cycle: string
          company_id?: string | null
          created_at?: string
          draft_pricing?: boolean
          due_at?: string
          id?: string
          issued_at?: string
          membership_id: string
          notes?: string | null
          number: string
          paid_at?: string | null
          payment_reference?: string | null
          pdf_path?: string | null
          period_end?: string | null
          period_start?: string | null
          plan_id: string
          status?: string
          stripe_invoice_id?: string | null
          tax_rate?: number
          total_myr: number
          user_id?: string | null
        }
        Update: {
          amount_myr?: number
          billing_cycle?: string
          company_id?: string | null
          created_at?: string
          draft_pricing?: boolean
          due_at?: string
          id?: string
          issued_at?: string
          membership_id?: string
          notes?: string | null
          number?: string
          paid_at?: string | null
          payment_reference?: string | null
          pdf_path?: string | null
          period_end?: string | null
          period_start?: string | null
          plan_id?: string
          status?: string
          stripe_invoice_id?: string | null
          tax_rate?: number
          total_myr?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "membership_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          lead_id: string
          status: Database["public"]["Enums"]["lead_status"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          lead_id: string
          status: Database["public"]["Enums"]["lead_status"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          lead_id?: string
          status?: Database["public"]["Enums"]["lead_status"]
        }
        Relationships: [
          {
            foreignKeyName: "lead_status_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          brief: string | null
          created_at: string
          email: string
          id: string
          industry: string | null
          mission: string
          name: string
          phone: string | null
          reference: string
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
        }
        Insert: {
          brief?: string | null
          created_at?: string
          email: string
          id?: string
          industry?: string | null
          mission: string
          name: string
          phone?: string | null
          reference: string
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Update: {
          brief?: string | null
          created_at?: string
          email?: string
          id?: string
          industry?: string | null
          mission?: string
          name?: string
          phone?: string | null
          reference?: string
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Relationships: []
      }
      legal_agreements: {
        Row: {
          content: string | null
          created_at: string
          file_url: string | null
          id: string
          is_active: boolean
          updated_at: string
          version_name: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          file_url?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
          version_name: string
        }
        Update: {
          content?: string | null
          created_at?: string
          file_url?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
          version_name?: string
        }
        Relationships: []
      }
      member_notes: {
        Row: {
          author_id: string | null
          created_at: string
          id: string
          note: string
          subject_id: string
          subject_type: string
        }
        Insert: {
          author_id?: string | null
          created_at?: string
          id?: string
          note: string
          subject_id: string
          subject_type: string
        }
        Update: {
          author_id?: string | null
          created_at?: string
          id?: string
          note?: string
          subject_id?: string
          subject_type?: string
        }
        Relationships: []
      }
      membership_applications: {
        Row: {
          approved_as_collective: boolean
          approved_company_id: string | null
          approved_user_id: string | null
          billing_cycle: string | null
          created_at: string
          email: string
          id: string
          payload: Json
          plan_id: string | null
          quoted_price_myr: number | null
          reference: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source: string
          status: string
          type: string
          wants_collective: boolean
        }
        Insert: {
          approved_as_collective?: boolean
          approved_company_id?: string | null
          approved_user_id?: string | null
          billing_cycle?: string | null
          created_at?: string
          email: string
          id?: string
          payload?: Json
          plan_id?: string | null
          quoted_price_myr?: number | null
          reference: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string
          status?: string
          type: string
          wants_collective?: boolean
        }
        Update: {
          approved_as_collective?: boolean
          approved_company_id?: string | null
          approved_user_id?: string | null
          billing_cycle?: string | null
          created_at?: string
          email?: string
          id?: string
          payload?: Json
          plan_id?: string | null
          quoted_price_myr?: number | null
          reference?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string
          status?: string
          type?: string
          wants_collective?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "membership_applications_approved_company_id_fkey"
            columns: ["approved_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_applications_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "membership_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_plans: {
        Row: {
          annual_price_myr: number
          benefits: string[]
          code: string
          created_at: string
          id: string
          is_active: boolean
          is_draft: boolean
          is_popular: boolean
          max_users: number | null
          member_type: string
          monthly_price_myr: number
          name: string
          sort_order: number
          tagline: string | null
          updated_at: string
        }
        Insert: {
          annual_price_myr?: number
          benefits?: string[]
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_draft?: boolean
          is_popular?: boolean
          max_users?: number | null
          member_type: string
          monthly_price_myr?: number
          name: string
          sort_order?: number
          tagline?: string | null
          updated_at?: string
        }
        Update: {
          annual_price_myr?: number
          benefits?: string[]
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_draft?: boolean
          is_popular?: boolean
          max_users?: number | null
          member_type?: string
          monthly_price_myr?: number
          name?: string
          sort_order?: number
          tagline?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      memberships: {
        Row: {
          application_id: string | null
          billing_cycle: string
          cancel_at_period_end: boolean
          company_id: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          next_invoice_date: string | null
          payment_past_due_since: string | null
          plan_id: string
          price_myr: number
          status: string
          stripe_customer_id: string | null
          stripe_environment: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          application_id?: string | null
          billing_cycle: string
          cancel_at_period_end?: boolean
          company_id?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          next_invoice_date?: string | null
          payment_past_due_since?: string | null
          plan_id: string
          price_myr: number
          status?: string
          stripe_customer_id?: string | null
          stripe_environment?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          application_id?: string | null
          billing_cycle?: string
          cancel_at_period_end?: boolean
          company_id?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          next_invoice_date?: string | null
          payment_past_due_since?: string | null
          plan_id?: string
          price_myr?: number
          status?: string
          stripe_customer_id?: string | null
          stripe_environment?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "memberships_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "membership_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "membership_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          channel_id: string
          content: string
          created_at: string
          id: string
          mentioned_users: string[]
          user_id: string
        }
        Insert: {
          channel_id: string
          content: string
          created_at?: string
          id?: string
          mentioned_users?: string[]
          user_id: string
        }
        Update: {
          channel_id?: string
          content?: string
          created_at?: string
          id?: string
          mentioned_users?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_experts: {
        Row: {
          created_at: string
          executive_id: string
          id: string
          mission_id: string
          role_in_mandate: string | null
        }
        Insert: {
          created_at?: string
          executive_id: string
          id?: string
          mission_id: string
          role_in_mandate?: string | null
        }
        Update: {
          created_at?: string
          executive_id?: string
          id?: string
          mission_id?: string
          role_in_mandate?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mission_experts_executive_id_fkey"
            columns: ["executive_id"]
            isOneToOne: false
            referencedRelation: "fractional_executives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_experts_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_leads: {
        Row: {
          company: string | null
          created_at: string
          email: string
          id: string
          message: string | null
          mission_id: string
          name: string
          status: Database["public"]["Enums"]["mission_lead_status"]
          updated_at: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          email: string
          id?: string
          message?: string | null
          mission_id: string
          name: string
          status?: Database["public"]["Enums"]["mission_lead_status"]
          updated_at?: string
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string
          id?: string
          message?: string | null
          mission_id?: string
          name?: string
          status?: Database["public"]["Enums"]["mission_lead_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_leads_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_members: {
        Row: {
          id: string
          joined_at: string
          mission_id: string
          role: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          mission_id: string
          role: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          mission_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_members_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_milestones: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          mission_id: string
          sort_order: number
          status: string
          target_date: string
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          mission_id: string
          sort_order?: number
          status?: string
          target_date: string
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          mission_id?: string
          sort_order?: number
          status?: string
          target_date?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_milestones_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_progress_entries: {
        Row: {
          completion_pct: number
          created_at: string
          id: string
          logged_by: string | null
          milestone_id: string | null
          mission_id: string
          note: string | null
          recorded_at: string
          recorded_on: string | null
        }
        Insert: {
          completion_pct: number
          created_at?: string
          id?: string
          logged_by?: string | null
          milestone_id?: string | null
          mission_id: string
          note?: string | null
          recorded_at?: string
          recorded_on?: string | null
        }
        Update: {
          completion_pct?: number
          created_at?: string
          id?: string
          logged_by?: string | null
          milestone_id?: string | null
          mission_id?: string
          note?: string | null
          recorded_at?: string
          recorded_on?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mission_progress_entries_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "mission_milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_progress_entries_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_project_steps: {
        Row: {
          created_at: string
          id: string
          mission_id: string
          position: number
          status: Database["public"]["Enums"]["project_step_status"]
          step_key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          mission_id: string
          position: number
          status?: Database["public"]["Enums"]["project_step_status"]
          step_key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          mission_id?: string
          position?: number
          status?: Database["public"]["Enums"]["project_step_status"]
          step_key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mission_project_steps_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          mission_id: string
          status: Database["public"]["Enums"]["mission_status"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          mission_id: string
          status: Database["public"]["Enums"]["mission_status"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          mission_id?: string
          status?: Database["public"]["Enums"]["mission_status"]
        }
        Relationships: []
      }
      missions: {
        Row: {
          billing_contact_email: string | null
          brief: string | null
          client_id: string | null
          contract_currency: string
          contract_fee: number | null
          contract_signed_at: string | null
          country: string | null
          created_at: string
          customer: string | null
          description: string | null
          est_project_currency: string
          est_project_value: number | null
          est_timeline_end: string | null
          est_timeline_start: string | null
          estimated_fee: string | null
          estimated_timeline: string | null
          expected_outcome: string | null
          id: string
          invoice_prefix: string
          lead_executive_id: string | null
          lead_id: string | null
          mission_type: string | null
          priority: string
          project_brief: string | null
          signoff_completed_at: string | null
          status: Database["public"]["Enums"]["mission_status"]
          target_days: number
          title: string
          updated_at: string
        }
        Insert: {
          billing_contact_email?: string | null
          brief?: string | null
          client_id?: string | null
          contract_currency?: string
          contract_fee?: number | null
          contract_signed_at?: string | null
          country?: string | null
          created_at?: string
          customer?: string | null
          description?: string | null
          est_project_currency?: string
          est_project_value?: number | null
          est_timeline_end?: string | null
          est_timeline_start?: string | null
          estimated_fee?: string | null
          estimated_timeline?: string | null
          expected_outcome?: string | null
          id?: string
          invoice_prefix?: string
          lead_executive_id?: string | null
          lead_id?: string | null
          mission_type?: string | null
          priority?: string
          project_brief?: string | null
          signoff_completed_at?: string | null
          status?: Database["public"]["Enums"]["mission_status"]
          target_days?: number
          title: string
          updated_at?: string
        }
        Update: {
          billing_contact_email?: string | null
          brief?: string | null
          client_id?: string | null
          contract_currency?: string
          contract_fee?: number | null
          contract_signed_at?: string | null
          country?: string | null
          created_at?: string
          customer?: string | null
          description?: string | null
          est_project_currency?: string
          est_project_value?: number | null
          est_timeline_end?: string | null
          est_timeline_start?: string | null
          estimated_fee?: string | null
          estimated_timeline?: string | null
          expected_outcome?: string | null
          id?: string
          invoice_prefix?: string
          lead_executive_id?: string | null
          lead_id?: string | null
          mission_type?: string | null
          priority?: string
          project_brief?: string | null
          signoff_completed_at?: string | null
          status?: Database["public"]["Enums"]["mission_status"]
          target_days?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "missions_lead_executive_id_fkey"
            columns: ["lead_executive_id"]
            isOneToOne: false
            referencedRelation: "fractional_executives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "missions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_invites: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          expires_at: string
          full_name: string | null
          id: string
          token: string
          updated_at: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          expires_at?: string
          full_name?: string | null
          id?: string
          token?: string
          updated_at?: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          expires_at?: string
          full_name?: string | null
          id?: string
          token?: string
          updated_at?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      plan_change_requests: {
        Row: {
          created_at: string
          handled_at: string | null
          handled_by: string | null
          id: string
          membership_id: string
          note: string | null
          requested_by: string
          requested_cycle: string | null
          requested_plan_id: string | null
          status: string
        }
        Insert: {
          created_at?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          membership_id: string
          note?: string | null
          requested_by: string
          requested_cycle?: string | null
          requested_plan_id?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          membership_id?: string
          note?: string | null
          requested_by?: string
          requested_cycle?: string | null
          requested_plan_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_change_requests_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_change_requests_requested_plan_id_fkey"
            columns: ["requested_plan_id"]
            isOneToOne: false
            referencedRelation: "membership_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          agreement_signed_at: string | null
          agreement_version_id: string | null
          areas_of_expertise: string[] | null
          availability_hours: number | null
          avatar_color: string | null
          avatar_path: string | null
          avatar_url: string | null
          bio: string | null
          city: string | null
          collective_status: string
          company_id: string | null
          company_role: string | null
          contact_details: string | null
          country: string | null
          created_at: string
          expertise: string[]
          expertise_sharing: string | null
          full_name: string | null
          id: string
          industry: string | null
          initials: string | null
          is_onboarded: boolean
          job_title: string | null
          languages: string[]
          linkedin_url: string | null
          markets: string[]
          member_type: string | null
          membership_since: string | null
          membership_status: string
          notify_newsletter: boolean
          notify_program_updates: boolean
          organisation: string | null
          phone: string | null
          program_interests: string[]
          sector: string | null
          show_email: boolean
          show_in_directory: boolean
          show_linkedin: boolean
          show_phone: boolean
          signed_legal_name: string | null
          updated_at: string
          years_experience: number | null
        }
        Insert: {
          agreement_signed_at?: string | null
          agreement_version_id?: string | null
          areas_of_expertise?: string[] | null
          availability_hours?: number | null
          avatar_color?: string | null
          avatar_path?: string | null
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          collective_status?: string
          company_id?: string | null
          company_role?: string | null
          contact_details?: string | null
          country?: string | null
          created_at?: string
          expertise?: string[]
          expertise_sharing?: string | null
          full_name?: string | null
          id: string
          industry?: string | null
          initials?: string | null
          is_onboarded?: boolean
          job_title?: string | null
          languages?: string[]
          linkedin_url?: string | null
          markets?: string[]
          member_type?: string | null
          membership_since?: string | null
          membership_status?: string
          notify_newsletter?: boolean
          notify_program_updates?: boolean
          organisation?: string | null
          phone?: string | null
          program_interests?: string[]
          sector?: string | null
          show_email?: boolean
          show_in_directory?: boolean
          show_linkedin?: boolean
          show_phone?: boolean
          signed_legal_name?: string | null
          updated_at?: string
          years_experience?: number | null
        }
        Update: {
          agreement_signed_at?: string | null
          agreement_version_id?: string | null
          areas_of_expertise?: string[] | null
          availability_hours?: number | null
          avatar_color?: string | null
          avatar_path?: string | null
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          collective_status?: string
          company_id?: string | null
          company_role?: string | null
          contact_details?: string | null
          country?: string | null
          created_at?: string
          expertise?: string[]
          expertise_sharing?: string | null
          full_name?: string | null
          id?: string
          industry?: string | null
          initials?: string | null
          is_onboarded?: boolean
          job_title?: string | null
          languages?: string[]
          linkedin_url?: string | null
          markets?: string[]
          member_type?: string | null
          membership_since?: string | null
          membership_status?: string
          notify_newsletter?: boolean
          notify_program_updates?: boolean
          organisation?: string | null
          phone?: string | null
          program_interests?: string[]
          sector?: string | null
          show_email?: boolean
          show_in_directory?: boolean
          show_linkedin?: boolean
          show_phone?: boolean
          signed_legal_name?: string | null
          updated_at?: string
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_agreement_version_id_fkey"
            columns: ["agreement_version_id"]
            isOneToOne: false
            referencedRelation: "legal_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_company_fk"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      tgn_interests: {
        Row: {
          career_stage: string | null
          consent: boolean
          created_at: string
          email: string
          expertise: string[]
          expertise_other: string | null
          full_name: string
          geographies: string[]
          geography_other: string | null
          hours_available: string
          id: string
          linkedin_url: string | null
          models: string[]
          phone: string | null
          reference: string
          referral_source: string | null
          source: string | null
          updates_opt_in: boolean
        }
        Insert: {
          career_stage?: string | null
          consent: boolean
          created_at?: string
          email: string
          expertise: string[]
          expertise_other?: string | null
          full_name: string
          geographies: string[]
          geography_other?: string | null
          hours_available: string
          id?: string
          linkedin_url?: string | null
          models: string[]
          phone?: string | null
          reference: string
          referral_source?: string | null
          source?: string | null
          updates_opt_in?: boolean
        }
        Update: {
          career_stage?: string | null
          consent?: boolean
          created_at?: string
          email?: string
          expertise?: string[]
          expertise_other?: string | null
          full_name?: string
          geographies?: string[]
          geography_other?: string | null
          hours_available?: string
          id?: string
          linkedin_url?: string | null
          models?: string[]
          phone?: string | null
          reference?: string
          referral_source?: string | null
          source?: string | null
          updates_opt_in?: boolean
        }
        Relationships: []
      }
      tgn_mission_listings: {
        Row: {
          commitment: string | null
          company_id: string
          company_name: string
          contact_email: string
          created_at: string
          id: string
          location: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_by: string
          summary: string
          title: string
          updated_at: string
          workstream: string
        }
        Insert: {
          commitment?: string | null
          company_id: string
          company_name?: string
          contact_email: string
          created_at?: string
          id?: string
          location?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by: string
          summary: string
          title: string
          updated_at?: string
          workstream: string
        }
        Update: {
          commitment?: string | null
          company_id?: string
          company_name?: string
          contact_email?: string
          created_at?: string
          id?: string
          location?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by?: string
          summary?: string
          title?: string
          updated_at?: string
          workstream?: string
        }
        Relationships: [
          {
            foreignKeyName: "tgn_mission_listings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      tgn_rsvps: {
        Row: {
          attending_as: string
          consent: boolean
          country: string | null
          created_at: string
          dietary_notes: string | null
          email: string
          full_name: string
          id: string
          organisation: string | null
        }
        Insert: {
          attending_as: string
          consent: boolean
          country?: string | null
          created_at?: string
          dietary_notes?: string | null
          email: string
          full_name: string
          id?: string
          organisation?: string | null
        }
        Update: {
          attending_as?: string
          consent?: boolean
          country?: string | null
          created_at?: string
          dietary_notes?: string | null
          email?: string
          full_name?: string
          id?: string
          organisation?: string | null
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
      admin_void_signature: {
        Args: { _actor: string; _reason: string; _signature_id: string }
        Returns: undefined
      }
      billing_housekeeping: { Args: { _tax_rate?: number }; Returns: number }
      check_billing_milestone_triggers: {
        Args: { _mission_id: string; _new_pct: number }
        Returns: number
      }
      create_billing_milestones: {
        Args: { _currency?: string; _fee: number; _mission_id: string }
        Returns: undefined
      }
      has_channel_access: {
        Args: { _channel_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_company_admin: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      is_company_member: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      is_mission_member: {
        Args: { _mission_id: string; _user_id: string }
        Returns: boolean
      }
      next_membership_invoice_number: { Args: never; Returns: string }
      set_signature_pdf_path: {
        Args: { _pdf_path: string; _signature_id: string }
        Returns: undefined
      }
      sync_mission_channel_members: {
        Args: { _mission_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "collective_member"
      availability_status:
        | "available"
        | "limited"
        | "unavailable"
        | "not_deployed"
      channel_type: "general" | "mission" | "dm"
      lead_status:
        | "new"
        | "contacted"
        | "qualified"
        | "closed"
        | "archived"
        | "mission_active"
      mission_lead_status: "new" | "contacted" | "qualified" | "won" | "lost"
      mission_status:
        | "not_started"
        | "active"
        | "completed"
        | "cancelled"
        | "in_review"
        | "on_hold"
      project_step_status:
        | "not_started"
        | "in_progress"
        | "blocked"
        | "completed"
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
      app_role: ["admin", "moderator", "user", "collective_member"],
      availability_status: [
        "available",
        "limited",
        "unavailable",
        "not_deployed",
      ],
      channel_type: ["general", "mission", "dm"],
      lead_status: [
        "new",
        "contacted",
        "qualified",
        "closed",
        "archived",
        "mission_active",
      ],
      mission_lead_status: ["new", "contacted", "qualified", "won", "lost"],
      mission_status: [
        "not_started",
        "active",
        "completed",
        "cancelled",
        "in_review",
        "on_hold",
      ],
      project_step_status: [
        "not_started",
        "in_progress",
        "blocked",
        "completed",
      ],
    },
  },
} as const
