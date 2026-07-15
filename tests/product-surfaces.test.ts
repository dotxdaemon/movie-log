// ABOUTME: Verifies that the full Movie Log product brief resolves into real rendered application surfaces.
// ABOUTME: Pins navigation, diary, library, search, statistics, dossier, logging, and designed states.
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { ArchiveApplication, type ArchiveApplicationProps } from '../src/archive-application.js';
import { buildSearchResults, defaultArchiveFilters, type ArchiveView } from '../src/archive-model.js';
import type { FilmRecord, MovieLogState } from '../shared/types.js';
import { findByClass, renderTree, readText } from './render-tree.js';

const flowFilm: FilmRecord = {
  cast: ['Cat', 'Capybara'],
  country: ['Latvia', 'France'],
  director: ['Gints Zilbalodis'],
  fetchedAt: '2026-07-12T10:00:00.000Z',
  genres: ['Animated', 'Adventure'],
  key: 'flow::2024',
  language: ['None'],
  pageId: 71441742,
  posterUrl: 'https://upload.wikimedia.org/wikipedia/en/f/f8/Flow_poster.jpg',
  runtimeMinutes: 85,
  status: 'matched',
  title: 'Flow',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Flow_(2024_film)',
  year: 2024
};

const state: MovieLogState = {
  films: { 'flow::2024': flowFilm },
  history: [
    {
      castNotes: 'The silent ensemble carries the final movement.',
      favorite: true,
      id: '2026-07-10T20:00:00.000Z:/Movies/Flow.2024.mkv',
      location: 'Home',
      rating: 4.5,
      review: 'Quiet, precise, and unexpectedly moving.',
      rewatch: true,
      source: 'drop',
      sourceKind: 'file',
      sourcePath: '/Movies/Flow.2024.mkv',
      tags: ['Animation', 'Drama'],
      title: 'Flow.2024',
      viewingFormat: 'Digital',
      watchedAt: '2026-07-10T20:00:00.000Z'
    },
    {
      id: '2026-06-18T08:00:00.000Z:/Movies/Heat.1995.mkv',
      source: 'watch',
      sourceKind: 'file',
      sourcePath: '/Movies/Heat.1995.mkv',
      title: 'Heat.1995',
      watchedAt: '2026-06-18T08:00:00.000Z'
    }
  ],
  libraryItems: [
    {
      firstSeenAt: '2026-07-10T20:00:00.000Z',
      folderId: 'movies',
      folderPath: '/Movies',
      id: 'dev:1',
      lastSeenAt: '2026-07-10T20:00:00.000Z',
      sourceKind: 'file',
      sourcePath: '/Movies/Flow.2024.mkv',
      title: 'Flow.2024'
    }
  ],
  watchedFolders: [
    {
      addedAt: '2026-06-01T12:00:00.000Z',
      id: 'movies',
      lastScannedAt: '2026-07-10T20:00:00.000Z',
      name: 'Movies',
      path: '/Movies'
    }
  ]
};

const emptySearchGroups = buildSearchResults({ history: [], libraryItems: [], watchedFolders: [] }, '', []);

const noop = () => {};
const asyncNoop = async () => {};

const baseProps: ArchiveApplicationProps = {
  activeView: 'diary',
  dataFilePath: '/Data/movie-log.json',
  diaryMode: 'timeline',
  dossierMatchPending: false,
  dossierMatchResults: [],
  dropActive: false,
  feedback: null,
  filterSheetOpen: false,
  filters: defaultArchiveFilters,
  loadError: null,
  loading: false,
  logFilmError: null,
  logFilmPending: false,
  logFilmQuery: '',
  logFilmResults: [],
  logPanelOpen: false,
  logReview: '',
  logSelectedFilm: null,
  noteFilePath: '/Data/movie-log-note.md',
  onAddWatchedFolders: asyncNoop,
  onChooseLogPaths: asyncNoop,
  onClearLogPaths: noop,
  onCloseLogPanel: noop,
  onCopyPath: asyncNoop,
  onCreateLog: asyncNoop,
  onDiaryModeChange: noop,
  onDrop: noop,
  onDropActiveChange: noop,
  onFeedbackDismiss: noop,
  onFilterChange: noop,
  onFilterSheetOpenChange: noop,
  onLogFilmQueryChange: noop,
  onLogReviewChange: noop,
  onMatchFilm: noop,
  onOpenInFinder: asyncNoop,
  onOpenItem: asyncNoop,
  onOpenLogPanel: noop,
  onOpenSearchResult: noop,
  onRemoveWatchedFolder: asyncNoop,
  onRetryLoad: noop,
  onScanNow: asyncNoop,
  onSearchDismiss: noop,
  onSearchActiveIndexChange: noop,
  onSearchMatch: noop,
  onSearchQueryChange: noop,
  onSelectLibraryPath: noop,
  onSelectLogFilm: noop,
  onSelectPath: noop,
  onUpdateEntry: asyncNoop,
  onViewChange: noop,
  pendingLogPaths: [],
  scanInProgress: false,
  searchActiveIndex: 0,
  searchCatalogError: null,
  searchCatalogPending: false,
  searchGroups: emptySearchGroups,
  searchQuery: '',
  selectedLibraryPath: null,
  selectedPath: null,
  state
};

