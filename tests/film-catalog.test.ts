// ABOUTME: Verifies catalog search mapping, confident match selection, and full film detail assembly.
// ABOUTME: Uses recorded Wikipedia and Wikidata payload fixtures so mapping logic tests real response shapes.
import { describe, expect, it } from 'vitest';
import {
  chooseFilmMatch,
  createFilmCatalog,
  readImdbPosterResults,
  readSearchResults
} from '../electron/film-catalog.js';

const searchPayload = {
  query: {
    pages: {
      '79985226': {
        pageid: 79985226,
        title: 'The Plague (2025 film)',
        index: 1,
        thumbnail: {
          source: 'https://upload.wikimedia.org/wikipedia/en/c/c3/The_Plague_film_poster.jpg',
          width: 282,
          height: 353
        },
        pageprops: { wikibase_item: 'Q134052834' },
        description: 'Psychological drama thriller film'
      },
      '2411105': {
        pageid: 2411105,
        title: 'The Plague Dogs (film)',
        index: 2,
        thumbnail: {
          source: 'https://upload.wikimedia.org/wikipedia/en/0/08/Plaguedogsposter.jpg',
          width: 261,
          height: 380
        },
        pageprops: { wikibase_item: 'Q1138751' },
        description: '1982 British-American film'
      },
      '71054': {
        pageid: 71054,
        title: 'Plague',
        index: 3,
        pageprops: { wikibase_item: 'Q345631' },
        description: 'Topics referred to by the same term'
      }
    }
  }
};

const pagePayload = {
  query: {
    pages: {
      '23270459': {
        pageid: 23270459,
        title: 'Inception',
        fullurl: 'https://en.wikipedia.org/wiki/Inception',
        thumbnail: {
          source: 'https://upload.wikimedia.org/wikipedia/en/2/2e/Inception_poster.jpg',
          width: 220,
          height: 326
        },
        pageprops: { wikibase_item: 'Q25188' }
      }
    }
  }
};

const claimsPayload = {
  entities: {
    Q25188: {
      claims: {
        P57: [{ mainsnak: { datavalue: { value: { id: 'Q25191' } } } }],
        P161: [
          { mainsnak: { datavalue: { value: { id: 'Q38111' } } } },
          { mainsnak: { datavalue: { value: { id: 'Q211553' } } } }
        ],
        P495: [
          { mainsnak: { datavalue: { value: { id: 'Q145' } } } },
          { mainsnak: { datavalue: { value: { id: 'Q30' } } } }
        ],
        P364: [{ mainsnak: { datavalue: { value: { id: 'Q1860' } } } }],
        P2047: [{ mainsnak: { datavalue: { value: { amount: '+148' } } } }],
        P136: [{ mainsnak: { datavalue: { value: { id: 'Q471839' } } } }],
        P577: [{ mainsnak: { datavalue: { value: { time: '+2010-07-08T00:00:00Z' } } } }]
      }
    }
  }
};

const searchClaimsPayload = {
  entities: {
    Q134052834: { claims: { P57: [{ mainsnak: { datavalue: { value: { id: 'Q107277343' } } } }] } },
    Q1138751: { claims: { P57: [{ mainsnak: { datavalue: { value: { id: 'Q717477' } } } }] } },
    Q345631: { claims: {} }
  }
};

const searchLabelsPayload = {
  entities: {
    Q107277343: { labels: { en: { value: 'Charlie Polinger' } } },
    Q717477: { labels: { en: { value: 'Martin Rosen' } } }
  }
};

const labelsPayload = {
  entities: {
    Q25191: { labels: { en: { value: 'Christopher Nolan' } } },
    Q38111: { labels: { en: { value: 'Leonardo DiCaprio' } } },
    Q211553: { labels: { en: { value: 'Joseph Gordon-Levitt' } } },
    Q145: { labels: { en: { value: 'United Kingdom' } } },
    Q30: { labels: { en: { value: 'United States of America' } } },
    Q1860: { labels: { en: { value: 'English' } } },
    Q471839: { labels: { en: { value: 'science fiction film' } } }
  }
};

