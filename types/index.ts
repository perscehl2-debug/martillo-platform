export type AuctionType = 'auto' | 'vivienda'
export type AuctionStatus = 'draft' | 'scheduled' | 'live' | 'ended' | 'sold' | 'cancelled'
export type UserRole = 'admin' | 'user'

export interface Profile {
  id: string
  email: string
  role: UserRole
  full_name?: string
  created_at: string
}

export interface Auction {
  id: string
  type: AuctionType
  title: string
  description: string
  base_price: number
  current_price: number
  image_urls: string[]
  status: AuctionStatus
  ends_at: string
  created_by: string
  created_at: string
  bid_count?: number
}

export interface Bid {
  id: string
  auction_id: string
  user_id: string
  amount: number
  created_at: string
  profiles?: Pick<Profile, 'email' | 'full_name'>
}
