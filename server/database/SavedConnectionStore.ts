import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { DatabaseConnectionParams } from './DatabaseAdapter';
import { Logger } from '../utils/logger';

export interface EncryptedPayload {
  iv: string;
  authTag: string;
  ciphertext: string;
}

export interface SavedConnectionRecord {
  id: string;
  name: string;
  type: 'postgresql' | 'mysql' | 'sqlserver' | 'sqlite' | 'oracle';
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  defaultSchema?: string;
  ssl?: boolean;
  filePath?: string;
  encryptedPassword?: EncryptedPayload;
  createdAt: string;
  updatedAt: string;
  lastConnectedAt?: string;
}

export interface SavedDatabaseConnection {
  id: string;
  name: string;
  type: 'postgresql' | 'mysql' | 'sqlserver' | 'sqlite' | 'oracle';
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  defaultSchema?: string;
  ssl?: boolean;
  filePath?: string;
  hasPassword?: boolean;
  createdAt: string;
  updatedAt: string;
  lastConnectedAt?: string;
}

export interface SaveConnectionInput {
  name: string;
  type: 'postgresql' | 'mysql' | 'sqlserver' | 'sqlite' | 'oracle';
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  defaultSchema?: string;
  ssl?: boolean;
  filePath?: string;
}

export interface UpdateSavedConnectionInput {
  name?: string;
  type?: 'postgresql' | 'mysql' | 'sqlserver' | 'sqlite' | 'oracle';
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  defaultSchema?: string;
  ssl?: boolean;
  filePath?: string;
}

export class SavedConnectionStore {
  private static instance: SavedConnectionStore;
  private storagePath: string;
  private connections: Map<string, SavedConnectionRecord> = new Map();
  private encryptionKey: Buffer;

