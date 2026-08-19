export interface StoredObject {
  key: string;
  size: number;
  etag?: string;
}

export interface BackupStorageProvider {
  readonly name: string;
  put(key: string, body: Buffer, contentType?: string): Promise<StoredObject>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<StoredObject[]>;
}
