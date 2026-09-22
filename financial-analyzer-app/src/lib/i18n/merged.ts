import { ar as arBase, en as enBase, fr as frBase } from "./dictionaries";
import { ar as arExtra, en as enExtra, fr as frExtra } from "./app-strings";

export const en = { ...enBase, ...enExtra } as const;
export const fr = { ...frBase, ...frExtra } as const;
export const ar = { ...arBase, ...arExtra } as const;
