/**
 * Unit Tests for store.ts
 *
 * These tests focus on isolated unit testing of the Store class,
 * using proper mocking and avoiding integration with UserStore/AdminStore.
 */

import type { JSONObject } from '../src/json-types'
import {
	buildKey,
	findPermission,
	type Permission,
	Restrict,
	restrictedMap,
	Store,
} from '../src/store'

// ============================================================================
// Setup & Cleanup
// ============================================================================

describe('Store Unit Tests - Setup & Cleanup', () => {
	beforeEach(() => {
		// Critical: Clear the global restrictedMap to prevent test interference
		restrictedMap.clear()
		// Clear all mocks between tests
		jest.clearAllMocks()
	})

	afterEach(() => {
		// Ensure clean state after each test
		jest.restoreAllMocks()
	})

	it('should have clean restrictedMap before each test', () => {
		expect(restrictedMap.size).toBe(0)
	})
})

// ============================================================================
// 1. Helper Functions
// ============================================================================

describe('Helper Functions - buildKey()', () => {
	beforeEach(() => {
		restrictedMap.clear()
		jest.clearAllMocks()
	})

	it('should build key from store name and string key', () => {
		const result = buildKey('TestStore', 'propertyName')
		expect(result).toBe('TestStore:propertyName')
	})

	it('should build key from store name and symbol key', () => {
		const symbolKey = Symbol('testSymbol')
		const result = buildKey('TestStore', symbolKey)
		expect(result).toContain('TestStore:')
		expect(result).toContain('testSymbol')
	})

	it('should convert symbol to string correctly', () => {
		const symbolKey = Symbol.for('globalSymbol')
		const result = buildKey('Store', symbolKey)
		expect(typeof result).toBe('string')
		expect(result).toMatch(/^Store:/)
	})
})

describe('Helper Functions - findPermission()', () => {
	beforeEach(() => {
		restrictedMap.clear()
		jest.clearAllMocks()
	})

	it('should find permission in current class', () => {
		class TestStore extends Store {}
		const instance = new TestStore()
		const key = buildKey('TestStore', 'testProp')
		restrictedMap.set(key, 'r')

		const result = findPermission(instance, 'testProp')
		expect(result).toBe('r')
	})

	it('should traverse prototype chain to find permission', () => {
		class ParentStore extends Store {}
		class ChildStore extends ParentStore {}
		const instance = new ChildStore()

		const parentKey = buildKey('ParentStore', 'inheritedProp')
		restrictedMap.set(parentKey, 'rw')

		const result = findPermission(instance, 'inheritedProp')
		expect(result).toBe('rw')
	})

	it('should fallback to Store base class', () => {
		class CustomStore extends Store {}
		const instance = new CustomStore()

		const storeKey = buildKey('Store', 'baseProp')
		restrictedMap.set(storeKey, 'w')

		const result = findPermission(instance, 'baseProp')
		expect(result).toBe('w')
	})

	it('should return undefined when permission not found', () => {
		const instance = new Store()
		const result = findPermission(instance, 'nonExistentKey')
		expect(result).toBeUndefined()
	})

	it('should stop traversal at Object in prototype chain', () => {
		const instance = new Store()
		const result = findPermission(instance, 'toString') // Object method
		expect(result).toBeUndefined()
	})
})

// ============================================================================
// 2. @Restrict Decorator
// ============================================================================

