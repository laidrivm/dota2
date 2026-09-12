/**
 * The repository root, for the files in `checks/` that read artefacts of it.
 *
 * One module rather than the line each of them carried: fourteen copies of a
 * path relative to this directory is fourteen places to correct if `checks/`
 * ever moves, and a copy left behind would still resolve — to the wrong tree,
 * silently, which is the failure a check cannot report on itself.
 *
 * From this module's own directory rather than the working directory, so a
 * case resolves the same artefacts whichever directory `bun test` ran in.
 */
import { join } from "node:path";

export const root = join(import.meta.dir, "..");
