// ABOUTME: Verifies clean film titles, years, identity keys, and catalog source paths parse deterministically.
// ABOUTME: Keeps release-style filename stems readable as film names across every renderer surface.
import { describe, expect, it } from 'vitest';
import {
  buildFilmSourcePath,
  formatFilmTitle,
  isFilmSourcePath,
  parseFilmTitle,
  readFilmKey
} from '../shared/film-title.js';

describe('parseFilmTitle', () => {
  it('reads the title and year out of dotted release stems', () => {
    expect(parseFilmTitle('The.Plague.2025.1080p.AMZN.WEB-DL.DDP5.1.x265')).toEqual({ title: 'The Plague', year: 2025 });
    expect(parseFilmTitle('City.of.God.2002.BluRay.1080p.x265.10bit.MNHD-FRDS')).toEqual({ title: 'City of God', year: 2002 });
    expect(parseFilmTitle('Flow.2024')).toEqual({ title: 'Flow', year: 2024 });
    expect(parseFilmTitle('Heat.1995')).toEqual({ title: 'Heat', year: 1995 });
  });

  it('reads parenthesized years and drops edition suffixes', () => {
    expect(parseFilmTitle('Bridesmaids (2011) Unrated')).toEqual({ title: 'Bridesmaids', year: 2011 });
    expect(parseFilmTitle('The Matrix (1999)')).toEqual({ title: 'The Matrix', year: 1999 });
  });

  it('keeps numeric titles when a later year marker exists', () => {
    expect(parseFilmTitle('2001.A.Space.Odyssey.1968.1080p')).toEqual({ title: '2001 A Space Odyssey', year: 1968 });
    expect(parseFilmTitle('1917.2019.1080p.BluRay')).toEqual({ title: '1917', year: 2019 });
  });

  it('cuts release junk when no year exists', () => {
    expect(parseFilmTitle('Some.Movie.1080p.WEBRip')).toEqual({ title: 'Some Movie', year: null });
    expect(parseFilmTitle('Old.Short.x264-GRP')).toEqual({ title: 'Old Short', year: null });
  });

  it('cuts episode markers from series-style stems', () => {
    expect(parseFilmTitle('A.Knight.of.the.Seven.Kingdoms.The.Hedge.Knight.S01E01.720p')).toEqual({
      title: 'A Knight of the Seven Kingdoms The Hedge Knight',
      year: null
    });
  });

  it('passes plain names through unchanged', () => {
    expect(parseFilmTitle('Inception')).toEqual({ title: 'Inception', year: null });
    expect(parseFilmTitle('Media Inbox')).toEqual({ title: 'Media Inbox', year: null });
  });
});

describe('film identity helpers', () => {
  it('formats display titles with and without years', () => {
    expect(formatFilmTitle({ title: 'The Matrix', year: 1999 })).toBe('The Matrix (1999)');
    expect(formatFilmTitle({ title: 'Inception', year: null })).toBe('Inception');
  });

  it('normalizes film keys case- and punctuation-insensitively', () => {
    expect(readFilmKey({ title: 'The Matrix', year: 1999 })).toBe('the matrix::1999');
    expect(readFilmKey({ title: 'City  of God!', year: null })).toBe('city of god::');
    expect(readFilmKey(parseFilmTitle('The.Matrix.1999.1080p'))).toBe(readFilmKey({ title: 'the MATRIX', year: 1999 }));
  });

  it('builds and recognizes catalog source paths that title back to the film name', () => {
    const sourcePath = buildFilmSourcePath({ title: 'Inception', year: 2010 }, 23270459);
    expect(sourcePath).toBe('film://wikipedia-23270459/Inception (2010)');
    expect(isFilmSourcePath(sourcePath)).toBe(true);
    expect(isFilmSourcePath('/Volumes/blve/movies/Flow.mkv')).toBe(false);
    expect(parseFilmTitle('Inception (2010)')).toEqual({ title: 'Inception', year: 2010 });
  });
});
