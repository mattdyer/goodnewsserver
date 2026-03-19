import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const DATA_DIR = path.resolve(process.cwd(), 'data');

export interface User {
  id: string;
  email: string;
  password: string;
  name: string;
  createdAt: string;
}

export interface UserPreferences {
  userId: string;
  sources: string[];
  categories: string[];
  filterPositive: boolean;
}

export interface Bookmark {
  id: string;
  userId: string;
  articleId: string;
  title: string;
  link: string;
  source: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  userId: string;
  articleId: string;
  content: string;
  createdAt: string;
}

async function ensureDir(): Promise<void> {
  await fs.promises.mkdir(DATA_DIR, { recursive: true });
}

async function readJsonFile<T>(filename: string, defaultValue: T): Promise<T> {
  const filePath = path.join(DATA_DIR, filename);
  try {
    const data = await fs.promises.readFile(filePath, 'utf-8');
    return JSON.parse(data) as T;
  } catch {
    return defaultValue;
  }
}

async function writeJsonFile<T>(filename: string, data: T): Promise<void> {
  const filePath = path.join(DATA_DIR, filename);
  await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2));
}

export const store = {
  async initialize(): Promise<void> {
    await ensureDir();
  },

  async createUser(email: string, password: string, name: string): Promise<User> {
    const users = await readJsonFile<User[]>('users.json', []);
    
    if (users.find(u => u.email === email)) {
      throw new Error('User already exists');
    }
    
    const user: User = {
      id: uuidv4(),
      email,
      password,
      name,
      createdAt: new Date().toISOString(),
    };
    
    users.push(user);
    await writeJsonFile('users.json', users);
    
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
  },

  async findUserByEmail(email: string): Promise<User | null> {
    const users = await readJsonFile<User[]>('users.json', []);
    return users.find(u => u.email === email) || null;
  },

  async findUserById(id: string): Promise<User | null> {
    const users = await readJsonFile<User[]>('users.json', []);
    return users.find(u => u.id === id) || null;
  },

  async getPreferences(userId: string): Promise<UserPreferences> {
    const prefs = await readJsonFile<UserPreferences[]>('preferences.json', []);
    const existing = prefs.find(p => p.userId === userId);
    
    if (existing) return existing;
    
    const defaultPrefs: UserPreferences = {
      userId,
      sources: [],
      categories: [],
      filterPositive: false,
    };
    
    prefs.push(defaultPrefs);
    await writeJsonFile('preferences.json', prefs);
    
    return defaultPrefs;
  },

  async updatePreferences(userId: string, updates: Partial<UserPreferences>): Promise<UserPreferences> {
    const prefs = await readJsonFile<UserPreferences[]>('preferences.json', []);
    const index = prefs.findIndex(p => p.userId === userId);
    
    const updated: UserPreferences = {
      ...(index >= 0 ? prefs[index] : { userId, sources: [], categories: [], filterPositive: false }),
      ...updates,
    };
    
    if (index >= 0) {
      prefs[index] = updated;
    } else {
      prefs.push(updated);
    }
    
    await writeJsonFile('preferences.json', prefs);
    return updated;
  },

  async createBookmark(userId: string, articleId: string, title: string, link: string, source: string): Promise<Bookmark> {
    const bookmarks = await readJsonFile<Bookmark[]>('bookmarks.json', []);
    
    const bookmark: Bookmark = {
      id: uuidv4(),
      userId,
      articleId,
      title,
      link,
      source,
      createdAt: new Date().toISOString(),
    };
    
    bookmarks.push(bookmark);
    await writeJsonFile('bookmarks.json', bookmarks);
    
    return bookmark;
  },

  async getBookmarks(userId: string): Promise<Bookmark[]> {
    const bookmarks = await readJsonFile<Bookmark[]>('bookmarks.json', []);
    return bookmarks.filter(b => b.userId === userId);
  },

  async deleteBookmark(userId: string, bookmarkId: string): Promise<boolean> {
    const bookmarks = await readJsonFile<Bookmark[]>('bookmarks.json', []);
    const index = bookmarks.findIndex(b => b.id === bookmarkId && b.userId === userId);
    
    if (index === -1) return false;
    
    bookmarks.splice(index, 1);
    await writeJsonFile('bookmarks.json', bookmarks);
    
    return true;
  },

  async createComment(userId: string, articleId: string, content: string): Promise<Comment> {
    const comments = await readJsonFile<Comment[]>('comments.json', []);
    
    const comment: Comment = {
      id: uuidv4(),
      userId,
      articleId,
      content,
      createdAt: new Date().toISOString(),
    };
    
    comments.push(comment);
    await writeJsonFile('comments.json', comments);
    
    return comment;
  },

  async getComments(articleId?: string): Promise<Comment[]> {
    const comments = await readJsonFile<Comment[]>('comments.json', []);
    if (articleId) {
      return comments.filter(c => c.articleId === articleId);
    }
    return comments;
  },

  async deleteComment(userId: string, commentId: string): Promise<boolean> {
    const comments = await readJsonFile<Comment[]>('comments.json', []);
    const index = comments.findIndex(c => c.id === commentId && c.userId === userId);
    
    if (index === -1) return false;
    
    comments.splice(index, 1);
    await writeJsonFile('comments.json', comments);
    
    return true;
  },
};