import { expect, test } from "vitest";
import {
  assemblyId,
  createCatalog,
  defaultCatalog,
  defaultSocketTable,
  defineFoldon,
  faceSockets,
  foldonId,
  getPrimitive,
  placeSockets,
  placementId,
  primitiveCatalog,
  socketMismatches,
  validateSocketTable,
  type Cell,
  type Face,
  type FaceProfiles,
  type FoldonDefinition,
  type Hand,
  type Rotation,
  type SocketDefinition,
  type SocketTable,
} from "@eschaton/foldon";

const fixtureTable: SocketTable = {
  version: 1,
  profiles: [
    { id: "empty", symmetry: 4, handed: false, wildcard: false, structural: false, needsMate: false },
    { id: "road", symmetry: 1, handed: false, wildcard: false, structural: true, needsMate: false },
    { id: "door", symmetry: 1, handed: false, wildcard: false, structural: true, needsMate: false },
    { id: "plinth", symmetry: 4, handed: false, wildcard: false, structural: true, needsMate: false },
    { id: "rail", symmetry: 2, handed: false, wildcard: false, structural: true, needsMate: false },
    { id: "hinge", symmetry: 4, handed: true, wildcard: false, structural: true, needsMate: false },
  ],
  mates: [
    { a: "empty", b: "empty", relation: 0, bond: false },
    { a: "road", b: "door", relation: 1, bond: true },
    { a: "plinth", b: "rail", relation: 0, bond: true },
    { a: "hinge", b: "hinge", relation: 0, bond: true },
  ],
};

const footprint: readonly Cell[] = [[0, 0, 0]];

function boxGeometry(): FoldonDefinition["geometry"] {
  const box = getPrimitive(foldonId("P08"));
  if (box === undefined) throw new Error("missing primitive P08");
  return box.geometry;
}

function piece(id: string, profiles: Omit<FaceProfiles, "default">): FoldonDefinition {
  const result = defineFoldon({
    id: foldonId(id),
    name: id,
    footprint,
    geometry: boxGeometry(),
    sockets: faceSockets(footprint, { default: "empty", ...profiles }),
    components: [],
  });
  if (!result.ok) throw new Error(`fixture ${id} is invalid: ${result.error.map((i) => i.code).join(",")}`);
  return result.value;
}

function socketOf(definition: FoldonDefinition, anchor: Cell, rotation: Rotation, face: Face): SocketDefinition {
  const found = placeSockets(definition, { anchor, rotation }).find((socket) => socket.face === face);
  if (found === undefined) throw new Error(`no ${face} socket on ${definition.id}`);
  return found;
}

const fingerprint = (value: unknown): string => {
  let hash = 0x811c9dc5;
  for (const char of JSON.stringify(value)) hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193);
  return (hash >>> 0).toString(16).padStart(8, "0");
};

const road = piece("road", { "+y": "road" });
const door = piece("door", { "-y": "door" });

test("migrating the profile table changes no primitive, assembly or hash", () => {
  if (!defaultCatalog.ok) throw new Error("default catalog failed");
  const catalog = defaultCatalog.value;
  expect({
    hashes: Object.fromEntries(catalog.assemblies().map((assembly) => [assembly.recipe.id, assembly.hash])),
    primitives: fingerprint(primitiveCatalog),
    assemblies: fingerprint(catalog.assemblies()),
    table: catalog.sockets(),
  }).toEqual({
    hashes: {
      "roof-module": "dcd032040d40fe17",
      watchtower: "64da8e9a29dabc1a",
      "roof-house": "e4ed8a33570fc9d4",
      "ruined-gate": "72172b6052872a8b",
    },
    // Re-recorded once in Phase 3, when stored recipe numbers were rounded to be the same on every engine (ADR 0017).
    primitives: "3d8aca15",
    assemblies: "a5c10493",
    table: defaultSocketTable,
  });
});

