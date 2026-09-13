export type Player = {
  id: string;
  name: string;
  avatar: string | null;
  created_at: string;
};

export type Profile = {
  user_id: string;
  player_id: string;
  created_at: string;
};

export type Session = {
  id: string;
  date: string;
  location: string;
  small_blind: number;
  big_blind: number;
  buy_in: number;
  host_pin: string;
  host_token: string;
  created_by: string | null;
  status: 'active' | 'finished';
};

export type Seat = {
  id: string;
  session_id: string;
  player_id: string;
  cash_out: number | null;
  has_left: boolean;
  count_in_leaderboard: boolean;
  joined_at: string;
};

export type BuyIn = {
  id: string;
  session_id: string;
  player_id: string;
  amount: number;
  created_at: string;
};

export type PlayerNet = {
  playerId: string;
  name: string;
  totalBuyIn: number;
  cashOut: number | null;
  net: number | null;
  left: boolean;
  rebuyCount: number;
  countInLeaderboard: boolean;
};

export type Transfer = {
  from: string;
  to: string;
  amount: number;
};
