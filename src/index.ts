import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { PaperclipServer } from './paperclip';
import { fetchAllFeeds, getArticleById, RSS_SOURCES } from './feeds';
import * as auth from './auth';
import { store } from './store';

const app = express();
const port = process.env.PORT || 3001;

const API_VERSION = process.env.API_VERSION || '1.0.0';

app.use(cors());
app.use(express.json());

app.get('/api/version', (req, res) => {
  return res.json({ version: API_VERSION });
});

store.initialize();

const paperclip = new PaperclipServer();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

app.post('/api/paperclip/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Missing file' });
    }
    const owner = (req.body.owner as string) || '';
    const meta = await paperclip.saveFile(req.file, owner);
    return res.status(201).json(meta);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

app.get('/api/paperclip/list', async (req, res) => {
  try {
    const owner = (req.query.owner as string) || '';
    const items = await paperclip.list(owner);
    return res.json(items);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

app.get('/api/paperclip/:id', async (req, res) => {
  try {
    const item = await paperclip.get(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Not found' });
    }
    return res.json(item);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

app.delete('/api/paperclip/:id', async (req, res) => {
  try {
    const deleted = await paperclip.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Not found' });
    }
    return res.status(204).send();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

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
    const user = await store.findUserById((req as any).userId);
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
    const prefs = await store.getPreferences((req as any).userId);
    return res.json(prefs);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

app.put('/api/users/preferences', requireAuth, async (req, res) => {
  try {
    const updates = req.body;
    const prefs = await store.updatePreferences((req as any).userId, updates);
    return res.json(prefs);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

app.get('/api/bookmarks', requireAuth, async (req, res) => {
  try {
    const bookmarks = await store.getBookmarks((req as any).userId);
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
    const bookmark = await store.createBookmark(
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
    const deleted = await store.deleteBookmark((req as any).userId, req.params.id as string);
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
    const comments = await store.getComments(articleId);
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
    const comment = await store.createComment((req as any).userId, articleId, content);
    return res.status(201).json(comment);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

app.delete('/api/comments/:id', requireAuth, async (req, res) => {
  try {
    const deleted = await store.deleteComment((req as any).userId, req.params.id as string);
    if (!deleted) {
      return res.status(404).json({ error: 'Not found' });
    }
    return res.status(204).send();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

app.listen(port, () => {
  console.log(`GoodNews API server running on port ${port} (v${API_VERSION})`);
  console.log(`  - Version: GET /api/version`);
  console.log(`  - RSS feeds: GET /api/feeds`);
  console.log(`  - Auth: POST /api/auth/register, /api/auth/login`);
  console.log(`  - Users: GET /api/users/me, GET/PUT /api/users/preferences`);
  console.log(`  - Bookmarks: GET/POST/DELETE /api/bookmarks`);
  console.log(`  - Comments: GET/POST/DELETE /api/comments`);
});