describe('@Restrict Decorator', () => {
	beforeEach(() => {
		restrictedMap.clear()
		jest.clearAllMocks()
	})

	it('should set permission in restrictedMap', () => {
		// biome-ignore lint/correctness/noUnusedVariables: Class is used via decorator
		class TestStore extends Store {
			@Restrict('r')
			public testProp?: string
		}

		const key = buildKey('TestStore', 'testProp')
		expect(restrictedMap.has(key)).toBe(true)
		expect(restrictedMap.get(key)).toBe('r')
	})

	it('should default to "none" when no permission provided', () => {
		// biome-ignore lint/correctness/noUnusedVariables: Class is used via decorator
		class TestStore extends Store {
			@Restrict()
			public restrictedProp?: string
		}

		const key = buildKey('TestStore', 'restrictedProp')
		expect(restrictedMap.get(key)).toBe('none')
	})

	it('should handle restrictPath parameter', () => {
		const customPath = 'custom:path:key'
		Restrict('rw', customPath)

		expect(restrictedMap.has(customPath)).toBe(true)
		expect(restrictedMap.get(customPath)).toBe('rw')
	})

	it('should work with symbol property keys', () => {
		const symbolProp = Symbol('symbolProp')

		// biome-ignore lint/correctness/noUnusedVariables: Class is used via decorator
		class TestStore extends Store {
			@Restrict('w')
			public [symbolProp]?: string
		}

		// Should create a key in restrictedMap
		expect(restrictedMap.size).toBeGreaterThan(0)
	})

	it('should skip if target.constructor.name is undefined', () => {
		const decorator = Restrict('r')
		const target = { constructor: {} } // No name property

		// Should not throw
		expect(() => decorator(target, 'prop')).not.toThrow()
	})

	it('should allow dynamic permission changes', () => {
		// biome-ignore lint/correctness/noUnusedVariables: Class is used via decorator
		class TestStore extends Store {
			@Restrict('r')
			public dynamicProp?: string
		}

		const key = buildKey('TestStore', 'dynamicProp')
		expect(restrictedMap.get(key)).toBe('r')

		// Change permission
		restrictedMap.set(key, 'rw')
		expect(restrictedMap.get(key)).toBe('rw')
	})

	it('should handle all permission types', () => {
		const permissions: Permission[] = ['r', 'w', 'rw', 'none']

		permissions.forEach((perm, index) => {
			class TestStore extends Store {
				public testProp?: string
			}
			const key = buildKey('TestStore', `prop${index}`)
			Restrict(perm)(TestStore.prototype, `prop${index}`)
			expect(restrictedMap.get(key)).toBe(perm)
		})
	})
})

// ============================================================================
// 3. Store Construction & Initialization
// ============================================================================

describe('Store - Construction & Initialization', () => {
	beforeEach(() => {
		restrictedMap.clear()
		jest.clearAllMocks()
	})

	it('should initialize with empty Map', () => {
		const store = new Store()
		expect(store.data).toBeInstanceOf(Map)
		expect(store.data.size).toBe(0)
	})

	it('should have defaultPolicy set to "rw"', () => {
		const store = new Store()
		expect(store.defaultPolicy).toBe('rw')
	})

	it('should allow custom defaultPolicy', () => {
		class CustomStore extends Store {
			public defaultPolicy: Permission = 'r'
		}
		const store = new CustomStore()
		expect(store.defaultPolicy).toBe('r')
	})

	it('data should be a Map instance', () => {
		const store = new Store()
		expect(store.data).toBeInstanceOf(Map)
	})

	it('should not share data between instances', () => {
		const store1 = new Store()
		const store2 = new Store()

		store1.data.set('key', 'value1')
		store2.data.set('key', 'value2')

		expect(store1.data.get('key')).toBe('value1')
		expect(store2.data.get('key')).toBe('value2')
	})
})

// ============================================================================
// 4. Permission System (allowedToRead / allowedToWrite)
// ============================================================================

