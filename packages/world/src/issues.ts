export type WorldIssueCode =
  | "seed-invalid"
  | "patch-invalid"
  | "op-invalid"
  | "ref-unknown"
  | "rotation-not-allowed"
  | "material-missing"
  | "entity-unknown"
  | "owner-invalid"
  | "cell-occupied"
  | "socket-incompatible"
  | "bond-invalid"
  | "fold-invalid"
  | "transform-invalid"
  | "quantity-invalid"
  | "conservation-violated"
  | "lineage-invalid"
  | "id-invalid"
  | "snapshot-malformed"
  | "schema-newer"
  | "catalog-mismatch"
  | "rules-mismatch";

export type WorldIssue = Readonly<{ code: WorldIssueCode; message: string; op?: number }>;

export const worldIssue = (code: WorldIssueCode, message: string, op?: number): WorldIssue =>
  op === undefined ? { code, message } : { code, message, op };
