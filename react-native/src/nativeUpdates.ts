import { DeviceEventEmitter, NativeModules, type EmitterSubscription } from "react-native";

export type RemoteConfigPayload = {
  version: string;
  values: Record<string, unknown>;
};

export type UpdateSnapshot = {
  channel: string;
  generatedAt?: string | null;
  current: {
    versionCode: number;
    versionName: string;
    packageName?: string | null;
    updateChannel?: string | null;
    activeOtaVersion?: string | null;
  };
  remoteConfig: RemoteConfigPayload;
  ota: {
    available: boolean;
    version?: string | null;
    mandatory: boolean;
    notes: string;
    minNativeVersionCode: number;
  };
  native: {
    available: boolean;
    versionCode: number;
    versionName?: string | null;
    packageName?: string | null;
    mandatory: boolean;
    notes: string;
    downloaded: boolean;
    installerPermissionGranted: boolean;
  };
  runtime: {
    activeOtaVersion?: string | null;
    activeBundlePath?: string | null;
    manifestFetchedAt: number;
    remoteConfigFetchedAt: number;
    downloadedNativeVersionCode: number;
    downloadedNativeVersionName?: string | null;
  };
};

export type UpdateProgressPayload = {
  stage: string;
  kind: string;
  message: string;
  progress: number;
  totalBytes: number;
  downloadedBytes: number;
  versionLabel: string;
  restartRequired: boolean;
  installerLaunched: boolean;
  timestamp: number;
};

type EdufikaUpdatesModuleShape = {
  checkForUpdates?: (baseUrl?: string | null) => Promise<string>;
  getCachedUpdateSnapshot?: () => Promise<string>;
  getRemoteConfig?: () => Promise<string>;
  startOtaUpdate?: () => Promise<string>;
  startNativeUpdate?: () => Promise<string>;
  installDownloadedNativeUpdate?: () => Promise<boolean>;
  canInstallUnknownApps?: () => Promise<boolean>;
  openUnknownAppSourcesSettings?: () => Promise<boolean>;
  confirmCurrentBundleReady?: () => void;
  restartApp?: () => void;
};

const updateModule: EdufikaUpdatesModuleShape | undefined = (
  NativeModules as { EdufikaUpdates?: EdufikaUpdatesModuleShape }
).EdufikaUpdates;

const EMPTY_SNAPSHOT: UpdateSnapshot = {
  channel: "stable",
  generatedAt: null,
  current: {
    versionCode: 0,
    versionName: "0.0.0",
    packageName: null,
    updateChannel: "stable",
    activeOtaVersion: null,
  },
  remoteConfig: {
    version: "1",
    values: {},
  },
  ota: {
    available: false,
    version: null,
    mandatory: false,
    notes: "",
    minNativeVersionCode: 0,
  },
  native: {
    available: false,
    versionCode: 0,
    versionName: null,
    packageName: null,
    mandatory: false,
    notes: "",
    downloaded: false,
    installerPermissionGranted: true,
  },
  runtime: {
    activeOtaVersion: null,
    activeBundlePath: null,
    manifestFetchedAt: 0,
    remoteConfigFetchedAt: 0,
    downloadedNativeVersionCode: 0,
    downloadedNativeVersionName: null,
  },
};

const EMPTY_PROGRESS: UpdateProgressPayload = {
  stage: "idle",
  kind: "manifest",
  message: "Ready.",
  progress: 0,
  totalBytes: -1,
  downloadedBytes: -1,
  versionLabel: "",
  restartRequired: false,
  installerLaunched: false,
  timestamp: Date.now(),
};

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function checkForUpdates(baseUrl: string): Promise<UpdateSnapshot> {
  const raw = await updateModule?.checkForUpdates?.(baseUrl);
  return parseJson(raw, EMPTY_SNAPSHOT);
}

export async function getCachedUpdateSnapshot(): Promise<UpdateSnapshot> {
  const raw = await updateModule?.getCachedUpdateSnapshot?.();
  return parseJson(raw, EMPTY_SNAPSHOT);
}

export async function getRemoteConfig(): Promise<RemoteConfigPayload> {
  const raw = await updateModule?.getRemoteConfig?.();
  return parseJson(raw, EMPTY_SNAPSHOT.remoteConfig);
}

export async function startOtaUpdate(): Promise<UpdateSnapshot> {
  const raw = await updateModule?.startOtaUpdate?.();
  return parseJson(raw, EMPTY_SNAPSHOT);
}

export async function startNativeUpdate(): Promise<UpdateSnapshot> {
  const raw = await updateModule?.startNativeUpdate?.();
  return parseJson(raw, EMPTY_SNAPSHOT);
}

export async function installDownloadedNativeUpdate(): Promise<boolean> {
  return Boolean(await updateModule?.installDownloadedNativeUpdate?.());
}

export async function canInstallUnknownApps(): Promise<boolean> {
  return Boolean(await updateModule?.canInstallUnknownApps?.());
}

export async function openUnknownAppSourcesSettings(): Promise<boolean> {
  return Boolean(await updateModule?.openUnknownAppSourcesSettings?.());
}

export function confirmCurrentBundleReady(): void {
  updateModule?.confirmCurrentBundleReady?.();
}

export function restartApp(): void {
  updateModule?.restartApp?.();
}

export function subscribeToUpdateProgress(
  listener: (payload: UpdateProgressPayload) => void
): EmitterSubscription {
  return DeviceEventEmitter.addListener("EdufikaUpdateProgress", (rawPayload: unknown) => {
    if (typeof rawPayload !== "string") {
      listener(EMPTY_PROGRESS);
      return;
    }
    listener(parseJson(rawPayload, EMPTY_PROGRESS));
  });
}