describe('Permission System - allowedToRead()', () => {
	beforeEach(() => {
		restrictedMap.clear()
		jest.clearAllMocks()
	})

	it('should use defaultPolicy when no specific permission', () => {
		const store = new Store()
		store.defaultPolicy = 'rw'

		expect(store.allowedToRead('anyKey')).toBe(true)

		store.defaultPolicy = 'none'
		expect(store.allowedToRead('anyKey')).toBe(false)
	})

	it('should return true for "r" permission', () => {
		class TestStore extends Store {
			@Restrict('r')
			public readOnlyProp?: string
		}
		const store = new TestStore()
		expect(store.allowedToRead('readOnlyProp')).toBe(true)
	})

	it('should return true for "rw" permission', () => {
		class TestStore extends Store {
			@Restrict('rw')
			public readWriteProp?: string
		}
		const store = new TestStore()
		expect(store.allowedToRead('readWriteProp')).toBe(true)
	})

	it('should return false for "w" permission', () => {
		class TestStore extends Store {
			@Restrict('w')
			public writeOnlyProp?: string
		}
		const store = new TestStore()
		expect(store.allowedToRead('writeOnlyProp')).toBe(false)
	})

	it('should return false for "none" permission', () => {
		class TestStore extends Store {
			@Restrict('none')
			public restrictedProp?: string
		}
		const store = new TestStore()
		expect(store.allowedToRead('restrictedProp')).toBe(false)
	})

	it('should delegate to findPermission for specific permissions', () => {
		class TestStore extends Store {
			@Restrict('r')
			public specificProp?: string
		}
		const store = new TestStore()

		// Specific permission should override default
		expect(store.allowedToRead('specificProp')).toBe(true)

		// Non-specific should use default
		expect(store.allowedToRead('otherKey')).toBe(true)
	})
})

describe('Permission System - allowedToWrite()', () => {
	beforeEach(() => {
		restrictedMap.clear()
		jest.clearAllMocks()
	})

	it('should use defaultPolicy when no specific permission', () => {
		const store = new Store()
		store.defaultPolicy = 'rw'

		expect(store.allowedToWrite('anyKey')).toBe(true)

		store.defaultPolicy = 'r'
		expect(store.allowedToWrite('anyKey')).toBe(false)
	})

	it('should return true for "w" permission', () => {
		class TestStore extends Store {
			@Restrict('w')
			public writeOnlyProp?: string
		}
		const store = new TestStore()
		expect(store.allowedToWrite('writeOnlyProp')).toBe(true)
	})

	it('should return true for "rw" permission', () => {
		class TestStore extends Store {
			@Restrict('rw')
			public readWriteProp?: string
		}
		const store = new TestStore()
		expect(store.allowedToWrite('readWriteProp')).toBe(true)
	})

	it('should return false for "r" permission', () => {
		class TestStore extends Store {
			@Restrict('r')
			public readOnlyProp?: string
		}
		const store = new TestStore()
		expect(store.allowedToWrite('readOnlyProp')).toBe(false)
	})

	it('should return false for "none" permission', () => {
		class TestStore extends Store {
			@Restrict('none')
			public restrictedProp?: string
		}
		const store = new TestStore()
		expect(store.allowedToWrite('restrictedProp')).toBe(false)
	})

	it('should delegate to findPermission for specific permissions', () => {
		class TestStore extends Store {
			@Restrict('w')
			public specificProp?: string
		}
		const store = new TestStore()

		// Specific permission should override default
		expect(store.allowedToWrite('specificProp')).toBe(true)

		// Non-specific should use default
		expect(store.allowedToWrite('otherKey')).toBe(true)
	})
})

// ============================================================================
// 5. Read Operations
// ============================================================================

describe('Read Operations - Simple Cases', () => {
	beforeEach(() => {
		restrictedMap.clear()
		jest.clearAllMocks()
	})

	it('should read value from data Map', () => {
		const store = new Store()
		store.data.set('key', 'value')

		expect(store.read('key')).toBe('value')
	})

	it('should throw Error when not allowed to read', () => {
		const store = new Store()
		store.defaultPolicy = 'none'

		expect(() => store.read('restrictedKey')).toThrow(Error)
	})

	it('should return undefined for non-existent key', () => {
		const store = new Store()

		const result = store.read('nonExistent')
		expect(result).toBeUndefined()
	})

	it('should fallback to instance property if not in Map', () => {
		class TestStore extends Store {
			public instanceProp = 'instanceValue'
		}
		const store = new TestStore()

		expect(store.read('instanceProp')).toBe('instanceValue')
	})

	it('should cache instance property in Map after first read', () => {
		class TestStore extends Store {
			public instanceProp = 'instanceValue'
		}
		const store = new TestStore()

		store.read('instanceProp')

		expect(store.data.has('instanceProp')).toBe(true)
		expect(store.data.get('instanceProp')).toBe('instanceValue')
	})
})

