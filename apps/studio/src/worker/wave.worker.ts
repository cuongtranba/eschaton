import { createWaveHost, type HostRequest, type HostResponse } from "@eschaton/wave";

type WorkerScope = { postMessage: (message: HostResponse) => void; onmessage: ((event: MessageEvent<HostRequest>) => void) | null };

const isWorkerScope = (value: unknown): value is WorkerScope => typeof value === "object" && value !== null && "postMessage" in value;

const scope: unknown = globalThis;
if (isWorkerScope(scope)) {
  const host = createWaveHost({
    post: (message) => { scope.postMessage(message); },
    schedule: (task) => { setTimeout(task, 0); },
  });
  scope.onmessage = (event) => { host.receive(event.data); };
}
