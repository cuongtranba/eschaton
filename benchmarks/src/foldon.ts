import { exitWith } from "./harness.ts";
import { recordVitestBench } from "./vitestBench.ts";

try {
  console.log(`Foldon benchmark -> ${recordVitestBench("packages/foldon", "foldon.json")}`);
} catch (error) {
  exitWith(error);
}