describe('Read Operations - Function Values (Lazy Evaluation)', () => {
	beforeEach(() => {
		restrictedMap.clear()
		jest.clearAllMocks()
	})

	it('should execute function and return result', () => {
		const store = new Store()
		const mockFn = jest.fn(() => 'computed value')
		store.data.set('lazyKey', mockFn)

		const result = store.read('lazyKey')

		expect(mockFn).toHaveBeenCalledTimes(1)
		expect(result).toBe('computed value')
	})

	it('should execute function only when needed', () => {
		const store = new Store()
		const mockFn = jest.fn(() => 'value')
		store.data.set('lazyKey', mockFn)

		store.read('lazyKey')

		expect(mockFn).toHaveBeenCalledTimes(1)
	})

	it('should handle function returning primitive', () => {
		const store = new Store()
		store.data.set('numberKey', () => 42)
		store.data.set('boolKey', () => true)
		store.data.set('nullKey', () => null)

		expect(store.read('numberKey')).toBe(42)
		expect(store.read('boolKey')).toBe(true)
		expect(store.read('nullKey')).toBe(null)
	})

	it('should handle function returning Store', () => {
		const store = new Store()
		const nestedStore = new Store()
		nestedStore.data.set('nested', 'nestedValue')

		store.data.set('storeKey', () => nestedStore)

		const result = store.read('storeKey')
		expect(result).toBeInstanceOf(Store)
		expect(result).toBe(nestedStore)
	})
})

describe('Read Operations - Nested Paths', () => {
	beforeEach(() => {
		restrictedMap.clear()
		jest.clearAllMocks()
	})

	it('should split path by ":" correctly', () => {
		const store = new Store()
		const nestedStore = new Store()
		nestedStore.data.set('child', 'childValue')
		store.data.set('parent', nestedStore)

		expect(store.read('parent:child')).toBe('childValue')
	})

	it('should read from nested Store', () => {
		const store = new Store()
		const nestedStore = new Store()
		nestedStore.data.set('key', 'nestedValue')
		store.data.set('nested', nestedStore)

		expect(store.read('nested:key')).toBe('nestedValue')
	})

	it('should throw if parent key not readable', () => {
		const store = new Store()
		store.defaultPolicy = 'none'

		expect(() => store.read('restricted:child')).toThrow(Error)
	})

	it('should handle multi-level nesting (a:b:c:d)', () => {
		const store = new Store()
		const level1 = new Store()
		const level2 = new Store()
		const level3 = new Store()

		level3.data.set('deep', 'deepValue')
		level2.data.set('c', level3)
		level1.data.set('b', level2)
		store.data.set('a', level1)

		expect(store.read('a:b:c:deep')).toBe('deepValue')
	})

	it('should recursively call read() on nested Store', () => {
		const store = new Store()
		const nestedStore = new Store()
		const readSpy = jest.spyOn(nestedStore, 'read')

		nestedStore.data.set('child', 'value')
		store.data.set('parent', nestedStore)

		store.read('parent:child')

		expect(readSpy).toHaveBeenCalledWith('child')
		readSpy.mockRestore()
	})
})

describe('Read Operations - Edge Cases', () => {
	beforeEach(() => {
		restrictedMap.clear()
		jest.clearAllMocks()
	})

	it('should throw for empty path', () => {
		const store = new Store()

		expect(() => store.read('')).toThrow(Error)
	})

	it('should throw for undefined firstKey after split', () => {
		const store = new Store()

		expect(() => store.read(':child')).toThrow(Error)
	})

	it('should handle nested path on non-Store value gracefully', () => {
		const store = new Store()
		store.data.set('primitive', 'string value')

		// Returns the primitive value when nested path is used on non-Store
		const result = store.read('primitive:nonexistent')
		expect(result).toBe('string value')
	})
})