function renderSurface(activeView: ArchiveView, overrides: Partial<ArchiveApplicationProps> = {}) {
  return renderTree(
    createElement(ArchiveApplication, {
      ...baseProps,
      ...overrides,
      activeView
    })
  );
}

describe('ArchiveApplication', () => {
  it('renders five icon-and-label navigation modes plus the logging action on desktop and mobile', () => {
    const tree = renderSurface('diary');

    expect(findByClass(tree, 'primary-navigation')).toHaveLength(1);
    expect(findByClass(tree, 'nav-item')).toHaveLength(5);
    expect(findByClass(tree, 'nav-icon').length).toBeGreaterThanOrEqual(10);
    expect(findByClass(tree, 'nav-item-label')).toHaveLength(5);
    expect(findByClass(tree, 'mobile-nav-item')).toHaveLength(5);
    expect(findByClass(tree, 'mobile-log-label')).toHaveLength(1);
    expect(findByClass(tree, 'log-action')).not.toHaveLength(0);
    expect(readText(tree)).toContain('Diary');
    expect(readText(tree)).toContain('Library');
    expect(readText(tree)).toContain('Search');
    expect(readText(tree)).toContain('Statistics');
    expect(readText(tree)).toContain('Settings');
    expect(readText(tree)).toContain('Log a Film');
  });

  it('keeps search and the logging action in the page header', () => {
    const tree = renderSurface('diary');

    expect(findByClass(tree, 'header-search')).toHaveLength(1);
    expect(findByClass(tree, 'header-log-action')).toHaveLength(1);
    expect(findByClass(tree, 'header-rule')).toHaveLength(1);
  });

  it('shows the header filters control on the library view', () => {
    const tree = renderSurface('library');

    expect(findByClass(tree, 'header-filters')).toHaveLength(1);
  });

  it('renders diary metrics with total runtime from cached film metadata', () => {
    const tree = renderSurface('diary');
    const text = readText(tree);

    expect(findByClass(tree, 'month-summary')).toHaveLength(1);
    expect(text).toContain('Total runtime');
    expect(text).toContain('1h 25m');
    expect(text).not.toContain('Total runtime —');
  });

  it('renders diary entries with clean titles, markers, catalog cast, and editable user cast notes', () => {
    const tree = renderSurface('diary');
    const text = readText(tree);

    expect(findByClass(tree, 'diary-entry')).toHaveLength(2);
    expect(text).toContain('Flow');
    expect(text).not.toContain('Flow.2024.mkv');
    expect(findByClass(tree, 'entry-year')).toHaveLength(2);
    expect(findByClass(tree, 'entry-mark-favorite')).toHaveLength(1);
    expect(findByClass(tree, 'entry-mark-rewatch')).toHaveLength(1);
    expect(findByClass(tree, 'entry-excerpt')).toHaveLength(1);
    expect(findByClass(tree, 'entry-expand')).toHaveLength(2);
    expect(findByClass(tree, 'entry-cast')).toHaveLength(1);
    expect(text).toContain('Cat, Capybara');
    expect(findByClass(tree, 'entry-cast-notes')).toHaveLength(1);
    expect(text).toContain('The silent ensemble carries the final movement.');
    expect(text).toContain('Cast notes');
    expect(findByClass(tree, 'entry-annotation')).toHaveLength(2);
    expect(findByClass(tree, 'rating-meter')).not.toHaveLength(0);
  });

  it('renders real poster art in the diary poster grid', () => {
    const tree = renderSurface('diary', { diaryMode: 'grid' });
    const posters = findByClass(tree, 'poster-art');

    expect(findByClass(tree, 'diary-poster-grid')).toHaveLength(1);
    expect(posters.length).toBeGreaterThanOrEqual(1);
    expect(posters[0]?.props.src).toContain('Flow_poster');
  });

  it('renders library cards with year, rating, watched date, markers, and an annotation layer', () => {
    const tree = renderSurface('library');

    expect(findByClass(tree, 'filter-toolbar')).toHaveLength(1);
    expect(findByClass(tree, 'movie-grid')).toHaveLength(1);
    expect(findByClass(tree, 'movie-card')).toHaveLength(2);
    expect(findByClass(tree, 'card-annotation')).toHaveLength(2);
    expect(findByClass(tree, 'card-mark-favorite')).toHaveLength(1);
    expect(findByClass(tree, 'card-mark-rewatch')).toHaveLength(1);
    expect(findByClass(tree, 'card-mark-unreviewed')).toHaveLength(1);
    expect(findByClass(tree, 'movie-card-year')).toHaveLength(2);
    expect(findByClass(tree, 'movie-card-status')).toHaveLength(2);
    expect(readText(tree)).toContain('Gints Zilbalodis');
  });

  it('marks the selected library card structurally without opening it', () => {
    const tree = renderSurface('library', {
      selectedLibraryPath: '/Movies/Flow.2024.mkv'
    });

    expect(findByClass(tree, 'movie-card-selected')).toHaveLength(1);
    expect(findByClass(tree, 'library-inspector')).toHaveLength(1);
    expect(findByClass(tree, 'library-inspector-poster')).toHaveLength(1);
    expect(readText(tree)).toContain('Open dossier');
  });

  it('does not reserve an empty context inspector without a selected film', () => {
    const tree = renderSurface('library');

    expect(findByClass(tree, 'library-inspector')).toHaveLength(0);
  });

  it('renders the mobile filter sheet with apply and reset actions when open', () => {
    const tree = renderSurface('library', { filterSheetOpen: true });

    expect(findByClass(tree, 'filter-sheet')).toHaveLength(1);
    expect(findByClass(tree, 'filter-sheet-actions')).toHaveLength(1);
    expect(readText(tree)).toContain('Reset');
    expect(readText(tree)).toContain('Show 2 titles');
  });

  it('renders graded rating options and a real genre filter from catalog metadata', () => {
    const tree = renderSurface('library');
    const text = readText(tree);

    expect(text).toContain('4.5+');
    expect(text).toContain('Unrated');
    expect(text).toContain('Animated');
    expect(text).toContain('Genre');
    expect(text).toContain('Tag');
  });

  it('groups search results into diary, library, and catalog lanes with posters and directors', () => {
    const groups = buildSearchResults(state, 'flow', [
      {
        description: '2019 short film',
        director: ['Jane Director'],
        pageId: 999,
        posterUrl: null,
        title: 'Flowing',
        year: 2019
      }
    ]);
    const tree = renderSurface('search', {
      searchGroups: groups,
      searchQuery: 'flow'
    });
    const text = readText(tree);

    expect(findByClass(tree, 'search-groups')).toHaveLength(1);
    expect(findByClass(tree, 'search-group')).toHaveLength(3);
    expect(findByClass(tree, 'search-result')).not.toHaveLength(0);
    expect(text).toContain('Diary');
    expect(text).toContain('Catalog');
    expect(text).toContain('Gints Zilbalodis');
    expect(text).toContain('Jane Director');
    expect(findByClass(tree, 'search-result-year')).not.toHaveLength(0);
  });

  it('renders catalog failures as designed errors instead of empty results', () => {
    const searchTree = renderSurface('search', {
      searchCatalogError: 'The film catalog is unavailable.',
      searchQuery: 'flow'
    });
    const logTree = renderSurface('diary', {
      logFilmError: 'The film catalog is unavailable.',
      logFilmQuery: 'flow',
      logPanelOpen: true
    });

    expect(findByClass(searchTree, 'catalog-error')).toHaveLength(1);
    expect(findByClass(logTree, 'catalog-error')).toHaveLength(1);
    expect(readText(searchTree)).toContain('The film catalog is unavailable.');
    expect(readText(logTree)).not.toContain('No catalog match.');
  });

  it('marks the keyboard-active search result', () => {
    const groups = buildSearchResults(state, 'flow', []);
    const tree = renderSurface('search', {
      searchActiveIndex: 0,
      searchGroups: groups,
      searchQuery: 'flow'
    });

    expect(findByClass(tree, 'search-result-active')).toHaveLength(1);
  });

  it('dismisses the Search surface when Escape is pressed', () => {
    const queryChanges: string[] = [];
    let dismissCount = 0;
    const tree = renderSurface('search', {
      onSearchDismiss: () => {
        dismissCount += 1;
      },
      onSearchQueryChange: (value) => queryChanges.push(value),
      searchQuery: 'flow'
    });
    const field = findByClass(tree, 'archive-search')[0];
    const input = field?.children.find((child) => child.type === 'input');

    expect(input).toBeTruthy();
    (input?.props.onKeyDown as (event: { key: string; preventDefault(): void }) => void)({
      key: 'Escape',
      preventDefault: noop
    });

    expect(queryChanges).toEqual(['']);
    expect(dismissCount).toBe(1);
  });

  it('renders statistics with runtime, genres, directors, decades, yearly comparison, and a 365-day grid', () => {
    const statisticsState: MovieLogState = {
      ...state,
      history: [
        ...state.history,
        {
          ...state.history[0]!,
          id: '2026-07-11:flow',
          watchedAt: '2026-07-11T20:00:00.000Z'
        },
        {
          ...state.history[1]!,
          id: '2025-06-18:heat',
          watchedAt: '2025-06-18T08:00:00.000Z'
        }
      ]
    };
    const tree = renderSurface('statistics', { state: statisticsState });
    const text = readText(tree);

    expect(findByClass(tree, 'metric-strip')).toHaveLength(1);
    expect(text).toContain('Total runtime');
    expect(findByClass(tree, 'genre-chart')).toHaveLength(1);
    expect(findByClass(tree, 'director-chart')).toHaveLength(1);
    expect(findByClass(tree, 'decade-chart')).toHaveLength(1);
    expect(findByClass(tree, 'year-chart')).toHaveLength(1);
    expect(findByClass(tree, 'bar-column-plot').length).toBeGreaterThanOrEqual(2);
    expect(findByClass(tree, 'bar-column-bar').map((bar) => bar.props.style)).toContainEqual({ height: '50%' });
    expect(findByClass(tree, 'activity-cell')).toHaveLength(365);
  });

  it('renders settings with watched folders, current contents, and durable file paths', () => {
    const tree = renderSurface('settings');

    expect(findByClass(tree, 'settings-view')).toHaveLength(1);
    expect(findByClass(tree, 'watched-folder-list')).toHaveLength(1);
    expect(findByClass(tree, 'current-contents-list')).toHaveLength(1);
    expect(readText(tree)).toContain('/Data/movie-log.json');
    expect(readText(tree)).toContain('/Data/movie-log-note.md');
  });

  it('renders the film dossier with credits, rating priority, ledger, reading sections, and rematching', () => {
    const tree = renderSurface('detail', {
      selectedPath: '/Movies/Flow.2024.mkv'
    });
    const text = readText(tree);

    expect(findByClass(tree, 'movie-dossier')).toHaveLength(1);
    expect(findByClass(tree, 'dossier-rating')).toHaveLength(1);
    expect(findByClass(tree, 'dossier-meta')).toHaveLength(1);
    expect(text).toContain('Director');
    expect(text).toContain('Gints Zilbalodis');
    expect(text).toContain('85 min');
    expect(text).toContain('Latvia');
    expect(text).toContain('Language');
    expect(findByClass(tree, 'dossier-cast')).toHaveLength(1);
    expect(findByClass(tree, 'viewing-history')).toHaveLength(1);
    expect(findByClass(tree, 'viewing-location')).toHaveLength(1);
    expect(text).toContain('Home');
    expect(findByClass(tree, 'dossier-review')).toHaveLength(1);
    expect(findByClass(tree, 'dossier-tags')).toHaveLength(1);
    expect(findByClass(tree, 'match-study')).toHaveLength(1);
    expect(findByClass(tree, 'entry-form')).toHaveLength(1);
    expect(findByClass(tree, 'rating-segment')).toHaveLength(10);
    expect(findByClass(tree, 'dossier-backdrop')).toHaveLength(1);
  });

  it('renders the logging panel with film search before media choice and a visible save footer', () => {
    const tree = renderSurface('diary', { logPanelOpen: true });
    const text = readText(tree);
    const logSheet = findByClass(tree, 'log-sheet');

    expect(logSheet).toHaveLength(1);
    expect(findByClass(logSheet, 'log-source-column')).toHaveLength(1);
    expect(findByClass(tree, 'film-search-block')).toHaveLength(1);
    expect(findByClass(tree, 'media-attach')).toHaveLength(1);
    expect(findByClass(tree, 'entry-form-footer')).toHaveLength(1);
    expect(findByClass(tree, 'field-count')).toHaveLength(1);
    expect(text).toContain('Find the film');
    expect(text).toContain('Choose Media');
    expect(text).toContain('Viewing date');
    expect(text).toContain('Location');
    expect(text).toContain('0 / 2000');
    expect(findByClass(logSheet, 'rating-segment')).toHaveLength(10);
    expect(findByClass(logSheet, 'rating-segment-readout')).toHaveLength(10);
    expect(findByClass(logSheet, 'rating-current-value')).toHaveLength(1);
    expect(text).toContain('Current —');
  });

  it('shows the selected film as a poster and metadata unit in the logging panel', () => {
    const tree = renderSurface('diary', {
      logPanelOpen: true,
      logSelectedFilm: {
        description: '2024 animated film',
        director: ['Gints Zilbalodis'],
        pageId: 71441742,
        posterUrl: 'https://upload.wikimedia.org/wikipedia/en/f/f8/Flow_poster.jpg',
        title: 'Flow',
        year: 2024
      }
    });

    expect(findByClass(tree, 'selected-film')).toHaveLength(1);
    expect(findByClass(tree, 'poster-art')).not.toHaveLength(0);
    expect(readText(tree)).toContain('Flow');
    expect(readText(tree)).toContain('2024');
    expect(readText(tree)).toContain('Gints Zilbalodis');
  });

  it('uses per-view dimension-preserving loading surfaces instead of the empty state', () => {
    const diaryTree = renderSurface('diary', { loading: true });
    const libraryTree = renderSurface('library', { loading: true });
    const statisticsTree = renderSurface('statistics', { loading: true });

    expect(findByClass(diaryTree, 'diary-loading')).toHaveLength(1);
    expect(findByClass(diaryTree, 'skeleton-entry')).toHaveLength(5);
    expect(findByClass(libraryTree, 'skeleton-card')).toHaveLength(8);
    expect(findByClass(statisticsTree, 'skeleton-panel')).not.toHaveLength(0);
    expect(findByClass(diaryTree, 'blank-slate')).toHaveLength(0);
  });

  it('renders a designed error state with a retry action when loading fails', () => {
    const tree = renderSurface('diary', {
      loadError: 'The data file could not be read.'
    });

    expect(findByClass(tree, 'error-state')).toHaveLength(1);
    expect(findByClass(tree, 'state-fragment')).toHaveLength(1);
    expect(readText(tree)).toContain('Try again');
  });

  it('renders designed empty diary, search, and statistics states with geometric fragments', () => {
    const blankState: MovieLogState = {
      history: [],
      libraryItems: [],
      watchedFolders: []
    };
    const diaryTree = renderSurface('diary', { state: blankState });
    const searchTree = renderSurface('search', {
      searchGroups: buildSearchResults(blankState, 'unmatched', []),
      searchQuery: 'unmatched',
      state: blankState
    });
    const statisticsTree = renderSurface('statistics', { state: blankState });

    expect(findByClass(diaryTree, 'blank-slate')).toHaveLength(1);
    expect(findByClass(diaryTree, 'state-fragment')).toHaveLength(1);
    expect(findByClass(searchTree, 'blank-slate')).toHaveLength(1);
    expect(findByClass(statisticsTree, 'blank-slate')).toHaveLength(1);
  });

  it('shows a drop affordance overlay only while dragging', () => {
    expect(findByClass(renderSurface('diary', { dropActive: true }), 'drop-overlay')).toHaveLength(1);
    expect(findByClass(renderSurface('diary'), 'drop-overlay')).toHaveLength(0);
  });

  it('shows error feedback as an alert and notices as a status banner', () => {
    const errorTree = renderSurface('diary', {
      feedback: { message: 'Something failed.', tone: 'error' }
    });
    const noticeTree = renderSurface('diary', {
      feedback: { message: 'Path copied.', tone: 'notice' }
    });
    const errorBanner = findByClass(errorTree, 'status-error');
    const noticeBanner = findByClass(noticeTree, 'status-notice');

    expect(errorBanner).toHaveLength(1);
    expect(errorBanner[0]?.props.role).toBe('alert');
    expect(noticeBanner).toHaveLength(1);
    expect(noticeBanner[0]?.props.role).toBe('status');
  });

  it('hides file actions for catalog-only diary entries in the dossier', () => {
    const catalogState: MovieLogState = {
      films: {},
      history: [
        {
          id: '2026-07-11T20:00:00.000Z:film://wikipedia-23270459/Inception (2010)',
          source: 'drop',
          sourceKind: 'directory',
          sourcePath: 'film://wikipedia-23270459/Inception (2010)',
          title: 'Inception (2010)',
          watchedAt: '2026-07-11T20:00:00.000Z'
        }
      ],
      libraryItems: [],
      watchedFolders: []
    };
    const tree = renderSurface('detail', {
      selectedPath: 'film://wikipedia-23270459/Inception (2010)',
      state: catalogState
    });
    const text = readText(tree);

    expect(text).toContain('Logged from the film catalog');
    expect(text).not.toContain('Show in Finder');
    expect(text).toContain('Inception');
  });
});
