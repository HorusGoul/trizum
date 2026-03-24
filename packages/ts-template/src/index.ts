import { rootLogger } from "./log.ts";

export function helloWorld() {
  rootLogger.info("Hello world!");
}
