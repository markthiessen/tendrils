import { TendrilsError } from "../errors.js";
import { success, errorEnvelope } from "./json.js";

export { renderTable, renderKeyValue } from "./table.js";
export { success, errorEnvelope } from "./json.js";

export interface OutputContext {
  json: boolean;
  quiet: boolean;
}

export function outputSuccess<T>(
  ctx: OutputContext,
  data: T,
  humanText: string,
  message?: string,
): void {
  if (ctx.json) {
    console.log(JSON.stringify(success(data, message)));
  } else if (!ctx.quiet) {
    console.log(humanText);
  }
}

export function outputError(ctx: OutputContext, err: TendrilsError): void {
  if (ctx.json) {
    console.error(JSON.stringify(errorEnvelope(err)));
  } else {
    console.error(`Error: ${err.message}`);
  }
}
