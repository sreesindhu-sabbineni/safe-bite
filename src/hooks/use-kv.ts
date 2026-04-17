import { useState, useEffect, useCallback } from 'react'

/**
 * A localStorage-based replacement for @github/spark's useKV hook.
 * Provides persistent key-value storage that works locally.
 */
export function useKV<T>(key: string, defaultValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(`kv:${key}`)
      if (stored !== null) {
        return JSON.parse(stored) as T
      }
    } catch {
      // ignore parse errors
    }
    return defaultValue
  })

  useEffect(() => {
    try {
      localStorage.setItem(`kv:${key}`, JSON.stringify(value))
    } catch {
      // ignore storage errors
    }
  }, [key, value])

  const update = useCallback((newValue: T | ((prev: T) => T)) => {
    setValue((prev) => {
      const resolved = typeof newValue === 'function' ? (newValue as (prev: T) => T)(prev) : newValue
      return resolved
    })
  }, [])

  return [value, update]
}
