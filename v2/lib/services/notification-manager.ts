export type NotificationType =
  | 'comment'
  | 'reply'
  | 'like'
  | 'marketplace'
  | 'agent'
  | 'workflow'
  | 'system'
  | 'moderation'

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  title: string
  body: string | null
  link: string | null
  isRead: boolean
  createdAt: string
}

export interface NotificationManager {
  list(userId: string, unreadOnly?: boolean): Promise<Notification[]>
  markRead(id: string): Promise<void>
  markAllRead(userId: string): Promise<void>
  create(n: Omit<Notification, 'id' | 'createdAt' | 'isRead'>): Promise<Notification>
  delete(id: string): Promise<void>
}

export const notificationManager: NotificationManager = {
  async list() { throw new Error('NotificationManager not implemented (V2 foundation).') },
  async markRead() { throw new Error('NotificationManager not implemented (V2 foundation).') },
  async markAllRead() { throw new Error('NotificationManager not implemented (V2 foundation).') },
  async create() { throw new Error('NotificationManager not implemented (V2 foundation).') },
  async delete() { throw new Error('NotificationManager not implemented (V2 foundation).') }
}