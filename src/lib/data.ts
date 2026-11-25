export interface Comment {
  id: string;
  videoId?: string;
  userId?: string;
  user: string;
  avatar: string;
  text: string;
  likes?: number;
  parentId?: string | null;
  date: string;
}

export interface Video {
  id: string;
  title: string;
  description?: string;
  thumbnailUrl: string;
  videoUrl?: string;
  channelName: string;
  channelAvatar: string;
  userId?: string;
  views: string;
  viewCount?: number;
  uploadDate: string;
  duration: string;
  category?: string;
  isShort?: boolean;
  isLive?: boolean;
  likes: number;
  dislikes?: number;
  comments: Comment[];
}

export interface LiveChatMessage {
  id: string;
  videoId: string;
  user: string;
  avatar: string;
  text: string;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  link: string;
  isRead: boolean;
  createdAt: string;
}

export interface ChannelInfo {
  channelName: string;
  handle: string;
  avatar: string;
  subscribers: number;
  isSubscribed: boolean;
  totalViews: number;
  videoCount: number;
  joinedDate: string;
  bio: string;
}
