import {
  validateFoldon,
  type AssemblyDefinition,
  type ComponentSpec,
  type CreaseDefinition,
  type FoldonDefinition,
  type PosedCrease,
} from "@eschaton/foldon";
import { cellBounds, footprintSize, WORLD_SCENE_ID, type Library, type ResolvedItem } from "../lab/library";
import { creaseTargets } from "../lab/scene";
import type { LabCommand, LabState } from "../lab/state";
import type { ViewModel } from "../lab/viewModel";
import type { WorldCommand, WorldSession } from "../lab/world/session";
import { LookPanel } from "./LookPanel";
import { Row } from "./Row";
import { WorldDetails } from "./WorldInspector";

type InspectorProps = Readonly<{
  item: ResolvedItem;
  library: Library;
  state: LabState;
  viewModel: ViewModel;
  dispatch: (command: LabCommand) => void;
  world: WorldSession;
  worldDispatch: (command: WorldCommand) => void;
}>;

const toDegrees = (radians: number): number => (radians * 180) / Math.PI;
const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
export const formatDegrees = (radians: number): string => `${(Math.round(toDegrees(radians) * 10) / 10 + 0).toFixed(1)}°`;

function describeComponent(component: ComponentSpec): string {
  switch (component.kind) {
    case "foldable":
      return `foldable · ${component.creases.length} creases · stiffness ${component.stiffness}`;
    case "structural":
      return `structural · strength ${component.strength}`;
    case "wind-responsive":
      return `wind-responsive · drag ${component.drag}`;
    case "decayable":
      return `decayable · resistance ${component.resistance}`;
    case "thermal":
      return `thermal · capacity ${component.capacity}`;
    case "renderable":
      return `renderable · ${component.material}`;
  }
}

function Footprint({ definition }: Readonly<{ definition: FoldonDefinition | AssemblyDefinition }>) {
  const { min, max } = cellBounds(definition.footprint);
  return (
    <>
      <Row label="Footprint cells">{definition.footprint.length}</Row>
      <Row label="Bounding box">
        {footprintSize(definition.footprint).join(" × ")} cells · [{min.join(",")}]–[{max.join(",")}]
      </Row>
    </>
  );
}

type CreaseRowProps = Readonly<{
  crease: CreaseDefinition;
  target: number;
  measured: PosedCrease | undefined;
  dispatch: (command: LabCommand) => void;
}>;

function CreaseRow({ crease, target, measured, dispatch }: CreaseRowProps) {
  const [low, high] = crease.range;
  const change = (value: string): void => {
    const angle = Math.min(high, Math.max(low, toRadians(Number(value))));
    dispatch({ type: "setCreaseAngle", creaseId: crease.id, angle });
  };
  return (
    <tr>
      <th scope="row">{crease.id}</th>
      <td>{crease.assignment}</td>
      <td className="num" data-testid={`crease-current-${crease.id}`}>
        {measured === undefined ? "—" : formatDegrees(measured.angle)}
      </td>
      <td className="num">{formatDegrees(crease.restAngle)}</td>
      <td>
        <input
          type="range"
          aria-label={`Angle of crease ${crease.id}`}
          data-testid={`crease-slider-${crease.id}`}
          min={toDegrees(low)}
          max={toDegrees(high)}
          step={0.1}
          value={toDegrees(target)}
          onChange={(event) => { change(event.target.value); }}
        />
      </td>
    </tr>
  );
}

function Identity({ id, version, definition }: Readonly<{ id: string; version: number; definition: FoldonDefinition | AssemblyDefinition }>) {
  return (
    <>
      <Row label="Id">
        <code>{id}</code>
      </Row>
      <Row label="Version">{version}</Row>
      <Footprint definition={definition} />
    </>
  );
}

