import { browserDownload } from "./browserDownload";
import { electronDownload } from "./electronDownload";
import { isElectron } from "../platform/electron";

export const downloadBackend = isElectron() ? electronDownload : browserDownload;
