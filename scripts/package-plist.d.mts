// ABOUTME: Describes the release-only Info.plist rewriting boundary for TypeScript tests.
// ABOUTME: Keeps the JavaScript packaging helper checked without moving macOS tooling into application source.
export interface MovieLogPlistIdentity {
  appIdentifier: string;
  appName: string;
  iconBaseName: string;
  version: string;
}

export function rewriteMovieLogInfoPlist(contents: string, identity: MovieLogPlistIdentity): string;