test("a C1 door profile mates with a road only at its relation turn", () => {
  const lower = socketOf(road, [0, 0, 0], 0, "+y");
  const verdicts = ([0, 1, 2, 3] as const).map((rotation) =>
    socketMismatches(fixtureTable, lower, socketOf(door, [0, 1, 0], rotation, "-y")),
  );
  expect(verdicts).toEqual([["turn"], [], ["turn"], ["turn"]]);
});

test("a catalog compiles a door on a road only at the relation turn of its own socket table", () => {
  const compiles = ([0, 1, 2, 3] as const).map(
    (rotation) =>
      createCatalog({
        foldons: [road, door],
        sockets: fixtureTable,
        assemblies: [
          {
            id: assemblyId("doorway"),
            version: 1,
            name: "Doorway",
            level: 1,
            tags: [],
            parts: [
              { id: placementId("road"), ref: { kind: "foldon", id: road.id, version: 1 }, anchor: [0, 0, 0], rotation: 0 },
              { id: placementId("door"), ref: { kind: "foldon", id: door.id, version: 1 }, anchor: [0, 1, 0], rotation },
            ],
          },
        ],
      }).ok,
  );
  expect(compiles).toEqual([false, true, false, false]);
});

test("a quarter-turned C4 piece mates exactly where the unturned one does", () => {
  const plinth = piece("plinth", { "+y": "plinth" });
  const rail = piece("rail", { "-y": "rail" });
  const upper = socketOf(rail, [0, 1, 0], 1, "-y");
  const verdicts = ([0, 1] as const).map((rotation) =>
    socketMismatches(fixtureTable, socketOf(plinth, [0, 0, 0], rotation, "+y"), upper),
  );
  expect(verdicts).toEqual([[], []]);
});

test("handed side faces mate only left-to-right", () => {
  const hinged = (hand: Hand | undefined): FoldonDefinition =>
    piece(`hinge-${hand ?? "none"}`, {
      "+x": hand === undefined ? "hinge" : { profile: "hinge", hand },
      "-x": hand === undefined ? "hinge" : { profile: "hinge", hand },
    });
  const pairs: readonly (readonly [Hand, Hand | undefined])[] = [
    ["left", "right"],
    ["right", "left"],
    ["left", "left"],
    ["right", "right"],
    ["left", undefined],
  ];
  const verdicts = pairs.map(([west, east]) =>
    socketMismatches(fixtureTable, socketOf(hinged(west), [0, 0, 0], 0, "+x"), socketOf(hinged(east), [1, 0, 0], 0, "-x")),
  );
  expect(verdicts).toEqual([[], [], ["hand"], ["hand"], ["hand"]]);
});

test("a table with an illegal self-pair relation is rejected", () => {
  const result = validateSocketTable({
    version: 1,
    profiles: [{ id: "rail", symmetry: 2, handed: false, wildcard: false, structural: true, needsMate: false }],
    mates: [{ a: "rail", b: "rail", relation: 1, bond: true }],
  });
  expect(result.ok ? [] : result.error.map((found) => `${found.code} ${found.path}`)).toEqual([
    "socket-table-invalid mates[0].relation",
  ]);
});

test("a catalog socket whose profile is not in the socket table is rejected", () => {
  const result = createCatalog({ foldons: [door], assemblies: [] });
  expect(result.ok ? [] : result.error.map((found) => found.code)).toEqual(["socket-profile-unknown"]);
});

test("a socket table that lets a non-structural profile carry a bond is rejected", () => {
  const table: SocketTable = {
    version: 1,
    profiles: [{ id: "empty", symmetry: 4, handed: false, wildcard: false, structural: false, needsMate: false }],
    mates: [{ a: "empty", b: "empty", relation: 0, bond: true }],
  };
  const result = validateSocketTable(table);
  expect(result.ok ? [] : result.error.map((i) => i.code)).toEqual(["socket-table-invalid"]);
});
