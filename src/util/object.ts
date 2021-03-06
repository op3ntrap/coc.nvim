import * as Is from './is'

export function deepClone<T>(obj: T): T {
  if (!obj || typeof obj !== 'object') {
    return obj
  }
  if (obj instanceof RegExp) {
    // See https://github.com/Microsoft/TypeScript/issues/10990
    return obj as any
  }
  const result: any = Array.isArray(obj) ? [] : {}
  Object.keys(obj).forEach(key => {
    if (obj[key] && typeof obj[key] === 'object') {
      result[key] = deepClone(obj[key])
    } else {
      result[key] = obj[key]
    }
  })
  return result
}

const _hasOwnProperty = Object.prototype.hasOwnProperty

export function deepFreeze<T>(obj: T): T {
  if (!obj || typeof obj !== 'object') {
    return obj
  }
  const stack: any[] = [obj]
  while (stack.length > 0) {
    let obj = stack.shift()
    Object.freeze(obj)
    for (const key in obj) {
      if (_hasOwnProperty.call(obj, key)) {
        let prop = obj[key]
        if (typeof prop === 'object' && !Object.isFrozen(prop)) {
          stack.push(prop)
        }
      }
    }
  }
  return obj
}

export function cloneAndChange(obj: any, changer: (orig: any) => any): any {
  return _cloneAndChange(obj, changer, [])
}

function _cloneAndChange(
  obj: any,
  changer: (orig: any) => any,
  encounteredObjects: any[]
): any {
  if (obj == null) {
    return obj
  }

  const changed = changer(obj)
  if (typeof changed !== 'undefined') {
    return changed
  }

  if (Is.array(obj)) {
    const r1: any[] = []
    for (let i1 = 0; i1 < obj.length; i1++) { // tslint:disable-line
      r1.push(_cloneAndChange(obj[i1], changer, encounteredObjects))
    }
    return r1
  }

  if (Is.objectLiteral(obj)) {
    if (encounteredObjects.indexOf(obj) >= 0) {
      throw new Error('Cannot clone recursive data-structure')
    }
    encounteredObjects.push(obj)
    const r2 = {}
    for (let i2 in obj) {
      if (_hasOwnProperty.call(obj, i2)) {
        (r2 as any)[i2] = _cloneAndChange(obj[i2], changer, encounteredObjects)
      }
    }
    encounteredObjects.pop()
    return r2
  }

  return obj
}

/**
 * Copies all properties of source into destination. The optional parameter "overwrite" allows to control
 * if existing properties on the destination should be overwritten or not. Defaults to true (overwrite).
 */
export function mixin(
  destination: any,
  source: any,
  overwrite = true
): any {
  if (!Is.objectLiteral(destination)) {
    return source
  }

  if (Is.objectLiteral(source)) {
    Object.keys(source).forEach(key => {
      if (key in destination) {
        if (overwrite) {
          if (Is.objectLiteral(destination[key]) && Is.objectLiteral(source[key])) {
            mixin(destination[key], source[key], overwrite)
          } else {
            destination[key] = source[key]
          }
        }
      } else {
        destination[key] = source[key]
      }
    })
  }
  return destination
}

export function assign(destination: any, ...sources: any[]): any {
  sources.forEach(source =>
    Object.keys(source).forEach(key => (destination[key] = source[key]))
  )
  return destination
}

export function arrayToHash(array: any[]): any {
  const result: any = {}
  for (let i = 0; i < array.length; ++i) { // tslint:disable-line
    result[array[i]] = true
  }
  return result
}

/**
 * Given an array of strings, returns a function which, given a string
 * returns true or false whether the string is in that array.
 */
export function createKeywordMatcher(
  arr: string[],
  caseInsensitive = false
): (str: string) => boolean {
  if (caseInsensitive) {
    arr = arr.map(x => {
      return x.toLowerCase()
    })
  }
  const hash = arrayToHash(arr)
  if (caseInsensitive) {
    return word => {
      return (
        hash[word.toLowerCase()] !== undefined &&
        hash.hasOwnProperty(word.toLowerCase())
      )
    }
  } else {
    return word => {
      return hash[word] !== undefined && hash.hasOwnProperty(word)
    }
  }
}

/**
 * Calls JSON.Stringify with a replacer to break apart any circular references.
 * This prevents JSON.stringify from throwing the exception
 *  "Uncaught TypeError: Converting circular structure to JSON"
 */
export function safeStringify(obj: any): string {
  const seen: any[] = []
  return JSON.stringify(obj, (_key, value) => {
    if (Is.objectLiteral(value) || Array.isArray(value)) {
      if (seen.indexOf(value) !== -1) {
        return '[Circular]'
      } else {
        seen.push(value)
      }
    }
    return value
  })
}

export function getOrDefault<T, R>(
  obj: T,
  fn: (obj: T) => R,
  defaultValue: R = null
): R {
  const result = fn(obj)
  return typeof result === 'undefined' ? defaultValue : result
}

export function equals(one: any, other: any): boolean {
  if (one === other) {
    return true
  }
  if (
    one === null ||
    one === undefined ||
    other === null ||
    other === undefined
  ) {
    return false
  }
  if (typeof one !== typeof other) {
    return false
  }
  if (typeof one !== 'object') {
    return false
  }
  if (Array.isArray(one) !== Array.isArray(other)) {
    return false
  }

  let i: number
  let key: string

  if (Array.isArray(one)) {
    if (one.length !== other.length) {
      return false
    }
    for (i = 0; i < one.length; i++) {
      if (!equals(one[i], other[i])) {
        return false
      }
    }
  } else {
    const oneKeys: string[] = []

    for (key in one) { // tslint:disable-line
      oneKeys.push(key)
    }
    oneKeys.sort()
    const otherKeys: string[] = []
    for (key in other) { // tslint:disable-line
      otherKeys.push(key)
    }
    otherKeys.sort()
    if (!equals(oneKeys, otherKeys)) {
      return false
    }
    for (i = 0; i < oneKeys.length; i++) {
      if (!equals(one[oneKeys[i]], other[oneKeys[i]])) {
        return false
      }
    }
  }
  return true
}

/**
 * Returns an object that has keys for each value that is different in the base object. Keys
 * that do not exist in the target but in the base object are not considered.
 *
 * Note: This is not a deep-diffing method, so the values are strictly taken into the resulting
 * object if they differ.
 *
 * @param base the object to diff against
 * @param obj the object to use for diffing
 */
export function distinct(base: { [key: string]: any }, target: { [key: string]: any }): { [key: string]: any } {
  const result = Object.create(null)

  if (!base || !target) {
    return result
  }

  const targetKeys = Object.keys(target)
  targetKeys.forEach(k => {
    const baseValue = base[k]
    const targetValue = target[k]

    if (!equals(baseValue, targetValue)) {
      result[k] = targetValue
    }
  })

  return result
}