// ============================================================================
// 6. Write Operations
// ============================================================================

describe('Write Operations - Simple Cases', () => {
	beforeEach(() => {
		restrictedMap.clear()
		jest.clearAllMocks()
	})

	it('should write value to data Map', () => {
		const store = new Store()

		store.write('key', 'value')

		expect(store.data.get('key')).toBe('value')
	})

	it('should throw Error when not allowed to write', () => {
		const store = new Store()
		store.defaultPolicy = 'r'

		expect(() => store.write('readOnlyKey', 'value')).toThrow(Error)
	})

	it('should overwrite existing value', () => {
		const store = new Store()
		store.data.set('key', 'oldValue')

		store.write('key', 'newValue')

		expect(store.data.get('key')).toBe('newValue')
	})

	it('should return the written value', () => {
		const store = new Store()

		const result = store.write('key', 'value')

		expect(result).toBe('value')
	})

	it('should set value in Map, not as instance property', () => {
		const store = new Store()

		store.write('key', 'value')

		expect(store.data.has('key')).toBe(true)
		// Key should not be added as instance property
		expect(Object.hasOwn(store, 'key')).toBe(false)
	})
})

describe('Write Operations - Object Auto-Conversion', () => {
	beforeEach(() => {
		restrictedMap.clear()
		jest.clearAllMocks()
	})

	it('should convert plain Object to Store', () => {
		const store = new Store()
		const plainObject = { a: 'valueA', b: 'valueB' }

		store.write('key', plainObject)

		const result = store.data.get('key')
		expect(result).toBeInstanceOf(Store)
	})

	it('should NOT convert arrays to Store', () => {
		const store = new Store()
		const array = ['value1', 'value2']

		store.write('key', array)

		const result = store.data.get('key')
		expect(result).not.toBeInstanceOf(Store)
		expect(Array.isArray(result)).toBe(true)
	})

	it('should NOT convert null to Store', () => {
		const store = new Store()

		store.write('key', null)

		expect(store.data.get('key')).toBeNull()
	})

	it('should call writeEntries on converted Store', () => {
		const store = new Store()
		const plainObject = { a: 'valueA' }
		const writeEntriesSpy = jest.spyOn(Store.prototype, 'writeEntries')

		store.write('key', plainObject)

		expect(writeEntriesSpy).toHaveBeenCalledWith(plainObject)
		writeEntriesSpy.mockRestore()
	})

	it('should verify object constructor is Object', () => {
		const store = new Store()

		class CustomClass {
			public prop = 'value'
		}
		const customInstance = new CustomClass()

		store.write('key', customInstance)

		// Should NOT convert custom class to Store
		const result = store.data.get('key')
		expect(result).not.toBeInstanceOf(Store)
	})
})

describe('Write Operations - Nested Paths', () => {
	beforeEach(() => {
		restrictedMap.clear()
		jest.clearAllMocks()
	})

	it('should write to existing nested Store', () => {
		const store = new Store()
		const nestedStore = new Store()
		store.data.set('parent', nestedStore)

		store.write('parent:child', 'childValue')

		expect(nestedStore.data.get('child')).toBe('childValue')
	})

	it('should create new Store if nested path does not exist', () => {
		const store = new Store()

		store.write('parent:child', 'childValue')

		const parent = store.data.get('parent')
		expect(parent).toBeInstanceOf(Store)
		expect((parent as Store).data.get('child')).toBe('childValue')
	})

	it('should throw if parent key not readable', () => {
		const store = new Store()
		store.defaultPolicy = 'none'

		expect(() => store.write('restricted:child', 'value')).toThrow(Error)
	})

	it('should handle multi-level nested writes', () => {
		const store = new Store()

		store.write('a:b:c:deep', 'deepValue')

		expect(store.read('a:b:c:deep')).toBe('deepValue')
	})

	it('should recursively call write() on nested Store', () => {
		const store = new Store()
		const nestedStore = new Store()
		store.data.set('parent', nestedStore)

		const writeSpy = jest.spyOn(nestedStore, 'write')

		store.write('parent:child', 'value')

		expect(writeSpy).toHaveBeenCalledWith('child', 'value')
		writeSpy.mockRestore()
	})
})

