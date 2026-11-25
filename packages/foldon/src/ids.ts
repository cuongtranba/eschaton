declare const brand: unique symbol;
type Brand<B extends string> = string & { readonly [brand]: B };

export type FoldonId = Brand<"FoldonId">;
export type PanelId = Brand<"PanelId">;
export type CreaseId = Brand<"CreaseId">;
export type SocketId = Brand<"SocketId">;
export type MaterialId = Brand<"MaterialId">;
export type PlacementId = Brand<"PlacementId">;
export type AssemblyId = Brand<"AssemblyId">;
export type ContractId = Brand<"ContractId">;

export const foldonId = (value: string): FoldonId => value as FoldonId;
export const panelId = (value: string): PanelId => value as PanelId;
export const creaseId = (value: string): CreaseId => value as CreaseId;
export const socketId = (value: string): SocketId => value as SocketId;
export const materialId = (value: string): MaterialId => value as MaterialId;
export const assemblyId = (value: string): AssemblyId => value as AssemblyId;
export const placementId = (value: string): PlacementId => value as PlacementId;
export const contractId = (value: string): ContractId => value as ContractId;
