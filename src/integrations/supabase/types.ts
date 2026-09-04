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
      admin_messages: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          sender_avatar_url: string | null
          sender_id: string
          sender_name: string
          sender_role: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          sender_avatar_url?: string | null
          sender_id: string
          sender_name: string
          sender_role: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          sender_avatar_url?: string | null
          sender_id?: string
          sender_name?: string
          sender_role?: string
        }
        Relationships: []
      }
      admin_operational_notes: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          owner_name: string
          problem: string
          reference: string | null
          solved_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          owner_name?: string
          problem: string
          reference?: string | null
          solved_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          owner_name?: string
          problem?: string
          reference?: string | null
          solved_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      attendance: {
        Row: {
          check_in: string
          check_out: string | null
          created_at: string
          id: string
          last_activity_at: string | null
          note: string | null
          user_id: string
        }
        Insert: {
          check_in?: string
          check_out?: string | null
          created_at?: string
          id?: string
          last_activity_at?: string | null
          note?: string | null
          user_id: string
        }
        Update: {
          check_in?: string
          check_out?: string | null
          created_at?: string
          id?: string
          last_activity_at?: string | null
          note?: string | null
          user_id?: string
        }
        Relationships: []
      }
      banners: {
        Row: {
          created_at: string
          display_order: number
          id: string
          image_url: string
          is_active: boolean
          link_url: string | null
          title: string | null
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          image_url: string
          is_active?: boolean
          link_url?: string | null
          title?: string | null
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string
          is_active?: boolean
          link_url?: string | null
          title?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          display_order: number
          id: string
          image_url: string | null
          is_hidden_from_home: boolean
          name: string
          parent_id: string | null
          slug: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string | null
          is_hidden_from_home?: boolean
          name: string
          parent_id?: string | null
          slug: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string | null
          is_hidden_from_home?: boolean
          name?: string
          parent_id?: string | null
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean
          min_order: number
        }
        Insert: {
          code: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          min_order?: number
        }
        Update: {
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          min_order?: number
        }
        Relationships: []
      }
      courier_edge_throttle: {
        Row: {
          id: number
          next_allowed_at: string
        }
        Insert: {
          id: number
          next_allowed_at?: string
        }
        Update: {
          id?: number
          next_allowed_at?: string
        }
        Relationships: []
      }
      courier_history_cache: {
        Row: {
          configured: boolean
          error: string | null
          expires_at: string
          fetched_at: string
          phone: string
          stats: Json
          steadfast_source: string | null
        }
        Insert: {
          configured?: boolean
          error?: string | null
          expires_at?: string
          fetched_at?: string
          phone: string
          stats?: Json
          steadfast_source?: string | null
        }
        Update: {
          configured?: boolean
          error?: string | null
          expires_at?: string
          fetched_at?: string
          phone?: string
          stats?: Json
          steadfast_source?: string | null
        }
        Relationships: []
      }
      courier_provider_throttle: {
        Row: {
          id: number
          next_allowed_at: string
        }
        Insert: {
          id: number
          next_allowed_at?: string
        }
        Update: {
          id?: number
          next_allowed_at?: string
        }
        Relationships: []
      }
      customer_blocklist: {
        Row: {
          blocked_at: string
          blocked_by: string | null
          customer_name: string
          id: string
          ip_address: string | null
          is_active: boolean
          unblocked_at: string | null
          unblocked_by: string | null
        }
        Insert: {
          blocked_at?: string
          blocked_by?: string | null
          customer_name: string
          id?: string
          ip_address?: string | null
          is_active?: boolean
          unblocked_at?: string | null
          unblocked_by?: string | null
        }
        Update: {
          blocked_at?: string
          blocked_by?: string | null
          customer_name?: string
          id?: string
          ip_address?: string | null
          is_active?: boolean
          unblocked_at?: string | null
          unblocked_by?: string | null
        }
        Relationships: []
      }
      customer_blocks: {
        Row: {
          blocked_at: string
          blocked_by: string | null
          customer_name: string | null
          id: string
          ip_address: string | null
          is_active: boolean
          phone: string | null
          unblocked_at: string | null
        }
        Insert: {
          blocked_at?: string
          blocked_by?: string | null
          customer_name?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean
          phone?: string | null
          unblocked_at?: string | null
        }
        Update: {
          blocked_at?: string
          blocked_by?: string | null
          customer_name?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean
          phone?: string | null
          unblocked_at?: string | null
        }
        Relationships: []
      }
      dashboard_web_order_counter: {
        Row: {
          cancelled_count: number
          confirmed_count: number
          created_at: string
          id: boolean
          processing_count: number
          total_received: number
          updated_at: string
        }
        Insert: {
          cancelled_count?: number
          confirmed_count?: number
          created_at?: string
          id?: boolean
          processing_count?: number
          total_received?: number
          updated_at?: string
        }
        Update: {
          cancelled_count?: number
          confirmed_count?: number
          created_at?: string
          id?: boolean
          processing_count?: number
          total_received?: number
          updated_at?: string
        }
        Relationships: []
      }
      deleted_orders: {
        Row: {
          customer_name: string
          customer_phone: string
          deleted_at: string
          deleted_by: string | null
          id: string
          invoice_no: string | null
          items: Json
          order_data: Json
          original_created_at: string
          original_status: string
          status_logs: Json
          total: number
        }
        Insert: {
          customer_name: string
          customer_phone: string
          deleted_at?: string
          deleted_by?: string | null
          id: string
          invoice_no?: string | null
          items?: Json
          order_data: Json
          original_created_at: string
          original_status: string
          status_logs?: Json
          total?: number
        }
        Update: {
          customer_name?: string
          customer_phone?: string
          deleted_at?: string
          deleted_by?: string | null
          id?: string
          invoice_no?: string | null
          items?: Json
          order_data?: Json
          original_created_at?: string
          original_status?: string
          status_logs?: Json
          total?: number
        }
        Relationships: []
      }
      employee_permissions: {
        Row: {
          all_api: boolean
          categories: boolean
          customers: boolean
          dashboard: boolean
          dashboard_confirmed_sell: boolean
          dashboard_incomplete_orders: boolean
          dashboard_live_visitors: boolean
          dashboard_meta_ads: boolean
          dashboard_stock_alert: boolean
          dashboard_time_filter: boolean
          dashboard_web_orders: boolean
          delivery: boolean
          hrm: boolean
          landing_pages: boolean
          marketing: boolean
          messages: boolean
          new_order: boolean
          orders: boolean
          products: boolean
          reports: boolean
          settings: boolean
          updated_at: string
          user_id: string
          web_orders: boolean
        }
        Insert: {
          all_api?: boolean
          categories?: boolean
          customers?: boolean
          dashboard?: boolean
          dashboard_confirmed_sell?: boolean
          dashboard_incomplete_orders?: boolean
          dashboard_live_visitors?: boolean
          dashboard_meta_ads?: boolean
          dashboard_stock_alert?: boolean
          dashboard_time_filter?: boolean
          dashboard_web_orders?: boolean
          delivery?: boolean
          hrm?: boolean
          landing_pages?: boolean
          marketing?: boolean
          messages?: boolean
          new_order?: boolean
          orders?: boolean
          products?: boolean
          reports?: boolean
          settings?: boolean
          updated_at?: string
          user_id: string
          web_orders?: boolean
        }
        Update: {
          all_api?: boolean
          categories?: boolean
          customers?: boolean
          dashboard?: boolean
          dashboard_confirmed_sell?: boolean
          dashboard_incomplete_orders?: boolean
          dashboard_live_visitors?: boolean
          dashboard_meta_ads?: boolean
          dashboard_stock_alert?: boolean
          dashboard_time_filter?: boolean
          dashboard_web_orders?: boolean
          delivery?: boolean
          hrm?: boolean
          landing_pages?: boolean
          marketing?: boolean
          messages?: boolean
          new_order?: boolean
          orders?: boolean
          products?: boolean
          reports?: boolean
          settings?: boolean
          updated_at?: string
          user_id?: string
          web_orders?: boolean
        }
        Relationships: []
      }
      employees: {
        Row: {
          achievements: Json
          admin_notes: string
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          join_date: string | null
          leave_balance: number
          monthly_bonus: number
          monthly_target: number
          name: string
          phone: string | null
          position: string | null
          salary: number | null
          user_id: string | null
        }
        Insert: {
          achievements?: Json
          admin_notes?: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          join_date?: string | null
          leave_balance?: number
          monthly_bonus?: number
          monthly_target?: number
          name: string
          phone?: string | null
          position?: string | null
          salary?: number | null
          user_id?: string | null
        }
        Update: {
          achievements?: Json
          admin_notes?: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          join_date?: string | null
          leave_balance?: number
          monthly_bonus?: number
          monthly_target?: number
          name?: string
          phone?: string | null
          position?: string | null
          salary?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      endpoint_egress_hourly: {
        Row: {
          bucket_hour: string
          created_at: string
          endpoint: string
          method: string
          request_count: number
          response_bytes: number
          status_class: number
        }
        Insert: {
          bucket_hour: string
          created_at?: string
          endpoint: string
          method: string
          request_count?: number
          response_bytes?: number
          status_class: number
        }
        Update: {
          bucket_hour?: string
          created_at?: string
          endpoint?: string
          method?: string
          request_count?: number
          response_bytes?: number
          status_class?: number
        }
        Relationships: []
      }
      fb_comments: {
        Row: {
          ai_reply: string | null
          comment_id: string
          created_at: string
          from_id: string | null
          from_name: string | null
          id: string
          page_id: string
          parent_comment_id: string | null
          permalink: string | null
          post_id: string | null
          private_replied: boolean
          replied: boolean
          reply_error: string | null
          text: string | null
        }
        Insert: {
          ai_reply?: string | null
          comment_id: string
          created_at?: string
          from_id?: string | null
          from_name?: string | null
          id?: string
          page_id: string
          parent_comment_id?: string | null
          permalink?: string | null
          post_id?: string | null
          private_replied?: boolean
          replied?: boolean
          reply_error?: string | null
          text?: string | null
        }
        Update: {
          ai_reply?: string | null
          comment_id?: string
          created_at?: string
          from_id?: string | null
          from_name?: string | null
          id?: string
          page_id?: string
          parent_comment_id?: string | null
          permalink?: string | null
          post_id?: string | null
          private_replied?: boolean
          replied?: boolean
          reply_error?: string | null
          text?: string | null
        }
        Relationships: []
      }
      fb_conversations: {
        Row: {
          ai_enabled: boolean
          ai_paused_until: string | null
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          id: string
          last_message_at: string
          last_message_text: string | null
          last_order_id: string | null
          needs_human: boolean
          page_id: string
          psid: string
          status: string
          unread_count: number
          updated_at: string
        }
        Insert: {
          ai_enabled?: boolean
          ai_paused_until?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          last_message_at?: string
          last_message_text?: string | null
          last_order_id?: string | null
          needs_human?: boolean
          page_id: string
          psid: string
          status?: string
          unread_count?: number
          updated_at?: string
        }
        Update: {
          ai_enabled?: boolean
          ai_paused_until?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          last_message_at?: string
          last_message_text?: string | null
          last_order_id?: string | null
          needs_human?: boolean
          page_id?: string
          psid?: string
          status?: string
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fb_conversations_last_order_id_fkey"
            columns: ["last_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      fb_locks: {
        Row: {
          key: string
          locked_until: string
        }
        Insert: {
          key: string
          locked_until?: string
        }
        Update: {
          key?: string
          locked_until?: string
        }
        Relationships: []
      }
      fb_messages: {
        Row: {
          ai_handled: boolean
          attachments: Json
          conversation_id: string
          created_at: string
          direction: string
          external_id: string | null
          id: string
          mid: string | null
          sent_by: string | null
          staff_id: string | null
          text: string | null
        }
        Insert: {
          ai_handled?: boolean
          attachments?: Json
          conversation_id: string
          created_at?: string
          direction: string
          external_id?: string | null
          id?: string
          mid?: string | null
          sent_by?: string | null
          staff_id?: string | null
          text?: string | null
        }
        Update: {
          ai_handled?: boolean
          attachments?: Json
          conversation_id?: string
          created_at?: string
          direction?: string
          external_id?: string | null
          id?: string
          mid?: string | null
          sent_by?: string | null
          staff_id?: string | null
          text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fb_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "fb_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      fb_trainer_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          image_url: string | null
          learned_a: string | null
          learned_q: string | null
          role: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          learned_a?: string | null
          learned_q?: string | null
          role: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          learned_a?: string | null
          learned_q?: string | null
          role?: string
        }
        Relationships: []
      }
      incomplete_events: {
        Row: {
          created_at: string
          event: string
          id: number
          phone: string
        }
        Insert: {
          created_at?: string
          event: string
          id?: number
          phone: string
        }
        Update: {
          created_at?: string
          event?: string
          id?: number
          phone?: string
        }
        Relationships: []
      }
      incomplete_orders: {
        Row: {
          created_at: string
          customer_address: string | null
          customer_name: string | null
          delivery_fee: number
          delivery_zone: string | null
          id: string
          ip: string | null
          items: Json
          note: string | null
          phone: string
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_address?: string | null
          customer_name?: string | null
          delivery_fee?: number
          delivery_zone?: string | null
          id?: string
          ip?: string | null
          items?: Json
          note?: string | null
          phone: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_address?: string | null
          customer_name?: string | null
          delivery_fee?: number
          delivery_zone?: string | null
          id?: string
          ip?: string | null
          items?: Json
          note?: string | null
          phone?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      integrations: {
        Row: {
          config: Json
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          config?: Json
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          config?: Json
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      landing_pages: {
        Row: {
          addons: Json
          badges: Json
          created_at: string
          cta_text: string | null
          delivery_inside: number
          delivery_outside: number
          description: string | null
          faq: Json
          features: Json
          gallery_images: string[]
          guarantee_text: string | null
          hero_image: string | null
          hero_subtitle: string | null
          hero_title: string | null
          id: string
          is_published: boolean
          main_delivery_fee: number | null
          planting_steps: Json
          product_id: string | null
          regular_price: number | null
          reviews: Json
          sale_price: number | null
          seeds_list: Json
          show_faq: boolean
          show_features: boolean
          show_reviews: boolean
          slug: string
          theme_color: string | null
          title: string
          top_bar_text: string | null
          video_url: string | null
          why_choose_us: Json
        }
        Insert: {
          addons?: Json
          badges?: Json
          created_at?: string
          cta_text?: string | null
          delivery_inside?: number
          delivery_outside?: number
          description?: string | null
          faq?: Json
          features?: Json
          gallery_images?: string[]
          guarantee_text?: string | null
          hero_image?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          id?: string
          is_published?: boolean
          main_delivery_fee?: number | null
          planting_steps?: Json
          product_id?: string | null
          regular_price?: number | null
          reviews?: Json
          sale_price?: number | null
          seeds_list?: Json
          show_faq?: boolean
          show_features?: boolean
          show_reviews?: boolean
          slug: string
          theme_color?: string | null
          title: string
          top_bar_text?: string | null
          video_url?: string | null
          why_choose_us?: Json
        }
        Update: {
          addons?: Json
          badges?: Json
          created_at?: string
          cta_text?: string | null
          delivery_inside?: number
          delivery_outside?: number
          description?: string | null
          faq?: Json
          features?: Json
          gallery_images?: string[]
          guarantee_text?: string | null
          hero_image?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          id?: string
          is_published?: boolean
          main_delivery_fee?: number | null
          planting_steps?: Json
          product_id?: string | null
          regular_price?: number | null
          reviews?: Json
          sale_price?: number | null
          seeds_list?: Json
          show_faq?: boolean
          show_features?: boolean
          show_reviews?: boolean
          slug?: string
          theme_color?: string | null
          title?: string
          top_bar_text?: string | null
          video_url?: string | null
          why_choose_us?: Json
        }
        Relationships: [
          {
            foreignKeyName: "landing_pages_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_ads_cache: {
        Row: {
          cache_key: string
          fetched_at: string
          payload: Json
        }
        Insert: {
          cache_key: string
          fetched_at?: string
          payload: Json
        }
        Update: {
          cache_key?: string
          fetched_at?: string
          payload?: Json
        }
        Relationships: []
      }
      order_action_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          order_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          order_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          order_id?: string
        }
        Relationships: []
      }
      order_cancellation_history: {
        Row: {
          cancelled_at: string
          id: string
          order_id: string | null
          source: string
        }
        Insert: {
          cancelled_at?: string
          id?: string
          order_id?: string | null
          source: string
        }
        Update: {
          cancelled_at?: string
          id?: string
          order_id?: string | null
          source?: string
        }
        Relationships: []
      }
      order_distribution_members: {
        Row: {
          created_at: string
          enabled: boolean
          name: string
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          name: string
          position?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          name?: string
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      order_distribution_state: {
        Row: {
          id: boolean
          next_position: number
          updated_at: string
        }
        Insert: {
          id?: boolean
          next_position?: number
          updated_at?: string
        }
        Update: {
          id?: boolean
          next_position?: number
          updated_at?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          price: number
          product_id: string | null
          product_name: string
          quantity: number
          subtotal: number
        }
        Insert: {
          id?: string
          order_id: string
          price?: number
          product_id?: string | null
          product_name: string
          quantity?: number
          subtotal?: number
        }
        Update: {
          id?: string
          order_id?: string
          price?: number
          product_id?: string | null
          product_name?: string
          quantity?: number
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_locks: {
        Row: {
          heartbeat_at: string
          locked_at: string
          order_id: string
          user_id: string
          user_name: string | null
        }
        Insert: {
          heartbeat_at?: string
          locked_at?: string
          order_id: string
          user_id: string
          user_name?: string | null
        }
        Update: {
          heartbeat_at?: string
          locked_at?: string
          order_id?: string
          user_id?: string
          user_name?: string | null
        }
        Relationships: []
      }
      order_rate_limit_events: {
        Row: {
          created_at: string
          id: string
          ip: string | null
          phone: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ip?: string | null
          phone?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ip?: string | null
          phone?: string | null
        }
        Relationships: []
      }
      order_status_logs: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["order_status"] | null
          id: string
          note: string | null
          order_id: string
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: string
          note?: string | null
          order_id: string
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: string
          note?: string | null
          order_id?: string
          to_status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "order_status_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          assigned_to: string | null
          client_ip: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          coupon_code: string | null
          courier_consignment: string | null
          courier_display_name: string | null
          courier_status: string | null
          created_at: string
          created_by: string | null
          customer_address: string | null
          customer_name: string
          customer_phone: string
          delivery_fee: number
          discount: number
          district: string | null
          id: string
          invoice_no: string | null
          notes: string | null
          originated_from_incomplete: boolean
          payment_method: string | null
          printed_at: string | null
          source: Database["public"]["Enums"]["order_source"]
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          thana: string | null
          total: number
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          client_ip?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          coupon_code?: string | null
          courier_consignment?: string | null
          courier_display_name?: string | null
          courier_status?: string | null
          created_at?: string
          created_by?: string | null
          customer_address?: string | null
          customer_name: string
          customer_phone: string
          delivery_fee?: number
          discount?: number
          district?: string | null
          id?: string
          invoice_no?: string | null
          notes?: string | null
          originated_from_incomplete?: boolean
          payment_method?: string | null
          printed_at?: string | null
          source?: Database["public"]["Enums"]["order_source"]
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          thana?: string | null
          total?: number
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          client_ip?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          coupon_code?: string | null
          courier_consignment?: string | null
          courier_display_name?: string | null
          courier_status?: string | null
          created_at?: string
          created_by?: string | null
          customer_address?: string | null
          customer_name?: string
          customer_phone?: string
          delivery_fee?: number
          discount?: number
          district?: string | null
          id?: string
          invoice_no?: string | null
          notes?: string | null
          originated_from_incomplete?: boolean
          payment_method?: string | null
          printed_at?: string | null
          source?: Database["public"]["Enums"]["order_source"]
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          thana?: string | null
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      phone_otp_codes: {
        Row: {
          code_hash: string
          consumed: boolean
          created_at: string
          expires_at: string
          id: string
          phone: string
        }
        Insert: {
          code_hash: string
          consumed?: boolean
          created_at?: string
          expires_at: string
          id?: string
          phone: string
        }
        Update: {
          code_hash?: string
          consumed?: boolean
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          category_id: string | null
          cost: number
          created_at: string
          description: string | null
          id: string
          images: string[]
          is_active: boolean
          is_featured: boolean
          is_popular: boolean
          name: string
          price: number
          sale_price: number | null
          short_description: string | null
          sku: string | null
          slug: string
          stock: number
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          cost?: number
          created_at?: string
          description?: string | null
          id?: string
          images?: string[]
          is_active?: boolean
          is_featured?: boolean
          is_popular?: boolean
          name: string
          price?: number
          sale_price?: number | null
          short_description?: string | null
          sku?: string | null
          slug: string
          stock?: number
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          cost?: number
          created_at?: string
          description?: string | null
          id?: string
          images?: string[]
          is_active?: boolean
          is_featured?: boolean
          is_popular?: boolean
          name?: string
          price?: number
          sale_price?: number | null
          short_description?: string | null
          sku?: string | null
          slug?: string
          stock?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          id: string
          settings: Json
          updated_at: string
        }
        Insert: {
          id?: string
          settings?: Json
          updated_at?: string
        }
        Update: {
          id?: string
          settings?: Json
          updated_at?: string
        }
        Relationships: []
      }
      site_visitors: {
        Row: {
          created_at: string
          id: string
          landing_page_id: string | null
          last_seen: string
          path: string
          product_id: string | null
        }
        Insert: {
          created_at?: string
          id: string
          landing_page_id?: string | null
          last_seen?: string
          path?: string
          product_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          landing_page_id?: string | null
          last_seen?: string
          path?: string
          product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_visitors_landing_page_id_fkey"
            columns: ["landing_page_id"]
            isOneToOne: false
            referencedRelation: "landing_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_visitors_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      site_visits: {
        Row: {
          created_at: string
          id: string
          path: string | null
          referrer: string | null
          session_id: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          path?: string | null
          referrer?: string | null
          session_id: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          path?: string | null
          referrer?: string | null
          session_id?: string
          user_agent?: string | null
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
      top_selling_products: {
        Row: {
          order_count: number | null
          product_id: string | null
          units_sold: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      archive_orders: {
        Args: { p_deleted_by?: string; p_ids: string[] }
        Returns: number
      }
      assign_order_round_robin: {
        Args: { p_order_id: string }
        Returns: string
      }
      block_customer: {
        Args: { p_ip: string; p_name?: string; p_phone: string }
        Returns: {
          blocked_at: string
          blocked_by: string | null
          customer_name: string | null
          id: string
          ip_address: string | null
          is_active: boolean
          phone: string | null
          unblocked_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "customer_blocks"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      cancel_orders: { Args: { p_ids: string[] }; Returns: number }
      check_and_touch_order_rate_limit: {
        Args: {
          p_ip: string
          p_ip_minutes?: number
          p_phone: string
          p_phone_minutes?: number
        }
        Returns: Json
      }
      dashboard_confirmed_order_count: {
        Args: { p_from: string; p_to: string }
        Returns: number
      }
      dashboard_egress_summary: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      dashboard_egress_summary_legacy: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      dispatch_meta_capi_event: { Args: { p_body: Json }; Returns: boolean }
      get_home_data_v1: { Args: never; Returns: Json }
      get_meta_capi_status: { Args: never; Returns: Json }
      get_meta_capi_token: { Args: never; Returns: Json }
      get_public_order_confirmation: { Args: { p_id: string }; Returns: Json }
      has_permission: {
        Args: { _module: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      heartbeat_site_visitor: {
        Args: {
          p_id: string
          p_landing_page_id?: string
          p_path: string
          p_product_id?: string
        }
        Returns: undefined
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_admin_staff: { Args: never; Returns: boolean }
      is_blocked_visitor: {
        Args: { p_ip?: string; p_phone?: string }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      list_customer_blocks: {
        Args: never
        Returns: {
          blocked_at: string
          blocked_by: string
          customer_name: string
          id: string
          ip_address: string
          is_active: boolean
          phone: string
          unblocked_at: string
        }[]
      }
      normalize_bd_phone: { Args: { p_phone: string }; Returns: string }
      permanently_delete_archived_order: {
        Args: { p_id: string }
        Returns: boolean
      }
      permanently_delete_archived_orders: {
        Args: { p_ids: string[] }
        Returns: number
      }
      place_public_order: {
        Args: {
          p_client_ip?: string
          p_customer_address: string
          p_customer_name: string
          p_customer_phone: string
          p_delivery_fee: number
          p_items: Json
          p_notes?: string
        }
        Returns: string
      }
      purge_visitor_telemetry: { Args: never; Returns: undefined }
      record_endpoint_egress: { Args: { p_rows: Json }; Returns: undefined }
      record_web_order_confirmation: {
        Args: { p_confirmed_by: string; p_order_id: string }
        Returns: undefined
      }
      refresh_top_selling_products: { Args: never; Returns: undefined }
      release_fb_lock: { Args: { _key: string }; Returns: undefined }
      reserve_courier_edge_slot: {
        Args: { p_gap_ms?: number }
        Returns: number
      }
      reserve_courier_provider_slot: {
        Args: { p_gap_ms?: number }
        Returns: number
      }
      restore_deleted_order: {
        Args: {
          p_id: string
          p_status: Database["public"]["Enums"]["order_status"]
        }
        Returns: boolean
      }
      restore_deleted_orders: {
        Args: {
          p_ids: string[]
          p_status: Database["public"]["Enums"]["order_status"]
        }
        Returns: number
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      try_fb_lock: {
        Args: { _key: string; _seconds: number }
        Returns: boolean
      }
      unblock_customer: { Args: { p_id: string }; Returns: undefined }
      upsert_incomplete_checkout: {
        Args: {
          p_customer_address: string
          p_customer_name: string
          p_delivery_fee: number
          p_delivery_zone: string
          p_ip: string
          p_items: Json
          p_note: string
          p_phone: string
          p_subtotal: number
          p_total: number
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "employee" | "customer"
      order_source: "web" | "manual" | "messenger" | "incomplete"
      order_status:
        | "web_pending"
        | "pending"
        | "rts"
        | "shipped"
        | "delivered"
        | "pending_return"
        | "returned"
        | "partial"
        | "cancelled"
        | "hold"
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
      app_role: ["super_admin", "admin", "employee", "customer"],
      order_source: ["web", "manual", "messenger", "incomplete"],
      order_status: [
        "web_pending",
        "pending",
        "rts",
        "shipped",
        "delivered",
        "pending_return",
        "returned",
        "partial",
        "cancelled",
        "hold",
      ],
    },
  },
} as const