describe('Write Operations - Edge Cases', () => {
	beforeEach(() => {
		restrictedMap.clear()
		jest.clearAllMocks()
	})

	it('should throw for empty string path', () => {
		const store = new Store()

		expect(() => store.write('', 'value')).toThrow(Error)
	})

	it('should throw for undefined firstKey after split', () => {
		const store = new Store()

		expect(() => store.write(':child', 'value')).toThrow(Error)
	})

	it('should handle writing Store instance as value', () => {
		const store = new Store()
		const anotherStore = new Store()
		anotherStore.data.set('nested', 'nestedValue')

		store.write('key', anotherStore)

		expect(store.data.get('key')).toBe(anotherStore)
		expect(store.read('key:nested')).toBe('nestedValue')
	})

	it('should handle writing undefined value', () => {
		const store = new Store()

		store.write('key', undefined)

		expect(store.data.get('key')).toBeUndefined()
	})
})

// ============================================================================
// 7. writeEntries()
// ============================================================================

describe('writeEntries()', () => {
	beforeEach(() => {
		restrictedMap.clear()
		jest.clearAllMocks()
	})

	it('should write all entries from object', () => {
		const store = new Store()
		const entries = { a: 'valueA', b: 'valueB', c: 'valueC' }

		store.writeEntries(entries)

		expect(store.read('a')).toBe('valueA')
		expect(store.read('b')).toBe('valueB')
		expect(store.read('c')).toBe('valueC')
	})

	it('should convert nested objects to Store', () => {
		const store = new Store()
		const entries = { nested: { key: 'value' } }

		store.writeEntries(entries)

		const nested = store.data.get('nested')
		expect(nested).toBeInstanceOf(Store)
		expect(store.read('nested:key')).toBe('value')
	})

	it('should NOT convert arrays to Store', () => {
		const store = new Store()
		const entries = { arrayKey: ['a', 'b', 'c'] }

		store.writeEntries(entries)

		const result = store.data.get('arrayKey')
		expect(result).not.toBeInstanceOf(Store)
		expect(Array.isArray(result)).toBe(true)
	})

	it('should handle null values', () => {
		const store = new Store()
		const entries = { nullKey: null }

		store.writeEntries(entries)

		expect(store.read('nullKey')).toBeNull()
	})

	it('should call write() for each entry', () => {
		const store = new Store()
		const writeSpy = jest.spyOn(store, 'write')
		const entries = { a: '1', b: '2' }

		store.writeEntries(entries)

		expect(writeSpy).toHaveBeenCalledTimes(2)
		expect(writeSpy).toHaveBeenCalledWith('a', expect.anything())
		expect(writeSpy).toHaveBeenCalledWith('b', expect.anything())
		writeSpy.mockRestore()
	})

	it('should recursively call writeEntries for nested objects', () => {
		const store = new Store()
		const writeEntriesSpy = jest.spyOn(Store.prototype, 'writeEntries')
		const entries = {
			nested: {
				deep: {
					value: 'deepValue',
				},
			},
		}

		store.writeEntries(entries)

		// Should be called for root + nested + deep
		expect(writeEntriesSpy).toHaveBeenCalledTimes(3)
		writeEntriesSpy.mockRestore()
	})

	it('should handle empty object', () => {
		const store = new Store()

		expect(() => store.writeEntries({})).not.toThrow()
		expect(store.data.size).toBe(0)
	})
})

