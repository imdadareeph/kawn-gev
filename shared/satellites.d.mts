export interface OmmRecord {
  GROUP: string;
  /** SATCAT owner code, e.g. US, PRC, CIS, ESA, UAE. */
  OWNER?: string;
  OBJECT_NAME: string;
  OBJECT_ID: string;
  EPOCH: string;
  MEAN_MOTION: number;
  ECCENTRICITY: number;
  INCLINATION: number;
  RA_OF_ASC_NODE: number;
  ARG_OF_PERICENTER: number;
  MEAN_ANOMALY: number;
  BSTAR: number;
  MEAN_MOTION_DOT: number;
  MEAN_MOTION_DDOT: number;
  NORAD_CAT_ID: number;
  ELEMENT_SET_NO: number;
  REV_AT_EPOCH?: number;
}
export const MAX_SATELLITES: number;
export const MAX_DENSE: number;
export const SAT_GROUPS: { tag: string; path: string }[];
export const DENSE_GROUP: { tag: string; path: string };
export const SAT_CLASS: Record<string, 'station' | 'visual' | 'nav' | 'geo' | 'dense'>;
export function normalizeOmm(list: unknown, cap?: number, group?: string): OmmRecord[];
export function mergeGroups(lists: OmmRecord[][], cap?: number): OmmRecord[];
export function attachOwners(omms: OmmRecord[], satcat: unknown): OmmRecord[];
