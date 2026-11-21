export type FavoriteTargetType = 'prompt' | 'project' | 'marketplace_item' | 'agent' | 'workflow'

export interface Favorite {
  id: string
  userId: string
  targetType: FavoriteTargetType
  targetId: string
  createdAt: string
}

export interface FavoritesManager {
  list(userId: string): Promise<Favorite[]>
  add(userId: string, targetType: FavoriteTargetType, targetId: string): Promise<Favorite>
  remove(userId: string, targetType: FavoriteTargetType, targetId: string): Promise<void>
  isFavorite(userId: string, targetType: FavoriteTargetType, targetId: string): Promise<boolean>
}

export const favoritesManager: FavoritesManager = {
  async list() { throw new Error('FavoritesManager not implemented (V2 foundation).') },
  async add() { throw new Error('FavoritesManager not implemented (V2 foundation).') },
  async remove() { throw new Error('FavoritesManager not implemented (V2 foundation).') },
  async isFavorite() { throw new Error('FavoritesManager not implemented (V2 foundation).') }
}