// ============================================================================
// 8. entries()
// ============================================================================

describe('entries()', () => {
	beforeEach(() => {
		restrictedMap.clear()
		jest.clearAllMocks()
	})

	it('should return object with readable properties', () => {
		class TestStore extends Store {
			@Restrict('r')
			public readableProp = 'readable'

			@Restrict('rw')
			public anotherProp = 'another'
		}
		const store = new TestStore()

		const result = store.entries()

		expect(result).toHaveProperty('readableProp', 'readable')
		expect(result).toHaveProperty('anotherProp', 'another')
	})

	it('should exclude non-readable properties', () => {
		class TestStore extends Store {
			@Restrict('none')
			public restrictedProp = 'restricted'

			@Restrict('w')
			public writeOnlyProp = 'writeOnly'
		}
		const store = new TestStore()

		const result = store.entries()

		expect(result).not.toHaveProperty('restrictedProp')
		expect(result).not.toHaveProperty('writeOnlyProp')
	})

	it('should iterate using Object.entries', () => {
		const store = new Store()
		const spy = jest.spyOn(Object, 'entries')

		store.entries()

		expect(spy).toHaveBeenCalledWith(store)
		spy.mockRestore()
	})

	it('should handle Store with no custom properties', () => {
		const store = new Store()

		const result = store.entries()

		// Should include defaultPolicy and data
		expect(result).toHaveProperty('defaultPolicy')
		expect(result).toHaveProperty('data')
	})

	it('should respect @Restrict decorators', () => {
		class TestStore extends Store {
			@Restrict('r')
			public visible = 'visible'

			@Restrict('none')
			public hidden = 'hidden'
		}
		const store = new TestStore()

		const result = store.entries()

		expect(result.visible).toBe('visible')
		expect(result.hidden).toBeUndefined()
	})

	it('should only include own properties', () => {
		class ParentStore extends Store {
			public parentProp = 'parent'
		}
		class ChildStore extends ParentStore {
			public childProp = 'child'
		}
		const store = new ChildStore()

		const result = store.entries()

		// Object.entries only returns own properties
		expect(result).toHaveProperty('childProp')
	})
})

// ============================================================================
// 9. Complex Integration Scenarios
// ============================================================================

