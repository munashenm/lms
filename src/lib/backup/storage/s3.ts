import crypto from "crypto";
import type { BackupStorageProvider, StoredObject } from "./types";

/**
 * S3-compatible object storage via AWS Signature Version 4.
 * Credentials are read from the environment and never sent to the client.
 */
export class S3BackupStorage implements BackupStorageProvider {
  readonly name = "s3";

  constructor(
    private readonly opts: {
      endpoint: string;
      region: string;
      bucket: string;
      accessKeyId: string;
      secretAccessKey: string;
      forcePathStyle?: boolean;
    }
  ) {}

  private objectUrl(key: string): URL {
    const endpoint = this.opts.endpoint.replace(/\/$/, "");
    if (this.opts.forcePathStyle !== false) {
      return new URL(`${endpoint}/${this.opts.bucket}/${encodeURI(key)}`);
    }
    const host = new URL(endpoint);
    return new URL(`${host.protocol}//${this.opts.bucket}.${host.host}/${encodeURI(key)}`);
  }

  async put(key: string, body: Buffer, contentType = "application/octet-stream"): Promise<StoredObject> {
    await this.request("PUT", key, body, contentType);
    return { key, size: body.length };
  }

  async get(key: string): Promise<Buffer> {
    const res = await this.request("GET", key);
    return Buffer.from(await res.arrayBuffer());
  }

  async delete(key: string): Promise<void> {
    await this.request("DELETE", key);
  }

  async list(prefix: string): Promise<StoredObject[]> {
    const url = this.objectUrl("");
    url.searchParams.set("list-type", "2");
    url.searchParams.set("prefix", prefix);
    const res = await this.request("GET", "", undefined, undefined, url);
    const xml = await res.text();
    const keys = [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) => m[1]);
    const sizes = [...xml.matchAll(/<Size>([^<]+)<\/Size>/g)].map((m) => Number(m[1]));
    return keys.map((key, i) => ({ key, size: sizes[i] ?? 0 }));
  }

  private async request(
    method: string,
    key: string,
    body?: Buffer,
    contentType?: string,
    overrideUrl?: URL
  ): Promise<Response> {
    const url = overrideUrl ?? this.objectUrl(key);
    const headers = this.sign(method, url, body, contentType);
    const res = await fetch(url, {
      method,
      headers,
      body: body ? new Uint8Array(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`S3 ${method} failed (${res.status}): ${text.slice(0, 200)}`);
    }
    return res;
  }

  private sign(method: string, url: URL, body?: Buffer, contentType?: string): Record<string, string> {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = crypto.createHash("sha256").update(body ?? Buffer.alloc(0)).digest("hex");
    const headers: Record<string, string> = {
      host: url.host,
      "x-amz-date": amzDate,
      "x-amz-content-sha256": payloadHash,
    };
    if (contentType) headers["content-type"] = contentType;
    const signedHeaderNames = Object.keys(headers).sort();
    const canonicalHeaders = signedHeaderNames.map((h) => `${h}:${headers[h]}\n`).join("");
    const signedHeaders = signedHeaderNames.join(";");
    const canonicalQuery = [...url.searchParams.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&");
    const canonical = [
      method,
      url.pathname,
      canonicalQuery,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join("\n");
    const credentialScope = `${dateStamp}/${this.opts.region}/s3/aws4_request`;
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      credentialScope,
      crypto.createHash("sha256").update(canonical).digest("hex"),
    ].join("\n");
    const kDate = hmac(`AWS4${this.opts.secretAccessKey}`, dateStamp);
    const kRegion = hmac(kDate, this.opts.region);
    const kService = hmac(kRegion, "s3");
    const kSigning = hmac(kService, "aws4_request");
    const signature = crypto.createHmac("sha256", kSigning).update(stringToSign).digest("hex");
    headers.authorization = `AWS4-HMAC-SHA256 Credential=${this.opts.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    return headers;
  }
}

function hmac(key: string | Buffer, data: string): Buffer {
  return crypto.createHmac("sha256", key).update(data).digest();
}

export function createS3StorageFromEnv(): S3BackupStorage {
  const endpoint = process.env.BACKUP_S3_ENDPOINT;
  const bucket = process.env.BACKUP_S3_BUCKET;
  const accessKeyId = process.env.BACKUP_S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.BACKUP_S3_SECRET_ACCESS_KEY;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("S3 backup storage is not fully configured");
  }
  return new S3BackupStorage({
    endpoint,
    region: process.env.BACKUP_S3_REGION || "us-east-1",
    bucket,
    accessKeyId,
    secretAccessKey,
    forcePathStyle: process.env.BACKUP_S3_FORCE_PATH_STYLE !== "false",
  });
}
