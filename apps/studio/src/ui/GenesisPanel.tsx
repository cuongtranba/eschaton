import type { DistrictPlan, Role } from "@eschaton/genesis";
import type { GenesisLayers, WorldCommand, WorldSession } from "../lab/world/session";
import { Row } from "./Row";

const ROLES: readonly Role[] = ["tower", "house", "ruin", "garden"];
const NETWORK = ["road", "plaza", "bridge", "water"] as const;

type PlanMapProps = Readonly<{ plan: DistrictPlan; layers: GenesisLayers; lotsDone: number }>;

/** The semantic plan as a map. It shows what the generator decided; the pieces in the viewport are the world. */
function PlanMap({ plan, layers, lotsDone }: PlanMapProps) {
  const [width, depth] = plan.size;
  const lotCells = (kind: string, index: number): string => {
    const lot = plan.lots[plan.lotOf[index] ?? -1];
    if (lot === undefined) return `plan-map__${kind}`;
    return `plan-map__${layers.roles ? lot.role : "lot"}${lot.id >= lotsDone ? " plan-map__pending" : ""}`;
  };
  return (
    <svg className="plan-map" data-testid="genesis-map" viewBox={`0 0 ${width} ${depth}`} role="img" aria-label="Semantic plan of the district">
      {plan.kinds.map((kind, index) => (
        <rect key={index} x={index % width} y={Math.floor(index / width)} width={1.02} height={1.02} className={lotCells(kind, index)} />
      ))}
      {layers.routes &&
        plan.routes.map((route, index) => (
          <polyline key={index} className="plan-map__route" data-testid="genesis-route" points={route.map(([x, z]) => `${x + 0.5},${z + 0.5}`).join(" ")} />
        ))}
    </svg>
  );
}

type GenesisPanelProps = Readonly<{ session: WorldSession; dispatch: (command: WorldCommand) => void }>;

export function GenesisPanel({ session, dispatch }: GenesisPanelProps) {
  const { genesis } = session;
  const generating = genesis.status === "generating";
  const last = genesis.districts.at(-1);
  const previewPlan = genesis.preview?.plan;
  const plan = generating ? previewPlan : last?.plan;
  const lotsDone = generating ? (genesis.preview?.lotsDone ?? 0) : Number.MAX_SAFE_INTEGER;
  const progress = genesis.preview === undefined ? "planning" : `${genesis.preview.stage}: ${genesis.preview.lotsDone} of ${genesis.preview.lotsTotal} lots`;
  return (
    <section aria-label="Genesis" className="inspector__section">
      <h4>Genesis (district generation in a worker)</h4>
      <div className="world__actions">
        <span data-testid="genesis-preset">Preset: Last District 40×40</span>
        <label>
          Seed{" "}
          <input type="number" className="toolbar__seed" aria-label="District seed" data-testid="genesis-seed" min={0} value={genesis.seed} disabled={generating} onChange={(event) => { dispatch({ type: "genesisSet", seed: Number(event.target.value) }); }} />
        </label>
      </div>
      <div className="world__actions">
        <button type="button" data-testid="genesis-generate" disabled={generating || session.wave.status === "solving"} onClick={() => { dispatch({ type: "genesisStart" }); }}>
          {genesis.districts.length === 0 ? "Generate district" : "Generate next district (east)"}
        </button>
        <button type="button" data-testid="genesis-cancel" disabled={!generating} onClick={() => { dispatch({ type: "genesisCancel" }); }}>
          Cancel
        </button>
        <code data-testid="genesis-status">{genesis.status}</code>
      </div>
      <p data-testid="genesis-progress" role="status" className="muted">
        {generating ? `Plan preview, not part of the world — ${progress}` : genesis.detail}
      </p>
      <div className="world__actions">
        <label className="look__check">
          <input type="checkbox" data-testid="genesis-layer-roles" checked={genesis.layers.roles} onChange={(event) => { dispatch({ type: "genesisSet", layers: { roles: event.target.checked } }); }} />
          Lot roles
        </label>
        <label className="look__check">
          <input type="checkbox" data-testid="genesis-layer-routes" checked={genesis.layers.routes} onChange={(event) => { dispatch({ type: "genesisSet", layers: { routes: event.target.checked } }); }} />
          Network routes
        </label>
      </div>
      {plan === undefined ? (
        <p className="muted">No district yet. The first one is generated on empty ground east of the starting pieces.</p>
      ) : (
        <>
          <PlanMap plan={plan} layers={genesis.layers} lotsDone={lotsDone} />
          <ul className="plan-legend" aria-label="Plan legend">
            {[...NETWORK, ...(genesis.layers.roles ? ROLES : (["lot"] as const))].map((name) => (
              <li key={name}>
                <svg viewBox="0 0 1 1" aria-hidden="true">
                  <rect width={1} height={1} className={`plan-map__${name}`} />
                </svg>
                {name}
              </li>
            ))}
          </ul>
        </>
      )}
      {last === undefined || generating ? null : (
        <dl className="inspector__list" data-testid="genesis-metrics">
          <Row label="Districts">
            <span data-testid="genesis-districts">{genesis.districts.length}</span>
          </Row>
          <Row label="Last seed / revision">{`${last.seed} / ${last.revision}`}</Row>
          <Row label="Origin cell">{last.at.join(", ")}</Row>
          <Row label="Entities added">
            <span data-testid="genesis-entities">{last.entities}</span>
          </Row>
          <Row label="Placements">{last.metrics.placements}</Row>
          <Row label="Road / water / bridge">{`${last.metrics.roadCells} / ${last.metrics.waterCells} / ${last.metrics.bridgeCells}`}</Row>
          <Row label="Lots T / H / R / G">{`${last.metrics.lots.tower} / ${last.metrics.lots.house} / ${last.metrics.lots.ruin} / ${last.metrics.lots.garden}`}</Row>
          <Row label="Solver decisions / backtracks">{`${last.metrics.solverDecisions} / ${last.metrics.solverBacktracks}`}</Row>
          <Row label="Plan attempts / lot retries">{`${last.metrics.planAttempts} / ${last.metrics.lotRetries}`}</Row>
        </dl>
      )}
      <ul className="muted" data-testid="genesis-diagnostics" aria-label="Generation diagnostics">
        {(generating ? [] : (last?.diagnostics ?? [])).slice(0, 8).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="muted">The plan map is the generator's semantic layer. The viewport draws only committed world entities; a district is committed once, atomically, after an independent audit.</p>
    </section>
  );
}
