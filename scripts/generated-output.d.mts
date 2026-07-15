// ABOUTME: Describes the generated-output audit functions used by TypeScript tests.
// ABOUTME: Keeps the packaging script's JavaScript boundary type-safe without changing runtime code.
export function findUnreferencedGeneratedModules(sourceDirectory: string, outputDirectory: string): Promise<string[]>;
export function assertGeneratedOutput(projectDirectory?: string): Promise<void>;
