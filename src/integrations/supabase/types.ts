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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          check_in: string
          check_out: string | null
          created_at: string
          id: string
          note: string | null
          user_id: string
        }
        Insert: {
          check_in?: string
          check_out?: string | null
          created_at?: string
          id?: string
          note?: string | null
          user_id: string
        }
        Update: {
          check_in?: string
          check_out?: string | null
          created_at?: string
          id?: string
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
          slug: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string | null
          is_hidden_from_home?: boolean
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string | null
          is_hidden_from_home?: boolean
          name?: string
          slug?: string
        }
        Relationships: []
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
      employee_permissions: {
        Row: {
          all_api: boolean
          categories: boolean
          customers: boolean
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
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
          position: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          position?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          position?: string | null
          user_id?: string | null
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
          id: string
          phone: string
        }
        Insert: {
          created_at?: string
          event: string
          id?: string
          phone: string
        }
        Update: {
          created_at?: string
          event?: string
          id?: string
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
          coupon_code: string | null
          courier_consignment: string | null
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
          coupon_code?: string | null
          courier_consignment?: string | null
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
          coupon_code?: string | null
          courier_consignment?: string | null
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
          created_at: string
          description: string | null
          id: string
          images: string[]
          is_active: boolean
          is_featured: boolean
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
          created_at?: string
          description?: string | null
          id?: string
          images?: string[]
          is_active?: boolean
          is_featured?: boolean
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
          created_at?: string
          description?: string | null
          id?: string
          images?: string[]
          is_active?: boolean
          is_featured?: boolean
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
          total_sold: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
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
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      refresh_top_selling_products: { Args: never; Returns: undefined }
      release_fb_lock: { Args: { _key: string }; Returns: undefined }
      try_fb_lock: {
        Args: { _key: string; _seconds: number }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "employee" | "customer"
      order_source: "web" | "manual" | "messenger"
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
      app_role: ["super_admin", "admin", "employee", "customer"],
      order_source: ["web", "manual", "messenger"],
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
