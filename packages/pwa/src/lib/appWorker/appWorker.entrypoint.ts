import { AppWorkerService } from "./AppWorkerService.ts";
import { WorkerAdapter, type WorkerEndpoint } from "./WorkerAdapter.ts";
import { defineAppWorkerProvider } from "./proxy.ts";

const provideAppWorker = defineAppWorkerProvider(() => new AppWorkerService());

provideAppWorker(new WorkerAdapter(self as unknown as WorkerEndpoint, "app-worker"));
