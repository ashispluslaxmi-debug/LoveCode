export { assessCommandRisk, assessToolRisk, formatRisk } from './risk.js';
export type { RiskScore } from './risk.js';

export { scanText, scanFile, scanDirectory, formatSecretMatch, formatSecretSummary } from './secrets.js';
export type { SecretMatch, SecretType } from './secrets.js';

export { getProfile, listProfiles, checkCommand, formatProfile } from './sandbox.js';
export type { SandboxProfile, SandboxRule } from './sandbox.js';

export {
  loadPermissions,
  savePermissions,
  setDefault,
  addPermission,
  removePermission,
  checkPermission,
  addTrustedSource,
  removeTrustedSource,
  isSourceTrusted,
  resetPermissions,
  formatPermissions,
} from './permissions.js';
export type { Permission, PermissionSet } from './permissions.js';
