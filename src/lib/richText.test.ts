import { describe, it, expect } from 'vitest'
import { isValidLinkUrl, parseRichText, htmlToMd } from './richText'

describe('isValidLinkUrl', () => {
  it('erlaubt http://', () => expect(isValidLinkUrl('http://example.com')).toBe(true))
  it('erlaubt https://', () => expect(isValidLinkUrl('https://example.com')).toBe(true))
  it('erlaubt https:// mit führendem Leerzeichen', () => expect(isValidLinkUrl('  https://example.com')).toBe(true))
  it('blockiert javascript:', () => expect(isValidLinkUrl('javascript:alert(1)')).toBe(false))
  it('blockiert data:', () => expect(isValidLinkUrl('data:text/html,<h1>x</h1>')).toBe(false))
  it('blockiert relative Pfade', () => expect(isValidLinkUrl('/evil')).toBe(false))
  it('blockiert protokoll-relativ', () => expect(isValidLinkUrl('//example.com')).toBe(false))
  it('blockiert nackte Domain', () => expect(isValidLinkUrl('example.com')).toBe(false))
  it('blockiert leeren String', () => expect(isValidLinkUrl('')).toBe(false))
  it('blockiert URL ohne Host', () => expect(isValidLinkUrl('https://')).toBe(false))
})

describe('parseRichText', () => {
  it('leerer String ergibt leeres Array', () =>
    expect(parseRichText('')).toEqual([]))

  it('plain text ergibt ein Text-Segment', () =>
    expect(parseRichText('hallo welt')).toEqual([{ type: 'text', content: 'hallo welt' }]))

  it('parst Bold', () =>
    expect(parseRichText('**fett**')).toEqual([{ type: 'bold', content: 'fett' }]))

  it('parst benannten Link', () =>
    expect(parseRichText('[Klick](https://example.com)')).toEqual([
      { type: 'link', text: 'Klick', url: 'https://example.com' }
    ]))

  it('benannter Link mit javascript: URL → plain text', () =>
    expect(parseRichText('[evil](javascript:alert(1))')).toEqual([
      { type: 'text', content: '[evil](javascript:alert(1))' }
    ]))

  it('parst nackte URL', () =>
    expect(parseRichText('https://example.com')).toEqual([
      { type: 'url', url: 'https://example.com' }
    ]))

  it('parst nackte URL in umgebendem Text', () =>
    expect(parseRichText('Schau: https://example.com hier!')).toEqual([
      { type: 'text', content: 'Schau: ' },
      { type: 'url', url: 'https://example.com' },
      { type: 'text', content: ' hier!' },
    ]))

  it('erzeugt br-Segmente bei Zeilenumbrüchen', () =>
    expect(parseRichText('Zeile 1\nZeile 2')).toEqual([
      { type: 'text', content: 'Zeile 1' },
      { type: 'br' },
      { type: 'text', content: 'Zeile 2' },
    ]))

  it('dekodiert HTML-Entities', () =>
    expect(parseRichText('Hallo &amp; Welt')).toEqual([
      { type: 'text', content: 'Hallo & Welt' }
    ]))

  it('gemischter Inhalt: Text + Link + Bold', () =>
    expect(parseRichText('Besuche [unsere Seite](https://dorfly.de) für **mehr**')).toEqual([
      { type: 'text', content: 'Besuche ' },
      { type: 'link', text: 'unsere Seite', url: 'https://dorfly.de' },
      { type: 'text', content: ' für ' },
      { type: 'bold', content: 'mehr' },
    ]))
})

describe('htmlToMd', () => {
  it('konvertiert benannten Link', () =>
    expect(htmlToMd('<a href="https://example.com">Dorfly</a>')).toBe('[Dorfly](https://example.com)'))

  it('konvertiert URL-Link (Text = URL) zur nackten URL', () =>
    expect(htmlToMd('<a href="https://example.com">https://example.com</a>')).toBe('https://example.com'))

  it('konvertiert Bold', () =>
    expect(htmlToMd('<strong>fett</strong>')).toBe('**fett**'))

  it('konvertiert Zeilenumbruch', () =>
    expect(htmlToMd('Zeile 1<br>Zeile 2')).toBe('Zeile 1\nZeile 2'))
})
