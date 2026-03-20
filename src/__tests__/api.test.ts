import request from 'supertest';
import express from 'express';
import cors from 'cors';

jest.mock('../feeds', () => ({
  fetchAllFeeds: jest.fn(),
  getArticleById: jest.fn(),
  RSS_SOURCES: ['BBC Technology', 'NPR News']
}));

jest.mock('../auth', () => ({
  register: jest.fn(),
  login: jest.fn(),
  logout: jest.fn(),
  validateSession: jest.fn()
}));

jest.mock('../store', () => ({
  store: {
    initialize: jest.fn(),
    findUserById: jest.fn(),
    getPreferences: jest.fn(),
    updatePreferences: jest.fn(),
    getBookmarks: jest.fn(),
    createBookmark: jest.fn(),
    deleteBookmark: jest.fn(),
    getComments: jest.fn(),
    createComment: jest.fn(),
    deleteComment: jest.fn()
  }
}));

import { fetchAllFeeds, getArticleById, RSS_SOURCES } from '../feeds';
import * as auth from '../auth';
import { store } from '../store';

const mockFeeds = fetchAllFeeds as jest.Mock;
const mockGetArticleById = getArticleById as jest.Mock;
const mockAuth = auth as jest.Mocked<typeof auth>;
const mockStore = store as jest.Mocked<typeof store>;

function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/api/version', (req, res) => {
    return res.json({ version: '1.0.0' });
  });

  function getAuthToken(req: express.Request): string | null {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }
    return null;
  }

  function optionalAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
    const token = getAuthToken(req);
    if (token) {
      const session = auth.validateSession(token);
      if (session) {
        (req as any).userId = session.userId;
      }
    }
    next();
  }

  function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
    const token = getAuthToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const session = auth.validateSession(token);
    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    (req as any).userId = session.userId;
    next();
  }

  app.get('/api/feeds', optionalAuth, async (req, res) => {
    try {
      const filter = req.query.filter as 'positive' | undefined;
      const articles = await fetchAllFeeds(filter);
      return res.json(articles);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return res.status(500).json({ error: message });
    }
  });

  app.get('/api/feeds/sources', (req, res) => {
    return res.json(RSS_SOURCES);
  });

  app.get('/api/feeds/:id', optionalAuth, async (req, res) => {
    try {
      const article = await getArticleById(req.params.id as string);
      if (!article) {
        return res.status(404).json({ error: 'Not found' });
      }
      return res.json(article);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return res.status(500).json({ error: message });
    }
  });

  app.post('/api/auth/register', async (req, res) => {
    try {
      const { email, password, name } = req.body;
      if (!email || !password || !name) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      const user = await auth.register(email, password, name);
      return res.status(201).json(user);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.includes('already exists')) {
        return res.status(409).json({ error: message });
      }
      return res.status(500).json({ error: message });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Missing email or password' });
      }
      const result = await auth.login(email, password);
      if (!result) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      return res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return res.status(500).json({ error: message });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    const token = getAuthToken(req);
    if (token) {
      auth.logout(token);
    }
    return res.status(204).send();
  });

  app.get('/api/users/me', requireAuth, async (req, res) => {
    try {
      const user = await mockStore.findUserById((req as any).userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      const { password, ...userWithoutPassword } = user;
      return res.json(userWithoutPassword);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return res.status(500).json({ error: message });
    }
  });

  app.get('/api/users/preferences', requireAuth, async (req, res) => {
    try {
      const prefs = await mockStore.getPreferences((req as any).userId);
      return res.json(prefs);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return res.status(500).json({ error: message });
    }
  });

  app.put('/api/users/preferences', requireAuth, async (req, res) => {
    try {
      const updates = req.body;
      const prefs = await mockStore.updatePreferences((req as any).userId, updates);
      return res.json(prefs);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return res.status(500).json({ error: message });
    }
  });

  app.get('/api/bookmarks', requireAuth, async (req, res) => {
    try {
      const bookmarks = await mockStore.getBookmarks((req as any).userId);
      return res.json(bookmarks);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return res.status(500).json({ error: message });
    }
  });

  app.post('/api/bookmarks', requireAuth, async (req, res) => {
    try {
      const { articleId, title, link, source } = req.body;
      if (!articleId || !title || !link) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      const bookmark = await mockStore.createBookmark(
        (req as any).userId,
        articleId,
        title,
        link,
        source || ''
      );
      return res.status(201).json(bookmark);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return res.status(500).json({ error: message });
    }
  });

  app.delete('/api/bookmarks/:id', requireAuth, async (req, res) => {
    try {
      const deleted = await mockStore.deleteBookmark((req as any).userId, req.params.id as string);
      if (!deleted) {
        return res.status(404).json({ error: 'Not found' });
      }
      return res.status(204).send();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return res.status(500).json({ error: message });
    }
  });

  app.get('/api/comments', optionalAuth, async (req, res) => {
    try {
      const articleId = req.query.articleId as string | undefined;
      const comments = await mockStore.getComments(articleId);
      return res.json(comments);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return res.status(500).json({ error: message });
    }
  });

  app.post('/api/comments', requireAuth, async (req, res) => {
    try {
      const { articleId, content } = req.body;
      if (!articleId || !content) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      const comment = await mockStore.createComment((req as any).userId, articleId, content);
      return res.status(201).json(comment);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return res.status(500).json({ error: message });
    }
  });

  app.delete('/api/comments/:id', requireAuth, async (req, res) => {
    try {
      const deleted = await mockStore.deleteComment((req as any).userId, req.params.id as string);
      if (!deleted) {
        return res.status(404).json({ error: 'Not found' });
      }
      return res.status(204).send();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return res.status(500).json({ error: message });
    }
  });

  return app;
}

