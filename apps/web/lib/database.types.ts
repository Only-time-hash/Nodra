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
      agents: {
        Row: {
          authority_scope: Json
          created_at: string
          external_id: string
          id: string
          kind: string
          last_seen_at: string | null
          metadata: Json
          name: string
          status: Database["public"]["Enums"]["agent_status"]
          workspace_id: string
        }
        Insert: {
          authority_scope?: Json
          created_at?: string
          external_id: string
          id?: string
          kind?: string
          last_seen_at?: string | null
          metadata?: Json
          name: string
          status?: Database["public"]["Enums"]["agent_status"]
          workspace_id: string
        }
        Update: {
          authority_scope?: Json
          created_at?: string
          external_id?: string
          id?: string
          kind?: string
          last_seen_at?: string | null
          metadata?: Json
          name?: string
          status?: Database["public"]["Enums"]["agent_status"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      causal_edges: {
        Row: {
          created_at: string
          event_id: string | null
          from_agent_id: string
          id: string
          incident_id: string | null
          relation: string
          to_agent_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          event_id?: string | null
          from_agent_id: string
          id?: string
          incident_id?: string | null
          relation: string
          to_agent_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          event_id?: string | null
          from_agent_id?: string
          id?: string
          incident_id?: string | null
          relation?: string
          to_agent_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "causal_edges_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "security_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "causal_edges_from_agent_id_fkey"
            columns: ["from_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "causal_edges_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "causal_edges_to_agent_id_fkey"
            columns: ["to_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "causal_edges_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      containment_actions: {
        Row: {
          action_type: string
          executed_at: string
          id: string
          incident_id: string
          reason: string
          requested_by: string | null
          result: Json
          target_ref: string
          target_type: string
          workspace_id: string
        }
        Insert: {
          action_type: string
          executed_at?: string
          id?: string
          incident_id: string
          reason: string
          requested_by?: string | null
          result?: Json
          target_ref: string
          target_type: string
          workspace_id: string
        }
        Update: {
          action_type?: string
          executed_at?: string
          id?: string
          incident_id?: string
          reason?: string
          requested_by?: string | null
          result?: Json
          target_ref?: string
          target_type?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "containment_actions_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "containment_actions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      credential_refs: {
        Row: {
          agent_id: string | null
          created_at: string
          fingerprint: string | null
          id: string
          label: string
          last_rotated_at: string | null
          provider: string
          secret_reference: string
          status: string
          workspace_id: string
        }
        Insert: {
          agent_id?: string | null
          created_at?: string
          fingerprint?: string | null
          id?: string
          label: string
          last_rotated_at?: string | null
          provider: string
          secret_reference: string
          status?: string
          workspace_id: string
        }
        Update: {
          agent_id?: string | null
          created_at?: string
          fingerprint?: string | null
          id?: string
          label?: string
          last_rotated_at?: string | null
          provider?: string
          secret_reference?: string
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credential_refs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credential_refs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      gateway_outbox: {
        Row: {
          agent_id: string | null
          created_at: string
          delivered_at: string | null
          id: string
          incident_id: string | null
          payload: Json
          phase: string
          request_id: string
          workspace_id: string
        }
        Insert: {
          agent_id?: string | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          incident_id?: string | null
          payload?: Json
          phase: string
          request_id: string
          workspace_id: string
        }
        Update: {
          agent_id?: string | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          incident_id?: string | null
          payload?: Json
          phase?: string
          request_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gateway_outbox_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gateway_outbox_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gateway_outbox_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      gateway_request_nonces: {
        Row: {
          agent_id: string
          created_at: string
          expires_at: string
          nonce: string
          request_timestamp: string
          workspace_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          expires_at: string
          nonce: string
          request_timestamp: string
          workspace_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          expires_at?: string
          nonce?: string
          request_timestamp?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gateway_request_nonce_agent_workspace_fkey"
            columns: ["workspace_id", "agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "gateway_request_nonces_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_affected_entities: {
        Row: {
          entity_ref: string
          entity_type: string
          evidence_event_id: string | null
          incident_id: string
          status: string
          workspace_id: string
        }
        Insert: {
          entity_ref: string
          entity_type: string
          evidence_event_id?: string | null
          incident_id: string
          status?: string
          workspace_id: string
        }
        Update: {
          entity_ref?: string
          entity_type?: string
          evidence_event_id?: string | null
          incident_id?: string
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_affected_entities_evidence_event_id_fkey"
            columns: ["evidence_event_id"]
            isOneToOne: false
            referencedRelation: "security_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_affected_entities_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_affected_entities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          contained_at: string | null
          id: string
          metadata: Json
          opened_at: string
          origin_agent_id: string | null
          resolved_at: string | null
          severity: string
          state: Database["public"]["Enums"]["incident_state"]
          title: string
          workspace_id: string
        }
        Insert: {
          contained_at?: string | null
          id?: string
          metadata?: Json
          opened_at?: string
          origin_agent_id?: string | null
          resolved_at?: string | null
          severity?: string
          state?: Database["public"]["Enums"]["incident_state"]
          title: string
          workspace_id: string
        }
        Update: {
          contained_at?: string | null
          id?: string
          metadata?: Json
          opened_at?: string
          origin_agent_id?: string | null
          resolved_at?: string | null
          severity?: string
          state?: Database["public"]["Enums"]["incident_state"]
          title?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_origin_agent_id_fkey"
            columns: ["origin_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      laboratory_security_state: {
        Row: {
          credential_generation: number
          memory_clean: boolean
          origin_patched: boolean
          pending_jobs: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          credential_generation?: number
          memory_clean?: boolean
          origin_patched?: boolean
          pending_jobs?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          credential_generation?: number
          memory_clean?: boolean
          origin_patched?: boolean
          pending_jobs?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "laboratory_security_state_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      policies: {
        Row: {
          action: string
          agent_id: string | null
          constraints: Json
          created_at: string
          effect: Database["public"]["Enums"]["security_decision"]
          enabled: boolean
          id: string
          resource_id: string | null
          workspace_id: string
        }
        Insert: {
          action: string
          agent_id?: string | null
          constraints?: Json
          created_at?: string
          effect: Database["public"]["Enums"]["security_decision"]
          enabled?: boolean
          id?: string
          resource_id?: string | null
          workspace_id: string
        }
        Update: {
          action?: string
          agent_id?: string | null
          constraints?: Json
          created_at?: string
          effect?: Database["public"]["Enums"]["security_decision"]
          enabled?: boolean
          id?: string
          resource_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "policies_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      recovery_plans: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          incident_id: string
          restart_checks: Json
          safe_to_restart: boolean
          workspace_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          incident_id: string
          restart_checks?: Json
          safe_to_restart?: boolean
          workspace_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          incident_id?: string
          restart_checks?: Json
          safe_to_restart?: boolean
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recovery_plans_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: true
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recovery_plans_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      recovery_steps: {
        Row: {
          completed_at: string | null
          id: string
          reason: string
          recovery_plan_id: string
          requires_human: boolean
          status: Database["public"]["Enums"]["recovery_status"]
          title: string
          workspace_id: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          reason: string
          recovery_plan_id: string
          requires_human?: boolean
          status?: Database["public"]["Enums"]["recovery_status"]
          title: string
          workspace_id: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          reason?: string
          recovery_plan_id?: string
          requires_human?: boolean
          status?: Database["public"]["Enums"]["recovery_status"]
          title?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recovery_steps_recovery_plan_id_fkey"
            columns: ["recovery_plan_id"]
            isOneToOne: false
            referencedRelation: "recovery_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recovery_steps_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      remediation_actions: {
        Row: {
          action_type: string
          completed_at: string | null
          id: string
          incident_id: string
          requested_by: string
          result: Json
          started_at: string | null
          status: string
          target: string
          workspace_id: string
        }
        Insert: {
          action_type: string
          completed_at?: string | null
          id?: string
          incident_id: string
          requested_by?: string
          result?: Json
          started_at?: string | null
          status?: string
          target: string
          workspace_id: string
        }
        Update: {
          action_type?: string
          completed_at?: string | null
          id?: string
          incident_id?: string
          requested_by?: string
          result?: Json
          started_at?: string | null
          status?: string
          target?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "remediation_actions_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remediation_actions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      remediation_evidence: {
        Row: {
          adapter_action_id: string | null
          check_key: string
          details: Json
          evidence_ref: string
          evidence_type: string
          id: string
          incident_id: string
          source: string
          verified_at: string
          verified_by: string | null
          workspace_id: string
        }
        Insert: {
          adapter_action_id?: string | null
          check_key: string
          details?: Json
          evidence_ref: string
          evidence_type: string
          id?: string
          incident_id: string
          source?: string
          verified_at?: string
          verified_by?: string | null
          workspace_id: string
        }
        Update: {
          adapter_action_id?: string | null
          check_key?: string
          details?: Json
          evidence_ref?: string
          evidence_type?: string
          id?: string
          incident_id?: string
          source?: string
          verified_at?: string
          verified_by?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "remediation_evidence_adapter_action_id_fkey"
            columns: ["adapter_action_id"]
            isOneToOne: false
            referencedRelation: "remediation_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remediation_evidence_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remediation_evidence_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          created_at: string
          external_id: string
          id: string
          kind: string
          metadata: Json
          name: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          external_id: string
          id?: string
          kind: string
          metadata?: Json
          name: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          external_id?: string
          id?: string
          kind?: string
          metadata?: Json
          name?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resources_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      security_events: {
        Row: {
          action: string | null
          agent_id: string | null
          caused_by_event_id: string | null
          decision: Database["public"]["Enums"]["security_decision"] | null
          event_hash: string
          event_type: string
          id: string
          incident_id: string | null
          occurred_at: string
          payload: Json
          prev_hash: string | null
          recorded_at: string
          resource_id: string | null
          sequence_no: number
          workspace_id: string
        }
        Insert: {
          action?: string | null
          agent_id?: string | null
          caused_by_event_id?: string | null
          decision?: Database["public"]["Enums"]["security_decision"] | null
          event_hash: string
          event_type: string
          id?: string
          incident_id?: string | null
          occurred_at?: string
          payload?: Json
          prev_hash?: string | null
          recorded_at?: string
          resource_id?: string | null
          sequence_no: number
          workspace_id: string
        }
        Update: {
          action?: string | null
          agent_id?: string | null
          caused_by_event_id?: string | null
          decision?: Database["public"]["Enums"]["security_decision"] | null
          event_hash?: string
          event_type?: string
          id?: string
          incident_id?: string | null
          occurred_at?: string
          payload?: Json
          prev_hash?: string | null
          recorded_at?: string
          resource_id?: string | null
          sequence_no?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "security_events_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_events_caused_by_event_id_fkey"
            columns: ["caused_by_event_id"]
            isOneToOne: false
            referencedRelation: "security_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_events_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_events_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_decisions: {
        Row: { id:string; workspace_id:string; security_event_id:string; decided_by:string; decision:string; reason:string|null; decided_at:string; execution_token_hash:string|null; execution_token_expires_at:string|null; consumed_at:string|null }
        Insert: { id?:string; workspace_id:string; security_event_id:string; decided_by:string; decision:string; reason?:string|null; decided_at?:string; execution_token_hash?:string|null; execution_token_expires_at?:string|null; consumed_at?:string|null }
        Update: { id?:string; workspace_id?:string; security_event_id?:string; decided_by?:string; decision?:string; reason?:string|null; decided_at?:string; execution_token_hash?:string|null; execution_token_expires_at?:string|null; consumed_at?:string|null }
        Relationships: [
          { foreignKeyName:"approval_decisions_workspace_id_fkey"; columns:["workspace_id"]; isOneToOne:false; referencedRelation:"workspaces"; referencedColumns:["id"] },
          { foreignKeyName:"approval_decisions_security_event_id_fkey"; columns:["security_event_id"]; isOneToOne:false; referencedRelation:"security_events"; referencedColumns:["id"] }
        ]
      }
      integration_credentials: {
        Row: {
          id: string
          workspace_id: string
          agent_id: string
          label: string
          secret_hash: string
          secret_prefix: string
          status: string
          created_by: string
          created_at: string
          last_used_at: string | null
          revoked_at: string | null
          rotated_from: string | null
        }
        Insert: {
          id?: string
          workspace_id: string
          agent_id: string
          label: string
          secret_hash: string
          secret_prefix: string
          status?: string
          created_by: string
          created_at?: string
          last_used_at?: string | null
          revoked_at?: string | null
          rotated_from?: string | null
        }
        Update: {
          id?: string
          workspace_id?: string
          agent_id?: string
          label?: string
          secret_hash?: string
          secret_prefix?: string
          status?: string
          created_by?: string
          created_at?: string
          last_used_at?: string | null
          revoked_at?: string | null
          rotated_from?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_credentials_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_credentials_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_credentials_rotated_from_fkey"
            columns: ["rotated_from"]
            isOneToOne: false
            referencedRelation: "integration_credentials"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string
          role: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      append_security_event: {
        Args: {
          p_action?: string
          p_agent_id: string
          p_caused_by_event_id?: string
          p_decision?: Database["public"]["Enums"]["security_decision"]
          p_event_type: string
          p_incident_id: string | null
          p_occurred_at?: string
          p_payload?: Json
          p_resource_id?: string
          p_workspace_id: string
        }
        Returns: {
          action: string | null
          agent_id: string | null
          caused_by_event_id: string | null
          decision: Database["public"]["Enums"]["security_decision"] | null
          event_hash: string
          event_type: string
          id: string
          incident_id: string | null
          occurred_at: string
          payload: Json
          prev_hash: string | null
          recorded_at: string
          resource_id: string | null
          sequence_no: number
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "security_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      apply_laboratory_remediation_state: {
        Args: { p_action_type: string; p_workspace_id: string }
        Returns: Json
      }
      assess_incident_restart: {
        Args: { p_incident_id: string }
        Returns: boolean
      }
      complete_incident_restart: {
        Args: { p_incident_id: string }
        Returns: boolean
      }
      containment_scope: {
        Args: { p_incident_id: string }
        Returns: {
          action: string
          agent_id: string
          depth: number
          external_id: string
        }[]
      }
      create_workspace: {
        Args: { p_name: string; p_slug: string }
        Returns: string
      }
      incident_blast_radius: {
        Args: { p_incident_id: string }
        Returns: {
          agent_id: string
          depth: number
          external_id: string
        }[]
      }
      consume_gateway_rate_limit: {
        Args: {
          p_agent_id: string
          p_workspace_id: string
        }
        Returns: {
          allowed: boolean
          remaining: number
          retry_after_seconds: number
        }[]
      }
      consume_protected_agent_rate_limit: {
        Args: { p_workspace_id: string }
        Returns: {
          allowed: boolean
          remaining: number
          retry_after_seconds: number
        }[]
      }
      record_gateway_intent: {
        Args: {
          p_agent_id: string
          p_incident_id: string | null
          p_payload: Json
          p_request_id: string
          p_workspace_id: string
        }
        Returns: string
      }
      refresh_recovery_evidence: {
        Args: { p_incident_id: string }
        Returns: Json
      }
      reset_laboratory: { Args: { p_workspace_id: string }; Returns: Json }
      run_laboratory_remediation: {
        Args: { p_action_type: string; p_incident_id: string; p_target: string }
        Returns: Json
      }
      run_laboratory_remediation_atomic: {
        Args: {
          p_action_type: string
          p_incident_id: string
          p_target?: string
        }
        Returns: Json
      }
      sync_recovery_steps_for_incident: {
        Args: { p_action_type: string; p_incident_id: string }
        Returns: undefined
      }
      verify_security_event_chain: {
        Args: { p_workspace_id: string }
        Returns: {
          checked_events: number
          first_bad_sequence: number
          reason: string
          valid: boolean
        }[]
      }
    }
    Enums: {
      agent_status: "healthy" | "at_risk" | "quarantined" | "paused" | "offline"
      incident_state: "open" | "contained" | "recovering" | "resolved"
      recovery_status: "pending" | "ready" | "completed" | "skipped"
      security_decision: "allow" | "deny" | "require_approval"
      workspace_role: "owner" | "admin" | "analyst" | "viewer"
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
      agent_status: ["healthy", "at_risk", "quarantined", "paused", "offline"],
      incident_state: ["open", "contained", "recovering", "resolved"],
      recovery_status: ["pending", "ready", "completed", "skipped"],
      security_decision: ["allow", "deny", "require_approval"],
      workspace_role: ["owner", "admin", "analyst", "viewer"],
    },
  },
} as const
