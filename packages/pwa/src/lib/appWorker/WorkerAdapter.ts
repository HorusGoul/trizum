import type { Adapter, OnMessage, SendMessage } from "comctx";

export type WorkerEndpoint = {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  addEventListener(type: "message", listener: (event: MessageEvent) => void): void;
  removeEventListener(type: "message", listener: (event: MessageEvent) => void): void;
};

export class WorkerAdapter implements Adapter {
  constructor(
    private readonly worker: WorkerEndpoint,
    public readonly name?: string,
  ) {}

  sendMessage: SendMessage = (message, transfer) => {
    this.worker.postMessage(message, transfer);
  };

  onMessage: OnMessage = (callback) => {
    const handler = (event: MessageEvent) => callback(event.data);
    this.worker.addEventListener("message", handler);

    return () => this.worker.removeEventListener("message", handler);
  };
}
