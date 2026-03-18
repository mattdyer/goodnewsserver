import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface AttachmentMeta {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
  path: string;
  url: string;
  owner?: string;
  createdAt: string;
}

export interface PaperclipConfig {
  uploadDir: string;
  maxFileSize: number;
  allowedMimeTypes: string[];
}

const DEFAULT_CONFIG: PaperclipConfig = {
  uploadDir: path.resolve(process.cwd(), 'uploads'),
  maxFileSize: 10 * 1024 * 1024,
  allowedMimeTypes: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
    'application/json',
  ],
};

export class PaperclipServer {
  private config: PaperclipConfig;
  private metaPath: string;

  constructor(config: Partial<PaperclipConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.metaPath = path.join(this.config.uploadDir, 'attachments.json');
  }

  async ensure(): Promise<void> {
    await fs.promises.mkdir(this.config.uploadDir, { recursive: true });
    try {
      await fs.promises.access(this.metaPath);
    } catch {
      await fs.promises.writeFile(this.metaPath, JSON.stringify([], null, 2));
    }
  }

  private validateFile(file: Express.Multer.File): { valid: boolean; error?: string } {
    if (file.size > this.config.maxFileSize) {
      return {
        valid: false,
        error: `File size exceeds maximum of ${this.config.maxFileSize / (1024 * 1024)}MB`,
      };
    }

    if (!this.config.allowedMimeTypes.includes(file.mimetype)) {
      return {
        valid: false,
        error: `File type ${file.mimetype} is not allowed`,
      };
    }

    return { valid: true };
  }

  private generateId(): string {
    return uuidv4();
  }

  async saveFile(file: Express.Multer.File, owner = ''): Promise<AttachmentMeta> {
    await this.ensure();

    const validation = this.validateFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const id = this.generateId();
    const ext = path.extname(file.originalname);
    const destName = `${Date.now()}_${id}${ext}`;
    const destPath = path.join(this.config.uploadDir, destName);

    await fs.promises.writeFile(destPath, file.buffer);

    const meta: AttachmentMeta = {
      id,
      filename: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
      path: `/uploads/${destName}`,
      url: `/uploads/${destName}`,
      owner,
      createdAt: new Date().toISOString(),
    };

    await this.appendMeta(meta);
    return meta;
  }

  async appendMeta(meta: AttachmentMeta): Promise<void> {
    const arr = await this.readMeta();
    arr.push(meta);
    await fs.promises.writeFile(this.metaPath, JSON.stringify(arr, null, 2));
  }

  async readMeta(): Promise<AttachmentMeta[]> {
    try {
      const raw = await fs.promises.readFile(this.metaPath, 'utf-8');
      return JSON.parse(raw) as AttachmentMeta[];
    } catch {
      return [];
    }
  }

  async list(owner = ''): Promise<AttachmentMeta[]> {
    const meta = await this.readMeta();
    if (!owner) return meta;
    return meta.filter((m) => m.owner === owner);
  }

  async delete(id: string): Promise<boolean> {
    const arr = await this.readMeta();
    const index = arr.findIndex((m) => m.id === id);
    if (index === -1) return false;

    const meta = arr[index];
    const filePath = path.join(this.config.uploadDir, path.basename(meta.path));

    try {
      await fs.promises.unlink(filePath);
    } catch {
      console.warn(`File not found for deletion: ${filePath}`);
    }

    arr.splice(index, 1);
    await fs.promises.writeFile(this.metaPath, JSON.stringify(arr, null, 2));
    return true;
  }

  async get(id: string): Promise<AttachmentMeta | undefined> {
    const arr = await this.readMeta();
    return arr.find((m) => m.id === id);
  }
}
