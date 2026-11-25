import { exitWith } from "./harness.ts";
import { recordVitestBench } from "./vitestBench.ts";

try {
  console.log(`Wave benchmark -> ${recordVitestBench("packages/wave", "wave.json")}`);
} catch (error) {
  exitWith(error);
}
