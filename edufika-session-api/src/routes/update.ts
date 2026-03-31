import { promises as fs } from "node:fs";
import path from "node:path";
import { Router } from "express";
import { config } from "../config";

type RemoteConfigPayload = {
  version: string;
  values: Record<string, unknown>;
};

type OtaReleasePayload = {
  version: string;
  mandatory: boolean;
  minNativeVersionCode: number;
  bundleUrl: string;
  sha256: string;
  notes: string;
};

type NativeReleasePayload = {
  versionCode: number;
  versionName: string;
  mandatory: boolean;
  apkUrl: string;
  sha256: string;
  notes: string;
  packageName?: string;
};

type UpdateManifestPayload = {
  channel: string;
  generatedAt: string;
  remoteConfig: RemoteConfigPayload;
  ota: OtaReleasePayload | null;
  native: NativeReleasePayload | null;
};

export function createUpdateRouter(): Router {
  const router = Router();

  router.get("/manifest", async (req, res, next) => {
    try {
      const manifest = await loadManifest(
        req.protocol,
        req.get("host") || "",
        normalizeChannel(req.query.channel)
      );
      res.setHeader("Cache-Control", "no-store");
      res.json(manifest);
    } catch (error) {
      next(error);
    }
  });

  router.get("/remote-config", async (req, res, next) => {
    try {
      const manifest = await loadManifest(
        req.protocol,
        req.get("host") || "",
        normalizeChannel(req.query.channel)
      );
      res.setHeader("Cache-Control", "no-store");
      res.json({
        channel: manifest.channel,
        generatedAt: manifest.generatedAt,
        remoteConfig: manifest.remoteConfig,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

async function loadManifest(
  protocol: string,
  host: string,
  requestedChannel: string
): Promise<UpdateManifestPayload> {
  const raw = await fs.readFile(await resolveManifestPath(requestedChannel), "utf8");
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  return normalizeManifest(parsed, protocol, host, requestedChannel);
}

async function resolveManifestPath(requestedChannel: string): Promise<string> {
  const channel = requestedChannel || config.defaultUpdateChannel;
  const channelFileName = `manifest.${channel}.json`;
  const channelPath = path.join(config.updateManifestsDir, channelFileName);

  if (channel === config.defaultUpdateChannel) {
    if (await fileExists(channelPath)) {
      return channelPath;
    }
    return config.updateManifestPath;
  }

  if (await fileExists(channelPath)) {
    return channelPath;
  }

  return config.updateManifestPath;
}

function normalizeManifest(
  manifest: Record<string, unknown>,
  protocol: string,
  host: string,
  requestedChannel: string
): UpdateManifestPayload {
  return {
    channel: readString(manifest.channel) || requestedChannel || config.defaultUpdateChannel,
    generatedAt: readString(manifest.generatedAt) || new Date().toISOString(),
    remoteConfig: normalizeRemoteConfig(manifest.remoteConfig),
    ota: normalizeOtaRelease(manifest.ota, protocol, host),
    native: normalizeNativeRelease(manifest.native, protocol, host),
  };
}

function normalizeRemoteConfig(input: unknown): RemoteConfigPayload {
  if (!isRecord(input)) {
    return {
      version: "1",
      values: {},
    };
  }
  return {
    version: readString(input.version) || "1",
    values: isRecord(input.values) ? input.values : {},
  };
}

function normalizeOtaRelease(
  input: unknown,
  protocol: string,
  host: string
): OtaReleasePayload | null {
  if (!isRecord(input)) {
    return null;
  }
  const version = readString(input.version);
  const bundleUrl = resolvePublicUrl(readString(input.bundleUrl), protocol, host);
  const sha256 = normalizeSha256(readString(input.sha256));
  if (!version || !bundleUrl || !sha256) {
    return null;
  }
  return {
    version,
    mandatory: Boolean(input.mandatory),
    minNativeVersionCode: readInt(input.minNativeVersionCode, 0),
    bundleUrl,
    sha256,
    notes: readString(input.notes) || "",
  };
}

function normalizeNativeRelease(
  input: unknown,
  protocol: string,
  host: string
): NativeReleasePayload | null {
  if (!isRecord(input)) {
    return null;
  }
  const versionCode = readInt(input.versionCode, 0);
  const versionName = readString(input.versionName);
  const apkUrl = resolvePublicUrl(readString(input.apkUrl), protocol, host);
  const sha256 = normalizeSha256(readString(input.sha256));
  if (versionCode <= 0 || !versionName || !apkUrl || !sha256) {
    return null;
  }
  return {
    versionCode,
    versionName,
    mandatory: Boolean(input.mandatory),
    apkUrl,
    sha256,
    notes: readString(input.notes) || "",
    packageName: readString(input.packageName) || undefined,
  };
}

function resolvePublicUrl(rawValue: string, protocol: string, host: string): string {
  const value = rawValue.trim();
  if (!value) {
    return "";
  }
  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  const normalizedPath = value.startsWith("/") ? value : `/${value}`;
  const base = config.publicBaseUrl || `${protocol}://${host}`;
  return `${base.replace(/\/+$/, "")}${normalizedPath}`;
}

function normalizeSha256(value: string): string {
  const normalized = value.trim().toLowerCase();
  return /^[a-f0-9]{64}$/.test(normalized) ? normalized : "";
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readInt(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.trunc(value)
    : typeof value === "string"
      ? Number.parseInt(value, 10) || fallback
      : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeChannel(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  const normalized = value.trim().toLowerCase();
  return /^[a-z0-9._-]+$/.test(normalized) ? normalized : "";
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function ensureUpdateAssetDirectory(): Promise<void> {
  await fs.mkdir(config.updateAssetsDir, { recursive: true });
  await fs.mkdir(config.updateManifestsDir, { recursive: true });
  const manifestDir = path.dirname(config.updateManifestPath);
  if (manifestDir) {
    await fs.mkdir(manifestDir, { recursive: true });
  }
}
