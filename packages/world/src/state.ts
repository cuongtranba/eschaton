import type { Cell, Face, FoldonId, MaterialId, Rotation, Vec3 } from "@eschaton/foldon";

declare const brand: unique symbol;
type Brand<B extends string> = string & { readonly [brand]: B };

export type EntityId = Brand<"EntityId">;
export type GroupId = Brand<"GroupId">;
export type StoreId = Brand<"StoreId">;

export const storeId = (value: string): StoreId => value as StoreId;

export type Revision = number;
export type Stamp = Readonly<{ revision: Revision; ordinal: number }>;

export const entityIdOf = (stamp: Stamp): EntityId => `e${stamp.revision}.${stamp.ordinal}` as EntityId;
export const groupIdOf = (stamp: Stamp): GroupId => `g${stamp.revision}.${stamp.ordinal}` as GroupId;

export type Quaternion = readonly [number, number, number, number];

export type ContinuousTransform = Readonly<{
  position: Vec3;
  rotation: Quaternion;
  scale: number;
}>;

export type Owner =
  | Readonly<{ kind: "placed"; anchor: Cell; rotation: Rotation }>
  | Readonly<{ kind: "detached"; transform: ContinuousTransform }>
  | Readonly<{ kind: "inventory"; store: StoreId }>
  | Readonly<{ kind: "consumed"; by: Revision; reason: ConsumeReason }>;

export type ConsumeReason = "split" | "merged" | "destroyed";

export type DefinitionRef = Readonly<{ id: FoldonId; version: number }>;

export type Entity = Readonly<{
  id: EntityId;
  created: Stamp;
  definition: DefinitionRef;
  material: MaterialId;
  quantity: number;
  group: GroupId | null;
  fold: Readonly<Record<string, number>>;
  owner: Owner;
}>;

export type BondEnd = Readonly<{ entity: EntityId; cell: Cell; face: Face }>;
export type Bond = Readonly<{ a: BondEnd; b: BondEnd; strength: number }>;

export type LineageRecord =
  | Readonly<{ kind: "instantiated"; at: Revision; entity: EntityId; source: string }>
  | Readonly<{ kind: "detached" | "reattached" | "stored" | "retrieved"; at: Revision; entity: EntityId }>
  | Readonly<{ kind: "split"; at: Revision; parent: EntityId; children: readonly EntityId[] }>
  | Readonly<{ kind: "merged"; at: Revision; parents: readonly EntityId[]; child: EntityId }>
  | Readonly<{ kind: "consumed"; at: Revision; entity: EntityId; reason: "destroyed" }>;

export type Conservation = "off" | Readonly<{ mode: "closed"; baseline: Readonly<Record<string, number>> }>;

export const SNAPSHOT_SCHEMA = 1;

export type Versions = Readonly<{ catalog: string; rules: string; engine: string }>;

export type Header = Readonly<{
  schema: number;
  seed: number;
  versions: Versions;
  tick: number;
  revision: Revision;
}>;

export type WorldState = Readonly<{
  header: Header;
  entities: readonly Entity[];
  bonds: readonly Bond[];
  lineage: readonly LineageRecord[];
  conservation: Conservation;
}>;
