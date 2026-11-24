import type { AssemblyDefinition, FoldonDefinition } from "@eschaton/foldon";
import { footprintSize, itemKey, referenceScene, sameItem, type ItemRef, type Library } from "../lab/library";
import type { LabCommand } from "../lab/state";

type CatalogPanelProps = Readonly<{
  library: Library;
  selected: ItemRef;
  dispatch: (command: LabCommand) => void;
}>;

const sceneRef: ItemRef = { kind: "scene", id: referenceScene.id };

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
        <li>
          <button
            type="button"
            className="catalog__item"
            data-item={itemKey(sceneRef)}
            data-name={referenceScene.name}
            aria-current={sameItem(sceneRef, selected) ? "true" : undefined}
            onClick={choose(sceneRef)}
          >
            <span className="catalog__id">SC</span>
            <span className="catalog__name">{referenceScene.name}</span>
            <span className="catalog__size">look</span>
          </button>
        </li>
      </ul>
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
