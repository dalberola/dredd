// Lets the reporters import the package manifest for its version string
// without enabling `resolveJsonModule` (the manifest lives outside the
// compiler's rootDir, which that option doesn't allow). Only `version` is
// relied upon.
declare module '*/package.json' {
  const pkg: { version: string; [key: string]: unknown };
  export default pkg;
}
