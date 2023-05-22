import { JSONObject, JSONValue } from "./json-types";

export type Permission = "r" | "w" | "rw" | "none";

export interface IStore {
  defaultPolicy: Permission;
  allowedToRead(key: string): boolean;
  allowedToWrite(key: string): boolean;
  read(path: string): any;
  write(path: string, value: JSONValue): JSONValue | IStore;
  writeEntries(entries: JSONObject): void;
  entries(): JSONObject;
}

export function Restrict(...params: any): any {
  throw new Error("Method not implemented.");
}

export class Store implements IStore {
  defaultPolicy: Permission = "rw";

  allowedToRead(key: string): boolean {
    throw new Error("Method not implemented.");
  }

  allowedToWrite(key: string): boolean {
    throw new Error("Method not implemented.");
  }

  read(path: string): any {
    throw new Error("Method not implemented.");
  }

  write(path: string, value: JSONValue): JSONValue | IStore {
    throw new Error("Method not implemented.");
  }

  writeEntries(entries: JSONObject): void {
    throw new Error("Method not implemented.");
  }

  entries(): JSONObject {
    throw new Error("Method not implemented.");
  }
}
