import { exitWith } from "./harness.ts";
import { recordVitestBench } from "./vitestBench.ts";

try {
  console.log(`World benchmark -> ${recordVitestBench("packages/world", "world.json")}`);
} catch (error) {
  exitWith(error);
}
