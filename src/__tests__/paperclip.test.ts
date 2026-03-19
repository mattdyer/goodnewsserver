import fs from 'fs';
import path from 'path';
import os from 'os';
import { PaperclipServer } from '../paperclip';

describe('PaperclipServer', () => {
  let tempDir: string;
  let server: PaperclipServer;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'paperclip-test-'));
    server = new PaperclipServer({ uploadDir: tempDir });
    await server.ensure();
  });

  afterEach(async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  describe('saveFile', () => {
    it('saves a file and returns metadata', async () => {
      const buffer = Buffer.from('test content');
      const mockFile = {
        originalname: 'test.txt',
        buffer,
        size: buffer.length,
        mimetype: 'text/plain',
      } as Express.Multer.File;

      const meta = await server.saveFile(mockFile);

      expect(meta.filename).toBe('test.txt');
      expect(meta.size).toBe(buffer.length);
      expect(meta.mimeType).toBe('text/plain');
      expect(meta.id).toBeDefined();
      expect(meta.path).toContain('/uploads/');
    });

    it('throws on file too large', async () => {
      const smallBuffer = Buffer.from('content');
      const mockFile = {
        originalname: 'large.txt',
        buffer: smallBuffer,
        size: smallBuffer.length,
        mimetype: 'text/plain',
      } as Express.Multer.File;

      const smallServer = new PaperclipServer({ uploadDir: tempDir, maxFileSize: 1 });

      await expect(smallServer.saveFile(mockFile)).rejects.toThrow('File size exceeds');
    });

    it('throws on disallowed mime type', async () => {
      const buffer = Buffer.from('content');
      const mockFile = {
        originalname: 'file.exe',
        buffer,
        size: buffer.length,
        mimetype: 'application/x-executable',
      } as Express.Multer.File;

      await expect(server.saveFile(mockFile)).rejects.toThrow('not allowed');
    });
  });

  describe('list', () => {
    it('returns empty array initially', async () => {
      const items = await server.list();
      expect(items).toEqual([]);
    });

    it('lists all files without owner filter', async () => {
      const buffer = Buffer.from('content');
      await server.saveFile({ originalname: 'a.txt', buffer, size: buffer.length, mimetype: 'text/plain' } as Express.Multer.File, 'user1');
      await server.saveFile({ originalname: 'b.txt', buffer, size: buffer.length, mimetype: 'text/plain' } as Express.Multer.File, 'user2');

      const items = await server.list();
      expect(items).toHaveLength(2);
    });

    it('filters by owner', async () => {
      const buffer = Buffer.from('content');
      await server.saveFile({ originalname: 'a.txt', buffer, size: buffer.length, mimetype: 'text/plain' } as Express.Multer.File, 'alice');
      await server.saveFile({ originalname: 'b.txt', buffer, size: buffer.length, mimetype: 'text/plain' } as Express.Multer.File, 'bob');

      const aliceItems = await server.list('alice');
      expect(aliceItems).toHaveLength(1);
      expect(aliceItems[0].filename).toBe('a.txt');
    });
  });

  describe('get', () => {
    it('returns undefined for non-existent id', async () => {
      const item = await server.get('non-existent');
      expect(item).toBeUndefined();
    });

    it('returns saved file metadata', async () => {
      const buffer = Buffer.from('content');
      const saved = await server.saveFile({ originalname: 'test.txt', buffer, size: buffer.length, mimetype: 'text/plain' } as Express.Multer.File);

      const item = await server.get(saved.id);
      expect(item).toBeDefined();
      expect(item!.filename).toBe('test.txt');
    });
  });

  describe('delete', () => {
    it('returns false for non-existent id', async () => {
      const deleted = await server.delete('non-existent');
      expect(deleted).toBe(false);
    });

    it('deletes file and metadata', async () => {
      const buffer = Buffer.from('content');
      const saved = await server.saveFile({ originalname: 'delete-me.txt', buffer, size: buffer.length, mimetype: 'text/plain' } as Express.Multer.File);

      const deleted = await server.delete(saved.id);
      expect(deleted).toBe(true);

      const item = await server.get(saved.id);
      expect(item).toBeUndefined();

      const allItems = await server.list();
      expect(allItems).toHaveLength(0);
    });
  });
});
