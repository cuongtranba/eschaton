import { createGenesisHost, type GenesisRequest, type GenesisResponse } from "@eschaton/genesis";

type WorkerScope = { postMessage: (message: GenesisResponse) => void; onmessage: ((event: MessageEvent<GenesisRequest>) => void) | null };

const isWorkerScope = (value: unknown): value is WorkerScope => typeof value === "object" && value !== null && "postMessage" in value;

const scope: unknown = globalThis;
if (isWorkerScope(scope)) {
  // A message channel yields to pending messages (such as cancel) without the 4 ms clamp of nested timers.
  const channel = new MessageChannel();
  const tasks: (() => void)[] = [];
  channel.port1.onmessage = () => { tasks.shift()?.(); };
  const host = createGenesisHost({
    post: (message) => { scope.postMessage(message); },
    schedule: (task) => {
      tasks.push(task);
      channel.port2.postMessage(0);
    },
    now: () => performance.now(),
  });
  scope.onmessage = (event) => { host.receive(event.data); };
}
