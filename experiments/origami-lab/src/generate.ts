import { err, type Result } from "@eschaton/foldon";
import { buildObject, type LabObject, type ObjectError, type ObjectRecipe } from "./object";
import { birdRecipe } from "./objects/bird";
import { houseRecipe } from "./objects/house";
import { pineRecipe } from "./objects/pine";
import { vehicleRecipe } from "./objects/vehicle";

export const objectNames = ["bird", "vehicle", "house", "pine"] as const;
export type ObjectName = (typeof objectNames)[number];

export type GenerateError = ObjectError | Readonly<{ code: "unknown-object"; message: string }>;

const recipes: Readonly<Record<ObjectName, (seed: number) => ObjectRecipe>> = {
  bird: birdRecipe,
  vehicle: vehicleRecipe,
  house: houseRecipe,
  pine: pineRecipe,
};

export function recipeFor(name: string, seed: number): Result<ObjectRecipe, GenerateError> {
  const known = objectNames.find((n) => n === name);
  return known === undefined
    ? err({ code: "unknown-object", message: `unknown object ${name}` })
    : { ok: true, value: recipes[known](seed) };
}

export function generate(name: string, seed: number): Result<LabObject, GenerateError> {
  const recipe = recipeFor(name, seed);
  return recipe.ok ? buildObject(recipe.value) : recipe;
}
