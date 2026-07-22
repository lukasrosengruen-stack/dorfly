import { describe, expect, it } from 'vitest'
import { extractStoragePath } from './storagePath'

describe('extractStoragePath', () => {
  it('extrahiert den Pfad aus einer Public-URL', () => {
    const url = 'https://xyz.supabase.co/storage/v1/object/public/dorfly-media/maengel/123.jpg'
    expect(extractStoragePath(url, 'dorfly-media')).toBe('maengel/123.jpg')
  })

  it('gibt null zurück, wenn der Bucket nicht passt', () => {
    const url = 'https://xyz.supabase.co/storage/v1/object/public/anderer-bucket/maengel/123.jpg'
    expect(extractStoragePath(url, 'dorfly-media')).toBeNull()
  })

  it('gibt null zurück bei einer URL ohne Storage-Pfad', () => {
    expect(extractStoragePath('https://example.com/foto.jpg', 'dorfly-media')).toBeNull()
  })
})