  private constructor() {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
      } catch {
        // ignore
      }
    }
    this.storagePath = path.join(dataDir, 'saved_connections.json');

    // 256-bit encryption key derived securely
    const secretSeed = process.env.DATAPILOT_ENCRYPTION_SECRET || 'datapilot_secure_master_credential_key_v1';
    this.encryptionKey = crypto.createHash('sha256').update(secretSeed).digest();

    this.loadFromFile();
  }

  public static getInstance(): SavedConnectionStore {
    if (!SavedConnectionStore.instance) {
      SavedConnectionStore.instance = new SavedConnectionStore();
    }
    return SavedConnectionStore.instance;
  }

  private encrypt(plaintext: string): EncryptedPayload {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return {
      iv: iv.toString('hex'),
      authTag,
      ciphertext
    };
  }

  private decrypt(payload: EncryptedPayload): string {
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, Buffer.from(payload.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(payload.authTag, 'hex'));
    let decrypted = decipher.update(payload.ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  private loadFromFile(): void {
    try {
      if (fs.existsSync(this.storagePath)) {
        const raw = fs.readFileSync(this.storagePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.connections.clear();
          for (const item of parsed) {
            if (item && item.id) {
              this.connections.set(item.id, item);
            }
          }
        }
      }
    } catch (err: any) {
      Logger.error('Failed to load saved connections from file', err);
    }
  }

  private saveToFile(): void {
    try {
      const records = Array.from(this.connections.values());
      fs.writeFileSync(this.storagePath, JSON.stringify(records, null, 2), 'utf8');
    } catch (err: any) {
      Logger.error('Failed to save connections to file', err);
    }
  }

  private sanitize(record: SavedConnectionRecord): SavedDatabaseConnection {
    return {
      id: record.id,
      name: record.name,
      type: record.type,
      host: record.host,
      port: record.port,
      database: record.database,
      username: record.username,
      defaultSchema: record.defaultSchema,
      ssl: record.ssl,
      filePath: record.filePath,
      hasPassword: Boolean(record.encryptedPassword && record.encryptedPassword.ciphertext),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      lastConnectedAt: record.lastConnectedAt
    };
  }

  public getAll(): SavedDatabaseConnection[] {
    return Array.from(this.connections.values())
      .map(r => this.sanitize(r))
      .sort((a, b) => (b.lastConnectedAt || b.updatedAt).localeCompare(a.lastConnectedAt || a.updatedAt));
  }

  public getById(id: string): SavedDatabaseConnection | null {
    const record = this.connections.get(id);
    return record ? this.sanitize(record) : null;
  }

  public getDecryptedConnectionParams(id: string): DatabaseConnectionParams | null {
    const record = this.connections.get(id);
    if (!record) return null;

    let password = '';
    if (record.encryptedPassword && record.encryptedPassword.ciphertext) {
      try {
        password = this.decrypt(record.encryptedPassword);
      } catch (err) {
        Logger.error('Failed to decrypt saved connection password', err);
      }
    }

    return {
      type: record.type,
      host: record.host,
      port: record.port,
      database: record.database,
      username: record.username,
      password,
      ssl: record.ssl,
      filePath: record.filePath
    };
  }

  public save(input: SaveConnectionInput): SavedDatabaseConnection {
    const id = `conn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const cleanName = (input.name || '').trim() || `${input.database || 'Database'} (${input.type})`;
    let encryptedPassword: EncryptedPayload | undefined;
    if (input.password !== undefined && input.password !== null && String(input.password).length > 0) {
      encryptedPassword = this.encrypt(String(input.password));
    }

    const record: SavedConnectionRecord = {
      id,
      name: cleanName,
      type: input.type,
      host: input.host ? input.host.trim() : undefined,
      port: input.port ? Number(input.port) : undefined,
      database: input.database ? input.database.trim() : undefined,
      username: input.username ? input.username.trim() : undefined,
      defaultSchema: input.defaultSchema ? input.defaultSchema.trim() : undefined,
      ssl: Boolean(input.ssl),
      filePath: input.filePath ? input.filePath.trim() : undefined,
      encryptedPassword,
      createdAt: now,
      updatedAt: now
    };

    this.connections.set(id, record);
    this.saveToFile();
    return this.sanitize(record);
  }

  public update(id: string, input: UpdateSavedConnectionInput): SavedDatabaseConnection | null {
    const existing = this.connections.get(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    if (input.name !== undefined && input.name.trim()) existing.name = input.name.trim();
    if (input.type !== undefined) existing.type = input.type;
    if (input.host !== undefined) existing.host = input.host.trim();
    if (input.port !== undefined) existing.port = Number(input.port);
    if (input.database !== undefined) existing.database = input.database.trim();
    if (input.username !== undefined) existing.username = input.username.trim();
    if (input.defaultSchema !== undefined) existing.defaultSchema = input.defaultSchema.trim();
    if (input.ssl !== undefined) existing.ssl = Boolean(input.ssl);
    if (input.filePath !== undefined) existing.filePath = input.filePath.trim();

    // If password provided in update, re-encrypt it. If empty string is passed, do not overwrite unless explicitly specified
    if (input.password !== undefined && input.password !== null && String(input.password).length > 0) {
      existing.encryptedPassword = this.encrypt(String(input.password));
    }

    existing.updatedAt = now;
    this.connections.set(id, existing);
    this.saveToFile();
    return this.sanitize(existing);
  }

  public delete(id: string): boolean {
    const existed = this.connections.delete(id);
    if (existed) {
      this.saveToFile();
    }
    return existed;
  }

  public recordConnectionSuccess(id: string): void {
    const existing = this.connections.get(id);
    if (existing) {
      existing.lastConnectedAt = new Date().toISOString();
      this.connections.set(id, existing);
      this.saveToFile();
    }
  }

  /**
   * Reset store (used for test isolation)
   */
  public clear(): void {
    this.connections.clear();
    try {
      if (fs.existsSync(this.storagePath)) {
        fs.unlinkSync(this.storagePath);
      }
    } catch {
      // ignore
    }
  }
}
