import { AppWorkerService } from "./AppWorkerService.ts";
import { WorkerAdapter, type WorkerEndpoint } from "./WorkerAdapter.ts";
import { defineAppWorkerProvider } from "./proxy.ts";

const provideAppWorker = defineAppWorkerProvider(() => new AppWorkerService());

// This module runs in the app worker, whose endpoint differs from the window global.
declare const self: WorkerEndpoint;

provideAppWorker(new WorkerAdapter(self, "app-worker"));
