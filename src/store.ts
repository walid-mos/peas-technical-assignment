import { JSONArray, JSONObject, JSONPrimitive } from "./json-types";

export type Permission = "r" | "w" | "rw" | "none";

export type StoreResult = Store | JSONPrimitive | undefined;

export type StoreValue =
  | JSONObject
  | JSONArray
  | StoreResult
  | (() => StoreResult);

export interface IStore {
  defaultPolicy: Permission;
  data: Map<unknown, StoreValue>
  allowedToRead(key: string): boolean;
  allowedToWrite(key: string): boolean;
  read(path: string): StoreResult;
  write(path: string, value: StoreValue): StoreValue;
  writeEntries(entries: JSONObject): void;
  entries(): JSONObject;
}

const restrictedMap: Map<unknown, Permission> = new Map()
const readPermission: Array<Permission> = ["r", "rw"]
const writePermission: Array<Permission> = ["w", "rw"]

export function Restrict(permission: Permission = "none"): Function {
    return function (target: unknown, propertyKey: string) {
        restrictedMap.set([target, propertyKey], permission)   
    }
}

export class Store implements IStore {
  defaultPolicy = "rw" as const
  data = new Map()

  allowedToRead(key: string): boolean {
    if (!readPermission.includes(this.defaultPolicy)) return false

    const specificPermissions = restrictedMap.get([this, key]) as Permission
    const isAllowed = !specificPermissions || readPermission.includes(specificPermissions)

    return isAllowed
  }

  allowedToWrite(key: string): boolean {
    if (!writePermission.includes(this.defaultPolicy)) return false

    const specificPermissions = restrictedMap.get([this, key]) as Permission
    const isAllowed = !specificPermissions || writePermission.includes(specificPermissions)

    return isAllowed
  }

  read(path: string): StoreResult {
    if (!this.allowedToRead(path)) throw new Error()

    return this.data.get(path)
  }

  write(path: string, value: StoreValue): StoreValue {
    if (!this.allowedToWrite(path)) throw new Error()

    this.data.set(path, value)
    return this.data.get(path)
  }

  writeEntries(entries: JSONObject): void {
    throw new Error("Method not implemented.");
  }

  entries(): JSONObject {
    throw new Error("Method not implemented.");
  }
}
