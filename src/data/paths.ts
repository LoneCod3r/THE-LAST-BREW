export type PathId = 'key' | 'mind' | 'void';
export type Beverage = 'COFFEE' | 'NORMAL COFFEE' | 'STRONG COFFEE';

export interface ArchivePath {
  id: PathId;
  number: string;
  /** Internal case codename, shown on the case file. */
  codename: string;
  /** The label on the machine's button; also what the machine dispenses. */
  beverage: Beverage;
  caseId: string;
  subtitle: string;
  /** Colour of the dispensed coffee surface. */
  roast: string;
  /** How long the pour lasts, in ms, before reduced-motion scaling. */
  pourMs: number;
}

export const PATHS: readonly ArchivePath[] = [
  {
    id: 'key',
    number: '01',
    codename: 'THE KEY',
    beverage: 'COFFEE',
    caseId: 'CASE-001',
    subtitle: 'THE FIRST LOCK',
    roast: '#6b4524',
    pourMs: 4200,
  },
  {
    id: 'mind',
    number: '02',
    codename: 'THE MIND',
    beverage: 'NORMAL COFFEE',
    caseId: 'CASE-002',
    subtitle: 'PATTERNS WITHIN PATTERNS',
    roast: '#4f2f17',
    pourMs: 5000,
  },
  {
    id: 'void',
    number: '03',
    codename: 'THE VOID',
    beverage: 'STRONG COFFEE',
    caseId: 'CASE-003',
    subtitle: 'NOTHING IS WHAT IT SEEMS',
    roast: '#2e1a0c',
    pourMs: 5600,
  },
];

export const PATH_BY_ID: Readonly<Record<PathId, ArchivePath>> = Object.fromEntries(
  PATHS.map((path) => [path.id, path]),
) as Record<PathId, ArchivePath>;

export function isPathId(value: unknown): value is PathId {
  return typeof value === 'string' && value in PATH_BY_ID;
}
