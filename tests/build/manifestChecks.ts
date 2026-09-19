export interface GeneratedManifest {
  manifest_version?: number;
  permissions?: string[];
  host_permissions?: string[];
  content_scripts?: unknown[];
  side_panel?: { default_path?: string };
  action?: unknown;
  icons?: Record<string, string>;
  [key: string]: unknown;
}

export interface ManifestCheckResult {
  ok: boolean;
  failures: string[];
}

const FORBIDDEN_PERMISSIONS = ['tabs', 'activeTab', 'scripting', 'alarms', 'unlimitedStorage'];
const REQUIRED_PERMISSIONS = ['sidePanel', 'storage'];
const REQUIRED_ICON_SIZES = ['16', '32', '48', '128'];

export function checkGeneratedManifest(
  manifest: GeneratedManifest,
  options: { standaloneHtmlExists: boolean },
): ManifestCheckResult {
  const failures: string[] = [];

  if (manifest.manifest_version !== 3) failures.push('manifest_version must be 3');

  const permissions = [...(manifest.permissions ?? [])].sort();
  if (JSON.stringify(permissions) !== JSON.stringify([...REQUIRED_PERMISSIONS].sort())) {
    failures.push(
      `permissions must be exactly sidePanel and storage; found ${permissions.join(',')}`,
    );
  }
  for (const forbidden of FORBIDDEN_PERMISSIONS) {
    if ((manifest.permissions ?? []).includes(forbidden)) {
      failures.push(`forbidden permission present: ${forbidden}`);
    }
  }
  if ((manifest.host_permissions ?? []).length > 0) {
    failures.push('host_permissions must be absent or empty');
  }
  if (manifest.content_scripts !== undefined) {
    failures.push('content_scripts must be absent');
  }
  if (manifest.side_panel?.default_path !== 'sidepanel.html') {
    failures.push(
      `side_panel.default_path must be sidepanel.html; found ${manifest.side_panel?.default_path}`,
    );
  }
  if (!manifest.action) failures.push('action must be present');
  for (const size of REQUIRED_ICON_SIZES) {
    if (!manifest.icons?.[size]) failures.push(`icons.${size} must be present`);
  }
  if (!options.standaloneHtmlExists)
    failures.push('standalone.html must exist in the build output');

  return { ok: failures.length === 0, failures };
}
