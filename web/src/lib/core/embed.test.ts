import { describe, expect, it } from 'vitest';
import { embedCode, embedTitle, withEmbed } from './embed.ts';

const VIEW =
  'https://planumatlas.com/#anatomy=cdmd&atlas=hcp-mmp&region=hcp-mmp:left:24&view=left&lang=en';

/** The code's one element and its attributes, unescaped as a course page's editor reads them. */
function attributesOf(code: string): Record<string, string> {
  const tag = code.match(/^<iframe ([^>]*)><\/iframe>$/);
  expect(tag, code).not.toBeNull();
  const attributes = Object.fromEntries(
    [...tag![1]!.matchAll(/([a-z]+)="([^"]*)"/g)].map(([, name, value]) => [
      name,
      value!
        .replaceAll('&quot;', '"')
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .replaceAll('&amp;', '&'),
    ]),
  );
  return attributes;
}

describe('the embed code', () => {
  it('SHELL-21 is one iframe of the view with embed=1, lazy, allowed full screen, titled', () => {
    const code = embedCode(VIEW, 'Planum · MGH CDMD sub_013 · HCP-MMP · Left view');
    const attributes = attributesOf(code);
    expect(Object.keys(attributes).sort()).toEqual(
      ['allow', 'height', 'loading', 'src', 'style', 'title', 'width'].sort(),
    );
    expect(attributes.src).toBe(`${VIEW}&embed=1`);
    expect(attributes.loading).toBe('lazy');
    expect(attributes.allow).toBe('fullscreen');
    expect(attributes.title).toBe('Planum · MGH CDMD sub_013 · HCP-MMP · Left view');
    expect([attributes.width, attributes.height]).toEqual(['800', '600']);
    // Written escaped, so no ampersand in the address can start a character reference.
    expect(code).not.toMatch(/&(?!amp;|quot;|lt;)/);
  });

  it('SHELL-21 escapes a title that holds quotation marks', () => {
    const attributes = attributesOf(embedCode(VIEW, 'A "quoted" <name> & more'));
    expect(attributes.title).toBe('A "quoted" <name> & more');
  });

  it('SHELL-21 an embedded view written again keeps one embed, last', () => {
    const embedded = withEmbed(`${VIEW}&embed=1`, true);
    expect(embedded).toBe(`${VIEW}&embed=1`);
    expect(withEmbed('https://planumatlas.com/#embed=1&atlas=julich', true)).toBe(
      'https://planumatlas.com/#atlas=julich&embed=1',
    );
  });
});

describe('Open in Planum', () => {
  it('SHELL-20 is the same view without embed', () => {
    expect(withEmbed(`${VIEW}&embed=1`, false)).toBe(VIEW);
    expect(withEmbed('https://planumatlas.com/#embed=1', false)).toBe('https://planumatlas.com/');
  });
});

describe('the frame’s title', () => {
  it('SHELL-21 names the subject, the atlas, then the section or the held view', () => {
    const view = {
      subject: 'MGH CDMD sub_013',
      atlas: 'destrieux',
      view: 'left',
      section: null,
    } as const;
    expect(embedTitle('en', view)).toBe('Planum · MGH CDMD sub_013 · Destrieux · Left view');
    expect(embedTitle('fr', view)).toBe('Planum · MGH CDMD sub_013 · Destrieux · Vue gauche');
    expect(embedTitle('en', { ...view, section: 'coronal' })).toBe(
      'Planum · MGH CDMD sub_013 · Destrieux · Coronal section',
    );
    expect(embedTitle('en', { ...view, view: null })).toBe('Planum · MGH CDMD sub_013 · Destrieux');
  });
});
