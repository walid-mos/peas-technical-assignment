import type { JSONArray, JSONObject, JSONPrimitive } from './json-types'

export type Permission = 'r' | 'w' | 'rw' | 'none'

export type StoreResult = Store | JSONPrimitive | undefined

export type StoreValue = JSONObject | JSONArray | StoreResult | (() => StoreResult)

export interface IStore {
	defaultPolicy: Permission
	data: Map<unknown, StoreValue>
	allowedToRead(key: string): boolean
	allowedToWrite(key: string): boolean
	read(path: string): StoreResult
	write(path: string, value: StoreValue): StoreValue
	writeEntries(entries: JSONObject): void
	entries(): JSONObject
}

const restrictedMap: Map<unknown, Permission> = new Map()
const readPermissions: Array<Permission> = ['r', 'rw']
const writePermissions: Array<Permission> = ['w', 'rw']

const buildKey = (store: string, key: string | symbol) => `${store}:${key.toString()}`

function findPermission(instance: Store, key: string): Permission | undefined {
	let currentClass = instance.constructor

	while (currentClass?.name && currentClass.name !== 'Object') {
		const permission = restrictedMap.get(buildKey(currentClass.name, key))
		if (permission !== undefined) return permission

		currentClass = Object.getPrototypeOf(currentClass)
		if (currentClass?.name === 'Store') {
			return restrictedMap.get(buildKey('Store', key))
		}
	}
	return undefined
}

export function Restrict(
	permission: Permission = 'none',
	restrictPath?: unknown
): PropertyDecorator {
	if (restrictPath) restrictedMap.set(restrictPath, permission)

	return (target: unknown, propertyKey: string | symbol) => {
		if (!target?.constructor.name) return
		const key = buildKey(target.constructor.name, propertyKey)
		restrictedMap.set(key, permission)
	}
}

export class Store implements IStore {
	defaultPolicy: Permission = 'rw'
	data = new Map()

	allowedToRead(key: string): boolean {
		const specificPermission = findPermission(this, key)
		if (specificPermission !== undefined) {
			return readPermissions.includes(specificPermission)
		}
		return readPermissions.includes(this.defaultPolicy)
	}

	allowedToWrite(key: string): boolean {
		const permission = findPermission(this, key)
		if (permission !== undefined) {
			return writePermissions.includes(permission)
		}
		return writePermissions.includes(this.defaultPolicy)
	}

	read(path: string): StoreResult {
		const [firstKey, ...childKeys] = path.split(':')
		if (!firstKey || !this.allowedToRead(firstKey)) throw new Error()

		let value = this.data.get(firstKey)

		if (!value && firstKey in this) {
			value = this[firstKey as keyof this]
			this.data.set(firstKey, value)
		}

		if (typeof value === 'function') {
			value = value()
		}

		if (value instanceof Store && childKeys.length > 0) {
			return value.read(childKeys.join(':'))
		}

		return value
	}

	write(path: string, value: StoreValue): StoreValue {
		const [firstKey, ...childKeys] = path.split(':')

		if (childKeys.length > 0) {
			if (!firstKey || !this.allowedToRead(firstKey)) throw new Error()
			let nestedStore = this.read(firstKey)
			if (!(nestedStore instanceof Store)) {
				nestedStore = new Store()
				this.data.set(firstKey, nestedStore)
			}
			return nestedStore.write(childKeys.join(':'), value)
		}

		if (!firstKey || !this.allowedToWrite(firstKey)) throw new Error()

		if (value?.constructor === Object) {
			const nestedStore = new Store()
			nestedStore.writeEntries(value as JSONObject)
			value = nestedStore
		}

		this.data.set(firstKey, value)
		return value
	}

	writeEntries(entries: JSONObject): void {
		for (const entry of Object.entries(entries)) {
			const [key, value] = entry
			let store: Store = this
			if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
				store = new Store()
				this.write(key, store)
				store.writeEntries(value)
			} else {
				store.write(key, value)
			}
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
