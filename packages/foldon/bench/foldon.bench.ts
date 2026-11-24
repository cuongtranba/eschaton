import { test } from "vitest";
import {
  assemblyCatalog,
  assemblyId,
  createCatalog,
  defaultCatalog,
  foldProgress,
  foldonId,
  getPrimitive,
  poseGeometry,
  primitiveCatalog,
} from "@eschaton/foldon";

const OPTIONS = { warmupIterations: 200, warmupTime: 300, time: 800 } as const;

const catalog = defaultCatalog.ok ? defaultCatalog.value : undefined;
const p08 = getPrimitive(foldonId("P08"));
if (catalog === undefined || p08 === undefined) throw new Error("default catalog failed to build");

test("poseGeometry per primitive at full fold", async ({ bench }) => {
  await bench.compare(
    ...primitiveCatalog.map((definition) => {
      const targets = foldProgress(definition.geometry, 1);
      return bench(`poseGeometry ${definition.id} ${definition.name}`, () => {
        poseGeometry(definition.geometry, targets);
      });
    }),
    OPTIONS,
  );
});

test("catalog build, fold demo and assembly flatten", async ({ bench }) => {
  await bench.compare(
    bench("createCatalog(default inputs)", () => {
      createCatalog({ foldons: primitiveCatalog, assemblies: assemblyCatalog });
    }),
    bench("foldProgress(P08, 0.5) + poseGeometry", () => {
      poseGeometry(p08.geometry, foldProgress(p08.geometry, 0.5));
    }),
    bench("flatten roof-house", () => {
      catalog.flatten(assemblyId("roof-house"));
    }),
    bench("flatten watchtower", () => {
      catalog.flatten(assemblyId("watchtower"));
    }),
    OPTIONS,
  );
});
