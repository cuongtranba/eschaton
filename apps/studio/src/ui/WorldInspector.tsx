import { useMemo } from "react";
import { hashState } from "@eschaton/world";
import { canAttach, canDetach, selectedEntity, WAVE_SIZES, type WaveSize, type WorldCommand, type WorldSession } from "../lab/world/session";
import { Row } from "./Row";

const SIZE_NAMES: readonly WaveSize[] = ["small", "medium", "large", "huge"];
const isWaveSize = (value: string): value is WaveSize => value in WAVE_SIZES;

type WorldDetailsProps = Readonly<{
  session: WorldSession;
  dispatch: (command: WorldCommand) => void;
}>;

export function WorldDetails({ session, dispatch }: WorldDetailsProps) {
  const { state } = session;
  const hash = useMemo(() => hashState(state), [state]);
  const entity = selectedEntity(session);
  const { wave } = session;
  const solving = wave.status === "solving";
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

      {session.presentation.study === undefined ? null : (
        <section aria-label="Rebuild study" className="inspector__section" data-testid="world-study">
          <h4>Rebuild study (ADR 0013)</h4>
          <dl className="inspector__list">
            <Row label="Cell size">{session.presentation.study.cellSize} units</Row>
            <Row label="Logical">{session.presentation.study.logical}</Row>
            <Row label="Fragments">{session.presentation.study.fragments}</Row>
            <Row label="Rejected">{session.presentation.study.rejected.length}</Row>
            <Row label="Moved">{session.presentation.study.moved.length}</Row>
          </dl>
          <ul className="muted">
            {session.presentation.study.notReproduced.map((line) => (
              <li key={line}>Not reproduced: {line}</li>
            ))}
          </ul>
        </section>
      )}

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

      <section aria-label="Wave" className="inspector__section">
        <h4>Wave (region solve in a worker)</h4>
        <div className="world__actions">
          <label>
            X{" "}
            <input type="number" className="toolbar__seed" aria-label="Region X" data-testid="wave-x" value={wave.x} disabled={solving} onChange={(event) => { dispatch({ type: "waveSet", x: Number(event.target.value) }); }} />
          </label>
          <label>
            Z{" "}
            <input type="number" className="toolbar__seed" aria-label="Region Z" data-testid="wave-z" value={wave.z} disabled={solving} onChange={(event) => { dispatch({ type: "waveSet", z: Number(event.target.value) }); }} />
          </label>
          <label>
            Size{" "}
            <select aria-label="Region size" data-testid="wave-size" value={wave.size} disabled={solving} onChange={(event) => { if (isWaveSize(event.target.value)) dispatch({ type: "waveSet", size: event.target.value }); }}>
              {SIZE_NAMES.map((name) => (
                <option key={name} value={name}>
                  {WAVE_SIZES[name].join("×")}
                </option>
              ))}
            </select>
          </label>
          <label>
            Seed{" "}
            <input type="number" className="toolbar__seed" aria-label="Wave seed" data-testid="wave-seed" min={0} value={wave.seed} disabled={solving} onChange={(event) => { dispatch({ type: "waveSet", seed: Number(event.target.value) }); }} />
          </label>
        </div>
        <div className="world__actions">
          <button type="button" data-testid="wave-solve" disabled={solving} onClick={() => { dispatch({ type: "waveStart" }); }}>
            Solve region
          </button>
          <button type="button" data-testid="wave-cancel" disabled={!solving} onClick={() => { dispatch({ type: "waveCancel" }); }}>
            Cancel
          </button>
          <code data-testid="wave-status">{wave.status}</code>
        </div>
        <p data-testid="wave-progress" role="status" className="muted">
          {solving ? `Preview, not part of the world: ${wave.progress}` : wave.detail}
        </p>
        <p className="muted">Existing pieces in the region are pins. The result is committed once, atomically, only if the region did not change meanwhile.</p>
      </section>

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
