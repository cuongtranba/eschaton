import type { AssemblyDefinition, FoldonDefinition } from "@eschaton/foldon";
import { footprintSize, itemKey, sameItem, scenes, WORLD_SCENE_ID, type ItemRef, type Library } from "../lab/library";
import type { LabCommand } from "../lab/state";

type CatalogPanelProps = Readonly<{
  library: Library;
  selected: ItemRef;
  dispatch: (command: LabCommand) => void;
}>;

const sizeLabel = (definition: FoldonDefinition | AssemblyDefinition): string =>
  footprintSize(definition.footprint).join("×");

export function CatalogPanel({ library, selected, dispatch }: CatalogPanelProps) {
  const primitives = library.catalog.foldons();
  const assemblies = library.catalog.assemblies();
  const choose = (item: ItemRef) => () => { dispatch({ type: "selectItem", item }); };
  return (
    <nav className="panel panel--left" aria-label="Catalog">
      <h2>Scenes</h2>
      <ul className="catalog">
        {scenes.map((scene) => {
          const ref: ItemRef = { kind: "scene", id: scene.id };
          const world = scene.id === WORLD_SCENE_ID;
          return (
            <li key={itemKey(ref)}>
              <button
                type="button"
                className="catalog__item"
                data-item={itemKey(ref)}
                data-name={scene.name}
                title={scene.summary}
                aria-current={sameItem(ref, selected) ? "true" : undefined}
                onClick={choose(ref)}
              >
                <span className="catalog__id">{world ? "W" : "SC"}</span>
                <span className="catalog__name">{scene.name}</span>
                <span className="catalog__size">{world ? "world" : "look"}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="muted catalog__note">Everything except World is a Phase 0 look-dev view, not world state.</p>
      <h2>Primitives</h2>
      <ul className="catalog">
        {primitives.map((definition) => {
          const ref: ItemRef = { kind: "primitive", id: definition.id };
          return (
            <li key={itemKey(ref)}>
              <button
                type="button"
                className="catalog__item"
                data-item={itemKey(ref)}
                data-name={definition.name}
                aria-current={sameItem(ref, selected) ? "true" : undefined}
                onClick={choose(ref)}
              >
                <span className="catalog__id">{definition.id}</span>
                <span className="catalog__name">{definition.name}</span>
                <span className="catalog__size">{sizeLabel(definition)}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <h2>Assemblies</h2>
      <ul className="catalog">
        {assemblies.map((definition) => {
          const ref: ItemRef = { kind: "assembly", id: definition.recipe.id };
          return (
            <li key={itemKey(ref)}>
              <button
                type="button"
                className="catalog__item"
                data-item={itemKey(ref)}
                data-name={definition.recipe.name}
                aria-current={sameItem(ref, selected) ? "true" : undefined}
                onClick={choose(ref)}
              >
                <span className="catalog__id">L{definition.recipe.level}</span>
                <span className="catalog__name">{definition.recipe.name}</span>
                <span className="catalog__size">{sizeLabel(definition)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