describe('Complex Integration Scenarios', () => {
	beforeEach(() => {
		restrictedMap.clear()
		jest.clearAllMocks()
	})

	it('should handle full workflow: writeEntries → read → entries', () => {
		const store = new Store()
		const data = {
			user: {
				name: 'John Doe',
				profile: {
					age: 30,
					city: 'Paris',
				},
			},
		}

		store.writeEntries(data)

		expect(store.read('user:name')).toBe('John Doe')
		expect(store.read('user:profile:age')).toBe(30)

		// entries() returns own class properties, not Map data
		const entries = store.entries()
		expect(entries).toHaveProperty('defaultPolicy')
		expect(entries).toHaveProperty('data')
		expect(entries.data).toBeInstanceOf(Map)
	})

	it('should handle deep nesting with mixed types', () => {
		const store = new Store()
		store.writeEntries({
			level1: {
				array: [1, 2, 3],
				object: {
					string: 'value',
					number: 42,
					boolean: true,
					null: null,
				},
			},
		})

		expect(store.read('level1:array')).toEqual([1, 2, 3])
		expect(store.read('level1:object:string')).toBe('value')
		expect(store.read('level1:object:number')).toBe(42)
		expect(store.read('level1:object:boolean')).toBe(true)
		expect(store.read('level1:object:null')).toBeNull()
	})

	it('should handle function values in nested stores', () => {
		const store = new Store()
		const nestedStore = new Store()
		const lazyValue = jest.fn(() => 'computed')

		nestedStore.data.set('lazy', lazyValue)
		store.data.set('nested', nestedStore)

		expect(store.read('nested:lazy')).toBe('computed')
		expect(lazyValue).toHaveBeenCalledTimes(1)
	})

	it('should handle permission inheritance through prototype chain', () => {
		class BaseStore extends Store {
			@Restrict('r')
			public baseProp = 'baseValue'
		}

		class DerivedStore extends BaseStore {
			@Restrict('rw')
			public derivedProp = 'derivedValue'
		}

		const store = new DerivedStore()

		expect(store.allowedToRead('baseProp')).toBe(true)
		expect(store.allowedToWrite('baseProp')).toBe(false)
		expect(store.allowedToRead('derivedProp')).toBe(true)
		expect(store.allowedToWrite('derivedProp')).toBe(true)
	})

	it('should handle large object hierarchies efficiently', () => {
		const store = new Store()
		const largeObject: JSONObject = {}

		for (let i = 0; i < 100; i++) {
			largeObject[`key${i}`] = {
				nested: {
					value: `value${i}`,
				},
			}
		}

		const start = Date.now()
		store.writeEntries(largeObject)
		const duration = Date.now() - start

		expect(duration).toBeLessThan(100) // Should be fast
		expect(store.read('key50:nested:value')).toBe('value50')
	})

	it('should handle Store instance stored in another Store', () => {
		const childStore = new Store()
		childStore.data.set('childKey', 'childValue')

		const parentStore = new Store()
		parentStore.data.set('child', childStore)

		expect(parentStore.read('child:childKey')).toBe('childValue')
	})

	it('should handle overwriting nested Store with primitive', () => {
		const store = new Store()
		store.writeEntries({ nested: { key: 'value' } })

		// Overwrite nested Store with primitive
		store.write('nested', 'primitive')

		expect(store.read('nested')).toBe('primitive')
		expect(() => store.read('nested:key')).not.toThrow()
	})
})

// ============================================================================
// 10. Edge Cases & Error Handling
// ============================================================================

describe('Edge Cases & Error Handling', () => {
	beforeEach(() => {
		restrictedMap.clear()
		jest.clearAllMocks()
	})

	it('should handle malformed paths with multiple colons', () => {
		const store = new Store()
		store.writeEntries({ a: { b: { c: 'value' } } })

		// Double colon creates empty string which is falsy, throws Error
		expect(() => store.read('a::b')).toThrow(Error)
	})

	it('should handle paths with special characters', () => {
		const store = new Store()

		store.write('key-with-dash', 'value1')
		store.write('key_with_underscore', 'value2')
		store.write('key.with.dot', 'value3')

		expect(store.read('key-with-dash')).toBe('value1')
		expect(store.read('key_with_underscore')).toBe('value2')
		expect(store.read('key.with.dot')).toBe('value3')
	})

	it('should handle reading from deeply nested non-Store values', () => {
		const store = new Store()
		store.data.set('primitive', 'string')

		// Returns primitive value when path continues beyond non-Store
		const result = store.read('primitive:nested:deep')
		expect(result).toBe('string')
	})

	it('should throw consistent Error type for permission violations', () => {
		const store = new Store()
		store.defaultPolicy = 'none'

		expect(() => store.read('key')).toThrow(Error)
		expect(() => store.write('key', 'value')).toThrow(Error)
	})

	it('should handle writeEntries with circular-like structure', () => {
		const store = new Store()
		const obj1 = { key: 'value1' }
		const obj2 = { key: 'value2' }

		store.writeEntries({
			a: obj1,
			b: obj2,
			c: obj1, // Same reference as 'a'
		})

		expect(store.read('a:key')).toBe('value1')
		expect(store.read('c:key')).toBe('value1')
		// Note: These are separate Store instances due to conversion
	})

	it('should handle Map cleanup and memory', () => {
		const store = new Store()

		// Write many values
		for (let i = 0; i < 1000; i++) {
			store.write(`key${i}`, `value${i}`)
		}

		expect(store.data.size).toBe(1000)

		// Clear the data Map
		store.data.clear()
		expect(store.data.size).toBe(0)
	})
})
