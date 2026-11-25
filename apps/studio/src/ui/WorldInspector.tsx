import { useMemo } from "react";
import { hashState } from "@eschaton/world";
import { canAttach, canDetach, selectedEntity, type WorldCommand, type WorldSession } from "../lab/world/session";
import { Row } from "./Row";

type WorldDetailsProps = Readonly<{
  session: WorldSession;
  dispatch: (command: WorldCommand) => void;
}>;

export function WorldDetails({ session, dispatch }: WorldDetailsProps) {
  const { state } = session;
  const hash = useMemo(() => hashState(state), [state]);
  const entity = selectedEntity(session);
  return (
    <>
      <dl className="inspector__list">
        <Row label="Revision">
          <span data-testid="world-revision">{state.header.revision}</span>
        </Row>
        <Row label="State hash">
          <code data-testid="world-hash">{hash}</code>
        </Row>
        <Row label="Entities">
          <span data-testid="world-entity-count">{state.entities.length}</span>
        </Row>
        <Row label="Bonds">{state.bonds.length}</Row>
        <Row label="World seed">{state.header.seed}</Row>
        <Row label="Commit log">{session.log.length === 1 ? "1 record" : `${session.log.length} records`}</Row>
      </dl>

      <section aria-label="Entities" className="inspector__section">
        <h4>Entities</h4>
        <ul className="catalog">
          {state.entities.map((candidate) => (
            <li key={candidate.id}>
              <button
                type="button"
                className="catalog__item world__entity"
                data-entity={candidate.id}
                aria-current={candidate.id === session.selected ? "true" : undefined}
                onClick={() => { dispatch({ type: "selectEntity", entity: candidate.id }); }}
              >
                <span className="catalog__id">{candidate.id}</span>
                <span className="catalog__name">{candidate.definition.id}</span>
                <span className="catalog__size">{candidate.owner.kind}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Selected entity" className="inspector__section">
        <h4>Selected entity</h4>
        <dl className="inspector__list">
          <Row label="Id">
            <code data-testid="world-entity-id">{entity?.id ?? "none"}</code>
          </Row>
          <Row label="Definition">{entity === undefined ? "—" : `${entity.definition.id}@${entity.definition.version}`}</Row>
          <Row label="Owner">
            <span data-testid="world-entity-owner">{entity?.owner.kind ?? "—"}</span>
          </Row>
        </dl>
        <div className="world__actions">
          <button type="button" data-testid="world-detach" disabled={!canDetach(session)} onClick={() => { dispatch({ type: "detach" }); }}>
            Detach
          </button>
          <button type="button" data-testid="world-attach" disabled={!canAttach(session)} onClick={() => { dispatch({ type: "attach" }); }}>
            Re-attach at previous pose
          </button>
        </div>
      </section>

      <section aria-label="Wind" className="inspector__section">
        <h4>Wind (windFold system)</h4>
        <div className="world__actions">
          <label>
            Strength{" "}
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              aria-label="Wind strength"
              data-testid="world-wind"
              value={session.wind}
              onChange={(event) => { dispatch({ type: "setWind", strength: Number(event.target.value) }); }}
            />
          </label>
          <output className="toolbar__value">{session.wind.toFixed(2)}</output>
          <button type="button" data-testid="world-apply-wind" onClick={() => { dispatch({ type: "applyWind" }); }}>
            Apply wind
          </button>
        </div>
      </section>

      <p data-testid="world-rejection" role="status" className={session.rejection === "" ? "muted" : "error"}>
        {session.rejection}
      </p>

      <section aria-label="Replay" className="inspector__section">
        <h4>Replay</h4>
        <div className="world__actions">
          <button type="button" data-testid="world-replay" onClick={() => { dispatch({ type: "replay" }); }}>
            Replay log
          </button>
          <code data-testid="world-replay-status">{session.replay}</code>
        </div>
      </section>

      <section aria-label="Look-dev" className="inspector__section">
        <h4>Look-dev</h4>
        <label className="look__check">
          <input
            type="checkbox"
            data-testid="world-offsets"
            checked={session.offsets}
            onChange={(event) => { dispatch({ type: "setOffsets", enabled: event.target.checked }); }}
          />
          Decorative offsets (look-dev)
        </label>
        <p className="muted">Derived from (seed, entity id); never stored and never hashed (ADR 0013).</p>
      </section>
    </>
  );
}
