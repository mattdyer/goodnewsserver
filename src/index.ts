import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { PaperclipServer } from './paperclip';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

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

app.listen(port, () => {
  console.log(`Paperclip server running on port ${port}`);
});