function createStubCatalog() {
  const requestedUrls: string[] = [];
  const catalog = createFilmCatalog({
    fetchJson: async (url: string) => {
      requestedUrls.push(url);

      if (url.includes('generator=search')) {
        return searchPayload;
      }

      if (url.includes('pageids=')) {
        return pagePayload;
      }

      if (url.includes('props=claims') && url.includes('Q134052834')) {
        return searchClaimsPayload;
      }

      if (url.includes('props=labels') && url.includes('Q107277343')) {
        return searchLabelsPayload;
      }

      if (url.includes('props=claims')) {
        return claimsPayload;
      }

      return labelsPayload;
    }
  });

  return { catalog, requestedUrls };
}

describe('searchFilms', () => {
  it('maps ranked search hits into clean titles, years, and posters', async () => {
    const { catalog } = createStubCatalog();
    const results = await catalog.searchFilms('The Plague 2025');

    expect(results).toHaveLength(3);
    expect(results[0]).toEqual({
      catalogId: '79985226',
      catalogSource: 'wikipedia',
      description: 'Psychological drama thriller film',
      director: ['Charlie Polinger'],
      pageId: 79985226,
      posterUrl: 'https://upload.wikimedia.org/wikipedia/en/c/c3/The_Plague_film_poster.jpg',
      title: 'The Plague',
      year: 2025
    });
    expect(results[1]?.year).toBe(1982);
    expect(results[2]?.posterUrl).toBeNull();
  });

  it('times out a stalled Wikipedia or Wikidata request boundary', async () => {
    const catalog = createFilmCatalog({
      fetchJson: async () => new Promise<never>(() => {}),
      requestTimeoutMs: 2
    });
    const outcome = await Promise.race([
      catalog.searchFilms('Never Settles').then(
        () => 'resolved',
        (error: Error) => error.message
      ),
      new Promise<'blocked'>((resolve) => setTimeout(() => resolve('blocked'), 100))
    ]);

    expect(outcome).toContain('timed out');
  });

  it('cancels an in-flight catalog request explicitly', async () => {
    const catalog = createFilmCatalog({
      fetchJson: async () => new Promise<never>(() => {}),
      requestTimeoutMs: 1000
    });
    const controller = new AbortController();
    const search = catalog.searchFilms('Cancel Me', { signal: controller.signal });
    controller.abort();

    const outcome = await Promise.race([
      search.then(
        () => 'resolved',
        (error: Error) => error.message
      ),
      new Promise<'blocked'>((resolve) => setTimeout(() => resolve('blocked'), 100))
    ]);

    expect(outcome).toContain('cancelled');
  });
});

