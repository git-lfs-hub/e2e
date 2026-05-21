import { encryptCode } from "../server/src/login/utils";

const token = process.env.GH_PAT;
const secret = process.env.LOGIN_SECRET;
if (!token || !secret) throw new Error("GH_PAT and LOGIN_SECRET required");

process.stdout.write(await encryptCode({ token }, secret, 86400));
