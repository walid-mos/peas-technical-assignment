import { JSONArray, JSONObject, JSONPrimitive, JSONValue } from "./json-types";
import { lazy } from "./lazy";

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

const buildKey = (store: string, key: string) => `${store}:${key}` 

export function Restrict(permission: Permission = "none", restrictPath?: unknown): Function {
    if (restrictPath) restrictedMap.set(restrictPath, permission)

    return function (target: unknown, propertyKey: string) {
        if (!target?.constructor.name) return
        const key = buildKey(target.constructor.name, propertyKey)
        restrictedMap.set(key, permission)   
    }
}

export class Store implements IStore {
  defaultPolicy: Permission = "rw" 
  data = new Map()

  allowedToRead(key: string): boolean {
    const specificPermissions: Permission = restrictedMap.get(buildKey(this.constructor.name, key))!
    const isSpecificPermission = specificPermissions ? readPermission.includes(specificPermissions) : undefined
    const isDefaultPermission = readPermission.includes(this.defaultPolicy)
    const isAllowed = isSpecificPermission ?? isDefaultPermission

    return isAllowed
  }

  allowedToWrite(key: string): boolean {
    const specificPermissions: Permission = restrictedMap.get(buildKey(this.constructor.name, key))!
    const isSpecificPermission = specificPermissions ? writePermission.includes(specificPermissions) : undefined
    const isDefaultPermission = writePermission.includes(this.defaultPolicy)
    const isAllowed = isSpecificPermission ?? isDefaultPermission

    return isAllowed
  }

  read(path: string): StoreResult {
    const [firstKey, ...childKeys] = path.split(':') 
    if (!firstKey || !this.allowedToRead(firstKey)) throw new Error()

    let value = this.data.get(firstKey)
    
    if (!value && firstKey in this) {
        value = this[firstKey as keyof this]
        this.data.set(firstKey, value)
    }

    if (typeof value === "function") {
        value = value()
    }

    if (value instanceof Store && childKeys.length > 0) {
        return value.read(childKeys.join(':'))
    }

    return value
  }

  write(path: string, value: StoreValue): StoreValue {
    const [firstKey, ...childKeys] = path.split(':') 
    if (!firstKey || !this.allowedToWrite(firstKey)) throw new Error()

    if (childKeys.length > 0) {
        let nestedStore = this.read(firstKey)
        if (!(nestedStore instanceof Store)) {
            nestedStore = new Store()
            this.data.set(firstKey, nestedStore)
        }
        return nestedStore.write(childKeys.join(':'), value)
    }
        
    this.data.set(path, value)
    return this.data.get(path)
  }

  writeEntries(entries: JSONObject): void {
    for (const entry of Object.entries(entries)) {
        const [key, value] = entry
        let store: Store = this
        if (typeof value === "object" && !Array.isArray(value) && value !== null) {
            store = new Store()
            this.write(key, store)
            return store.writeEntries(value)
        }
        store.write(key, value)
    }
  }

  entries(): JSONObject {
    const values: JSONObject = {}

    for (const entry of Object.entries(this)) {
      const [key, value] = entry
      if (this.allowedToRead(key)) {
        values[key] = value
      }
    }

    return values
  }
}
