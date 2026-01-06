import { Package } from './stores/vaultStore';

export class TypstWorkerClient {
  private worker: Worker;
  private requestIdCounter: number;
  private pendingTasks: Map<number, { resolve: Function; reject: Function }> =
    new Map();

  constructor() {
    this.worker = new Worker(new URL('./compiler.worker.ts', import.meta.url), {
      type: 'module',
    });
    this.requestIdCounter = 0;
    this.worker.postMessage({ type: 'INIT' });

    this.worker.onmessage = (event: MessageEvent<TypstResultMessage>) => {
      const { id, error, result } = event.data;
      const request = this.pendingTasks.get(id);

      if (request) {
        if (error) request.reject(error);
        else request.resolve(result);
        this.pendingTasks.delete(id);
      }
    };
  }

  async executeTask<T>(payload: TypstWorkerMessage): Promise<T> {
    const id = this.requestIdCounter + 1;
    this.requestIdCounter = this.requestIdCounter + 1;

    return new Promise((resolve, reject) => {
      this.pendingTasks.set(id, { resolve, reject });
      this.worker.postMessage({ ...payload, id });
    });
  }

  terminate() {
    this.worker.terminate();
  }
}

export type TypstWorkerMessage = { id?: number } & (
  | { type: 'INIT' }
  | { type: 'RENDER'; source: string; filePath: string; dpi: number }
  | { type: 'ADD_PACKAGE'; package: Package }
);

export type TypstResultMessage = {
  id: number;
  type: string;
  result: any;
  error: any;
};
