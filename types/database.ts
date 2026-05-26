export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      neighborhoods: {
        Row: {
          id: string;
          slug: string;
          name: string;
          city: string;
          state: string;
          active: boolean;
          featured_issue_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          city: string;
          state: string;
          active?: boolean;
          featured_issue_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          city?: string;
          state?: string;
          active?: boolean;
          featured_issue_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      app_settings: {
        Row: {
          key: string;
          value: string;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: string;
          updated_at?: string;
        };
        Update: {
          key?: string;
          value?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      zip_neighborhood_map: {
        Row: {
          id: string;
          zip_code: string;
          neighborhood_id: string;
        };
        Insert: {
          id?: string;
          zip_code: string;
          neighborhood_id: string;
        };
        Update: {
          id?: string;
          zip_code?: string;
          neighborhood_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "zip_neighborhood_map_neighborhood_id_fkey";
            columns: ["neighborhood_id"];
            isOneToOne: false;
            referencedRelation: "neighborhoods";
            referencedColumns: ["id"];
          }
        ];
      };
      subscribers: {
        Row: {
          id: string;
          user_id: string;
          neighborhood_id: string;
          first_name: string | null;
          last_name: string | null;
          address: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          neighborhood_id: string;
          first_name?: string | null;
          last_name?: string | null;
          address?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          neighborhood_id?: string;
          first_name?: string | null;
          last_name?: string | null;
          address?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscribers_neighborhood_id_fkey";
            columns: ["neighborhood_id"];
            isOneToOne: false;
            referencedRelation: "neighborhoods";
            referencedColumns: ["id"];
          }
        ];
      };
      newsletter_issues: {
        Row: {
          id: string;
          neighborhood_id: string;
          subject: string;
          preview_text: string | null;
          content_json: Json;
          html_body: string | null;
          status: string;
          scheduled_for: string | null;
          sent_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          neighborhood_id: string;
          subject: string;
          preview_text?: string | null;
          content_json: Json;
          html_body?: string | null;
          status?: string;
          scheduled_for?: string | null;
          sent_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          neighborhood_id?: string;
          subject?: string;
          preview_text?: string | null;
          content_json?: Json;
          html_body?: string | null;
          status?: string;
          scheduled_for?: string | null;
          sent_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "newsletter_issues_neighborhood_id_fkey";
            columns: ["neighborhood_id"];
            isOneToOne: false;
            referencedRelation: "neighborhoods";
            referencedColumns: ["id"];
          }
        ];
      };
      nominations: {
        Row: {
          id: string;
          neighborhood_id: string;
          nominee_name: string;
          nominee_description: string;
          submitted_by_email: string | null;
          selected: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          neighborhood_id: string;
          nominee_name: string;
          nominee_description: string;
          submitted_by_email?: string | null;
          selected?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          neighborhood_id?: string;
          nominee_name?: string;
          nominee_description?: string;
          submitted_by_email?: string | null;
          selected?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "nominations_neighborhood_id_fkey";
            columns: ["neighborhood_id"];
            isOneToOne: false;
            referencedRelation: "neighborhoods";
            referencedColumns: ["id"];
          }
        ];
      };
      quiz_responses: {
        Row: {
          id: string;
          user_id: string;
          issue_id: string;
          question: string;
          response: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          issue_id: string;
          question: string;
          response: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          issue_id?: string;
          question?: string;
          response?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quiz_responses_issue_id_fkey";
            columns: ["issue_id"];
            isOneToOne: false;
            referencedRelation: "newsletter_issues";
            referencedColumns: ["id"];
          }
        ];
      };
      email_events: {
        Row: {
          id: string;
          subscriber_id: string | null;
          issue_id: string | null;
          event_type: string;
          email: string | null;
          occurred_at: string;
        };
        Insert: {
          id?: string;
          subscriber_id?: string | null;
          issue_id?: string | null;
          event_type: string;
          email?: string | null;
          occurred_at?: string;
        };
        Update: {
          id?: string;
          subscriber_id?: string | null;
          issue_id?: string | null;
          event_type?: string;
          email?: string | null;
          occurred_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