describe('API Endpoints', () => {
  let app: express.Application;

  beforeEach(() => {
    app = createApp();
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  describe('GET /api/version', () => {
    it('returns the API version', async () => {
      const res = await request(app).get('/api/version');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('version');
      expect(res.body.version).toBe('1.0.0');
    });
  });

  describe('GET /api/feeds', () => {
    it('returns feeds without auth', async () => {
      mockFeeds.mockResolvedValue([
        { id: 'art-1', title: 'Test Article', link: 'http://example.com', pubDate: '2024-01-01', description: 'Test', source: 'TestSource', category: 'Technology' }
      ]);

      const res = await request(app).get('/api/feeds');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });

    it('returns filtered feeds with filter query', async () => {
      mockFeeds.mockResolvedValue([]);

      const res = await request(app).get('/api/feeds?filter=positive');
      expect(res.status).toBe(200);
      expect(mockFeeds).toHaveBeenCalledWith('positive');
    });

    it('handles errors gracefully', async () => {
      mockFeeds.mockRejectedValue(new Error('Feed error'));

      const res = await request(app).get('/api/feeds');
      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('GET /api/feeds/sources', () => {
    it('returns RSS sources', async () => {
      const res = await request(app).get('/api/feeds/sources');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toContain('BBC Technology');
    });
  });

  describe('GET /api/feeds/:id', () => {
    it('returns article by id', async () => {
      mockGetArticleById.mockResolvedValue({
        id: 'article-123',
        title: 'Test Article',
        link: 'http://example.com',
        pubDate: '2024-01-01',
        description: 'Test',
        source: 'TestSource',
        category: 'Technology'
      });

      const res = await request(app).get('/api/feeds/article-123');
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Test Article');
    });

    it('returns 404 for non-existent article', async () => {
      mockGetArticleById.mockResolvedValue(undefined);

      const res = await request(app).get('/api/feeds/non-existent');
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/auth/register', () => {
    it('registers a new user', async () => {
      mockAuth.register.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        createdAt: '2024-01-01'
      });

      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com', password: 'password123', name: 'Test User' });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
    });

    it('returns 400 for missing fields', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com' });
      expect(res.status).toBe(400);
    });

    it('returns 409 for duplicate email', async () => {
      mockAuth.register.mockRejectedValue(new Error('User already exists'));

      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com', password: 'password123', name: 'Test User' });
      expect(res.status).toBe(409);
    });
  });

  describe('POST /api/auth/login', () => {
    it('logs in a user', async () => {
      mockAuth.login.mockResolvedValue({
        user: { id: 'user-123', email: 'test@example.com', name: 'Test', createdAt: '2024-01-01' },
        token: 'test-token'
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
    });

    it('returns 400 for missing credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com' });
      expect(res.status).toBe(400);
    });

    it('returns 401 for invalid credentials', async () => {
      mockAuth.login.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'wrong' });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('logs out user with token', async () => {
      mockAuth.logout.mockReturnValue();

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer test-token');
      expect(res.status).toBe(204);
      expect(mockAuth.logout).toHaveBeenCalledWith('test-token');
    });

    it('returns 204 even without token', async () => {
      const res = await request(app).post('/api/auth/logout');
      expect(res.status).toBe(204);
    });
  });

  describe('GET /api/users/me', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/users/me');
      expect(res.status).toBe(401);
    });

    it('returns user data with valid auth', async () => {
      mockAuth.validateSession.mockReturnValue({ userId: 'user-123' });
      mockStore.findUserById.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        password: 'hashed',
        name: 'Test User',
        createdAt: '2024-01-01'
      });

      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', 'Bearer test-token');
      expect(res.status).toBe(200);
      expect(res.body).not.toHaveProperty('password');
      expect(res.body.email).toBe('test@example.com');
    });

    it('returns 404 for non-existent user', async () => {
      mockAuth.validateSession.mockReturnValue({ userId: 'user-123' });
      mockStore.findUserById.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', 'Bearer test-token');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/users/preferences', () => {
    it('returns user preferences', async () => {
      mockAuth.validateSession.mockReturnValue({ userId: 'user-123' });
      mockStore.getPreferences.mockResolvedValue({
        userId: 'user-123',
        sources: ['BBC'],
        categories: [],
        filterPositive: true
      });

      const res = await request(app)
        .get('/api/users/preferences')
        .set('Authorization', 'Bearer test-token');
      expect(res.status).toBe(200);
      expect(res.body.filterPositive).toBe(true);
    });
  });

  describe('PUT /api/users/preferences', () => {
    it('updates user preferences', async () => {
      mockAuth.validateSession.mockReturnValue({ userId: 'user-123' });
      mockStore.updatePreferences.mockResolvedValue({
        userId: 'user-123',
        sources: ['CNN'],
        categories: ['tech'],
        filterPositive: true
      });

      const res = await request(app)
        .put('/api/users/preferences')
        .set('Authorization', 'Bearer test-token')
        .send({ filterPositive: true, sources: ['CNN'] });
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/bookmarks', () => {
    it('returns user bookmarks', async () => {
      mockAuth.validateSession.mockReturnValue({ userId: 'user-123' });
      mockStore.getBookmarks.mockResolvedValue([
        { id: 'book-1', userId: 'user-123', articleId: 'art-1', title: 'Test', link: 'http://test.com', source: 'Test', createdAt: '2024-01-01' }
      ]);

      const res = await request(app)
        .get('/api/bookmarks')
        .set('Authorization', 'Bearer test-token');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/bookmarks');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/bookmarks', () => {
    it('creates a bookmark', async () => {
      mockAuth.validateSession.mockReturnValue({ userId: 'user-123' });
      mockStore.createBookmark.mockResolvedValue({
        id: 'book-1',
        userId: 'user-123',
        articleId: 'art-1',
        title: 'Test Article',
        link: 'http://test.com',
        source: 'Test',
        createdAt: '2024-01-01'
      });

      const res = await request(app)
        .post('/api/bookmarks')
        .set('Authorization', 'Bearer test-token')
        .send({ articleId: 'art-1', title: 'Test Article', link: 'http://test.com', source: 'Test' });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
    });

    it('returns 400 for missing fields', async () => {
      mockAuth.validateSession.mockReturnValue({ userId: 'user-123' });

      const res = await request(app)
        .post('/api/bookmarks')
        .set('Authorization', 'Bearer test-token')
        .send({ articleId: 'art-1' });
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/bookmarks/:id', () => {
    it('deletes a bookmark', async () => {
      mockAuth.validateSession.mockReturnValue({ userId: 'user-123' });
      mockStore.deleteBookmark.mockResolvedValue(true);

      const res = await request(app)
        .delete('/api/bookmarks/book-1')
        .set('Authorization', 'Bearer test-token');
      expect(res.status).toBe(204);
    });

    it('returns 404 for non-existent bookmark', async () => {
      mockAuth.validateSession.mockReturnValue({ userId: 'user-123' });
      mockStore.deleteBookmark.mockResolvedValue(false);

      const res = await request(app)
        .delete('/api/bookmarks/non-existent')
        .set('Authorization', 'Bearer test-token');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/comments', () => {
    it('returns comments', async () => {
      mockStore.getComments.mockResolvedValue([
        { id: 'comment-1', userId: 'user-123', articleId: 'art-1', content: 'Great!', createdAt: '2024-01-01' }
      ]);

      const res = await request(app).get('/api/comments');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });

    it('filters comments by articleId', async () => {
      mockStore.getComments.mockResolvedValue([]);

      const res = await request(app).get('/api/comments?articleId=art-1');
      expect(res.status).toBe(200);
      expect(mockStore.getComments).toHaveBeenCalledWith('art-1');
    });
  });

  describe('POST /api/comments', () => {
    it('creates a comment', async () => {
      mockAuth.validateSession.mockReturnValue({ userId: 'user-123' });
      mockStore.createComment.mockResolvedValue({
        id: 'comment-1',
        userId: 'user-123',
        articleId: 'art-1',
        content: 'Great article!',
        createdAt: '2024-01-01'
      });

      const res = await request(app)
        .post('/api/comments')
        .set('Authorization', 'Bearer test-token')
        .send({ articleId: 'art-1', content: 'Great article!' });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
    });

    it('returns 400 for missing fields', async () => {
      mockAuth.validateSession.mockReturnValue({ userId: 'user-123' });

      const res = await request(app)
        .post('/api/comments')
        .set('Authorization', 'Bearer test-token')
        .send({ articleId: 'art-1' });
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/comments/:id', () => {
    it('deletes a comment', async () => {
      mockAuth.validateSession.mockReturnValue({ userId: 'user-123' });
      mockStore.deleteComment.mockResolvedValue(true);

      const res = await request(app)
        .delete('/api/comments/comment-1')
        .set('Authorization', 'Bearer test-token');
      expect(res.status).toBe(204);
    });

    it('returns 404 for non-existent comment', async () => {
      mockAuth.validateSession.mockReturnValue({ userId: 'user-123' });
      mockStore.deleteComment.mockResolvedValue(false);

      const res = await request(app)
        .delete('/api/comments/non-existent')
        .set('Authorization', 'Bearer test-token');
      expect(res.status).toBe(404);
    });
  });
});
