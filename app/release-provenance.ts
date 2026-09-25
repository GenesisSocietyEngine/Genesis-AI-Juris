export type BuildIdentity = {
  applicationInputsSha256: string;
  hostingConfigSha256: string;
  sourceCommit: string;
};
declare const __GENESIS_BUILD_IDENTITY__: BuildIdentity;

export function packagedBuildIdentity(): BuildIdentity | undefined {
  return typeof __GENESIS_BUILD_IDENTITY__ === "undefined" ? undefined : __GENESIS_BUILD_IDENTITY__;
}

function token(value: unknown) {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(value) ? value : "unknown";
}
function digest(value: unknown, length: number) {
  return typeof value === "string" && new RegExp(`^[a-f0-9]{${length}}$`).test(value) ? value : "unknown";
}

// Separate log contract: never changes the strict operational v1/D1 schema.
// Only release identifiers and the already validated request UUID are emitted.
export function releaseProvenanceRecord(requestId: string, bindings: {
  GENESIS_DEPLOYMENT_VERSION?: unknown; GENESIS_WEB_COMMIT?: unknown;
  CF_VERSION_METADATA?: { id?: unknown; tag?: unknown };
}, build = packagedBuildIdentity()) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(requestId)) return null;
  return {
    schema: "genesis.juris.release-provenance.v1",
    requestId,
    packagedApplicationInputsSha256: digest(build?.applicationInputsSha256, 64),
    packagedHostingConfigSha256: digest(build?.hostingConfigSha256, 64),
    packagedSourceCommit: digest(build?.sourceCommit, 40),
    configuredDeploymentLabel: token(bindings.GENESIS_DEPLOYMENT_VERSION),
    configuredCommitLabel: digest(bindings.GENESIS_WEB_COMMIT, 40),
    providerVersionId: token(bindings.CF_VERSION_METADATA?.id),
    providerVersionTag: token(bindings.CF_VERSION_METADATA?.tag),
  };
}
