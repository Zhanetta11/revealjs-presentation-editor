import { indexedDbAdapter } from "./indexedDbAdapter";
import { fileSystemAdapter } from "./fileSystemAdapter";
import { isElectron } from "../platform/electron";

export const storageAdapter = isElectron() ? fileSystemAdapter : indexedDbAdapter;