function PrimitiveDetails({ definition, state, viewModel, dispatch }: Readonly<{ definition: FoldonDefinition } & Pick<InspectorProps, "state" | "viewModel" | "dispatch">>) {
  const validation = validateFoldon(definition);
  const batch = viewModel.batches.find((candidate) => candidate.key === `${definition.id}@${definition.version}`);
  const targets = creaseTargets(definition, state, definition.id);
  return (
    <>
      <dl className="inspector__list">
        <Identity id={definition.id} version={definition.version} definition={definition} />
        <Row label="Validation">
          {validation.ok ? "valid" : validation.error.map((issue) => `${issue.code} at ${issue.path}`).join("; ")}
        </Row>
        <Row label="Components">
          <ul className="plain">
            {definition.components.map((component) => (
              <li key={component.kind}>{describeComponent(component)}</li>
            ))}
          </ul>
        </Row>
      </dl>
      <section aria-label="Creases" className="inspector__section">
        <h4>Creases</h4>
        {definition.geometry.creases.length === 0 ? (
          <p className="muted">No creases: a flat, rigid panel.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">Crease</th>
                <th scope="col">Fold</th>
                <th scope="col">Current</th>
                <th scope="col">Rest</th>
                <th scope="col">Angle</th>
              </tr>
            </thead>
            <tbody>
              {definition.geometry.creases.map((crease) => (
                <CreaseRow
                  key={crease.id}
                  crease={crease}
                  target={targets.get(crease.id) ?? crease.restAngle}
                  measured={batch?.geometry.creases.find((posed) => posed.id === crease.id)}
                  dispatch={dispatch}
                />
              ))}
            </tbody>
          </table>
        )}
      </section>
      <section aria-label="Sockets" className="inspector__section">
        <h4>Sockets</h4>
        <table>
          <thead>
            <tr>
              <th scope="col">Face</th>
              <th scope="col">Profile</th>
              <th scope="col">Role</th>
            </tr>
          </thead>
          <tbody>
            {definition.sockets.map((socket) => (
              <tr key={socket.id}>
                <th scope="row">
                  {socket.face} @ {socket.cell.join(",")}
                </th>
                <td>{socket.profile}</td>
                <td>{socket.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

function AssemblyDetails({ definition, library }: Readonly<{ definition: AssemblyDefinition; library: Library }>) {
  const leaves = library.catalog.flatten(definition.recipe.id, definition.recipe.version);
  const usage = new Map<string, number>();
  for (const leaf of leaves) usage.set(leaf.definitionId, (usage.get(leaf.definitionId) ?? 0) + 1);
  const nested = new Map<string, number>();
  for (const part of definition.recipe.parts) {
    if (part.ref.kind === "assembly") nested.set(part.ref.id, (nested.get(part.ref.id) ?? 0) + 1);
  }
  return (
    <>
      <dl className="inspector__list">
        <Identity id={definition.recipe.id} version={definition.recipe.version} definition={definition} />
        <Row label="Level">{definition.recipe.level}</Row>
        <Row label="Canonical hash">
          <code>{definition.hash}</code>
        </Row>
        <Row label="Parts">{definition.semantics.partCount}</Row>
        <Row label="Leaf Foldons">{leaves.length}</Row>
        <Row label="Open sockets">{definition.sockets.length}</Row>
        <Row label="Validation">{definition.validation}</Row>
        <Row label="Roles">{definition.semantics.roles.join(", ")}</Row>
      </dl>
      <section aria-label="Foldon usage" className="inspector__section">
        <h4>Foldon usage</h4>
        <ul className="plain">
          {[...usage].map(([id, count]) => (
            <li key={id}>
              {id} × {count}
            </li>
          ))}
        </ul>
      </section>
      <section aria-label="Nested assemblies" className="inspector__section">
        <h4>Nested assemblies</h4>
        {nested.size === 0 ? (
          <p className="muted">None</p>
        ) : (
          <ul className="plain">
            {[...nested].map(([id, count]) => (
              <li key={id}>
                {id} × {count}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function SceneDetails({ state, viewModel }: Readonly<Pick<InspectorProps, "state" | "viewModel">>) {
  const instances = viewModel.batches.reduce((sum, batch) => sum + batch.bases.length, 0);
  return (
    <dl className="inspector__list">
      <Row label="Scene">The Last District (look-dev)</Row>
      <Row label="Seed">
        <code data-testid="scene-seed">{state.seed}</code>
      </Row>
      <Row label="Layout hash">
        <code data-testid="layout-hash">{viewModel.layoutHash ?? "n/a"}</code>
      </Row>
      <Row label="Scene instances">
        <span data-testid="scene-instances">{instances}</span>
      </Row>
      <Row label="Batches">{viewModel.batches.length}</Row>
    </dl>
  );
}

const titleOf = (item: ResolvedItem): string => {
  switch (item.kind) {
    case "primitive":
      return item.definition.name;
    case "assembly":
      return item.definition.recipe.name;
    case "scene":
      return item.definition.name;
  }
};

export function Inspector({ item, library, state, viewModel, dispatch, world, worldDispatch }: InspectorProps) {
  const title = titleOf(item);
  return (
    <aside className="panel panel--right" aria-label="Inspector">
      <LookPanel look={state.look} dispatch={dispatch} />
      <h2>Inspector</h2>
      <h3 data-testid="inspector-title">{title}</h3>
      {viewModel.errors.map((entry) => (
        <p key={entry.definitionKey} className="error" role="alert">
          {entry.definitionKey}: {entry.error.message}
        </p>
      ))}
      {item.kind === "primitive" && (
        <PrimitiveDetails definition={item.definition} state={state} viewModel={viewModel} dispatch={dispatch} />
      )}
      {item.kind === "assembly" && <AssemblyDetails definition={item.definition} library={library} />}
      {item.kind === "scene" && item.definition.id !== WORLD_SCENE_ID && <SceneDetails state={state} viewModel={viewModel} />}
      {item.kind === "scene" && item.definition.id === WORLD_SCENE_ID && <WorldDetails session={world} dispatch={worldDispatch} />}
    </aside>
  );
}
