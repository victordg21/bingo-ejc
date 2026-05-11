// Hand-written DB types. Equivalent to `supabase gen types typescript`
// but no CLI dependency. Update if you change the schema.

export type Tier = "basico" | "live" | "premium";

export type GameState = {
  id: number;
  called_numbers: number[];
  last_called: number | null;
  is_active: boolean;
  updated_at: string;
};

export type Buyer = {
  id: string;
  name: string;
  access_code: string;
  card_codes: number[];
  tier: Tier;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      game_state: {
        Row: GameState;
        Insert: Partial<GameState> & Pick<GameState, "id">;
        Update: Partial<GameState>;
        Relationships: [];
      };
      buyers: {
        Row: Buyer;
        Insert: Omit<Buyer, "id" | "created_at"> & Partial<Pick<Buyer, "id" | "created_at">>;
        Update: Partial<Buyer>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      reset_game_state: { Args: Record<string, never>; Returns: void };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