describe('chooseFilmMatch', () => {
  it('selects the hit whose normalized title and year agree', async () => {
    const { catalog } = createStubCatalog();
    const results = await catalog.searchFilms('The Plague 2025');

    expect(chooseFilmMatch(results, { title: 'The Plague', year: 2025 })?.pageId).toBe(79985226);
    expect(chooseFilmMatch(results, { title: 'The Plague Dogs', year: null })?.pageId).toBe(2411105);
    expect(chooseFilmMatch(results, { title: 'Unrelated Name', year: 2020 })).toBeNull();
  });

  it('rejects title matches whose known years disagree', async () => {
    const { catalog } = createStubCatalog();
    const results = await catalog.searchFilms('The Plague 2025');

    expect(chooseFilmMatch(results, { title: 'The Plague', year: 1992 })).toBeNull();
  });

  it('keeps movie and series identities separate even when their titles are identical', () => {
    const results = [
      {
        description: '2024 American drama film',
        pageId: 1,
        posterUrl: 'https://example.test/the-boys-film.jpg',
        title: 'The Boys',
        year: 2024
      },
      {
        description: 'American superhero television series',
        pageId: 2,
        posterUrl: 'https://example.test/the-boys-series.jpg',
        title: 'The Boys',
        year: 2019
      }
    ];

    expect(chooseFilmMatch(results, { mediaType: 'series', title: 'The Boys', year: null })?.pageId).toBe(2);
    expect(chooseFilmMatch(results, { mediaType: 'film', title: 'The Boys', year: 2024 })?.pageId).toBe(1);
  });

  it('normalizes descriptive series disambiguators and conservative season subtitles', () => {
    const results = readSearchResults({
      query: {
        pages: {
          one: {
            description: 'American teen drama television series',
            pageid: 1,
            title: 'Euphoria (American TV series)'
          },
          two: {
            description: 'American television sitcom',
            pageid: 2,
            title: 'Malcolm in the Middle'
          }
        }
      }
    });

    expect(results[0]?.title).toBe('Euphoria');
    expect(chooseFilmMatch(results, { mediaType: 'series', title: 'Euphoria', year: null })?.pageId).toBe(1);
    expect(
      chooseFilmMatch(results, {
        mediaType: 'series',
        title: "Malcolm in the Middle Life's Still Unfair",
        year: null
      })?.pageId
    ).toBe(2);
  });

  it('accepts a one-character title correction only when the release year and media type agree', () => {
    const result = {
      description: '2001 Taiwanese drama film',
      pageId: 3,
      posterUrl: 'https://example.test/millennium-mambo-poster.jpg',
      title: 'Millennium Mambo',
      year: 2001
    };

    expect(chooseFilmMatch([result], { title: 'Millenium Mambo', year: 2001 })?.pageId).toBe(3);
    expect(chooseFilmMatch([result], { title: 'Millenium Mambo', year: 2002 })).toBeNull();
  });
});

describe('fetchFilmDetails', () => {
  it('assembles poster, credits, and technical fields from page, claims, and labels', async () => {
    const { catalog } = createStubCatalog();
    const details = await catalog.fetchFilmDetails(23270459);

    expect(details).toEqual({
      cast: ['Leonardo DiCaprio', 'Joseph Gordon-Levitt'],
      country: ['United Kingdom', 'United States of America'],
      director: ['Christopher Nolan'],
      genres: ['Science fiction'],
      language: ['English'],
      pageId: 23270459,
      posterUrl: 'https://upload.wikimedia.org/wikipedia/en/2/2e/Inception_poster.jpg',
      runtimeMinutes: 148,
      wikipediaUrl: 'https://en.wikipedia.org/wiki/Inception',
      year: 2010
    });
  });
});

describe('IMDb poster fallback', () => {
  it('maps only portrait movie and series artwork into source-aware candidates', () => {
    const results = readImdbPosterResults({
      d: [
        {
          i: { height: 1200, imageUrl: 'https://m.media-amazon.com/inception.jpg', width: 800 },
          id: 'tt1375666',
          l: 'Inception',
          q: 'feature',
          y: 2010
        },
        {
          i: { height: 1200, imageUrl: 'https://m.media-amazon.com/the-boys.jpg', width: 800 },
          id: 'tt1190634',
          l: 'The Boys',
          q: 'TV series',
          y: 2019
        },
        {
          i: { height: 500, imageUrl: 'https://m.media-amazon.com/person.jpg', width: 500 },
          id: 'nm0000001',
          l: 'A Person',
          q: 'actor'
        }
      ]
    });

    expect(results).toEqual([
      {
        catalogId: 'tt1375666',
        catalogRank: 0,
        catalogSource: 'imdb',
        description: 'Feature film',
        pageId: -1375666,
        posterUrl: 'https://m.media-amazon.com/inception.jpg',
        title: 'Inception',
        year: 2010
      },
      {
        catalogId: 'tt1190634',
        catalogRank: 1,
        catalogSource: 'imdb',
        description: 'Television series',
        pageId: -1190634,
        posterUrl: 'https://m.media-amazon.com/the-boys.jpg',
        title: 'The Boys',
        year: 2019
      }
    ]);
  });
});
