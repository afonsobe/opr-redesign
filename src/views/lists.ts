import type { SavedList } from '../db';
import { getLang, t } from '../i18n';

export interface ListsViewCallbacks {
  onLoad: (saved: SavedList) => void;
  onRefresh: (saved: SavedList) => Promise<void>;
  onDelete: (saved: SavedList) => Promise<void>;
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return t('lists.unknown');

  const seconds = Math.floor((Date.now() - then) / 1000);
  if (seconds < 60) return t('lists.justNow');

  // O próprio navegador escreve "3 hours ago" / "há 3 horas".
  const rtf = new Intl.RelativeTimeFormat(getLang(), { numeric: 'always' });
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 31536000],
    ['month', 2592000],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];

  for (const [unit, secs] of units) {
    const value = Math.floor(seconds / secs);
    if (value >= 1) return rtf.format(-value, unit);
  }
  return t('lists.justNow');
}

function createButton(label: string, className: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  return button;
}

// Official system names are intentionally identical in English and pt-BR.
function fullSystemName(system: string): string {
  const key = system.trim().toLowerCase();
  const names: Record<string, string> = {
    gf: 'Grimdark Future',
    'grimdark-future': 'Grimdark Future',
    'grimdark future': 'Grimdark Future',
    gff: 'Grimdark Future: Firefight',
    'grimdark-future-firefight': 'Grimdark Future: Firefight',
    'grimdark future: firefight': 'Grimdark Future: Firefight',
    aof: 'Age of Fantasy',
    'age-of-fantasy': 'Age of Fantasy',
    'age of fantasy': 'Age of Fantasy',
    aofs: 'Age of Fantasy: Skirmish',
    'age-of-fantasy-skirmish': 'Age of Fantasy: Skirmish',
    'age of fantasy: skirmish': 'Age of Fantasy: Skirmish',
    aofr: 'Age of Fantasy: Regiments',
    'age-of-fantasy-regiments': 'Age of Fantasy: Regiments',
    'age of fantasy: regiments': 'Age of Fantasy: Regiments',
    wf: 'Grimdark Future: Warfleets',
    gfw: 'Grimdark Future: Warfleets',
    warfleets: 'Grimdark Future: Warfleets',
    'grimdark-future-warfleets': 'Grimdark Future: Warfleets',
    'grimdark future: warfleets': 'Grimdark Future: Warfleets',
  };
  return names[key] ?? (system.trim() || t('lists.unknown'));
}

function createListItem(saved: SavedList, cb: ListsViewCallbacks): HTMLDivElement {
  const item = document.createElement('div');
  item.className = 'saved-list';

  const info = document.createElement('div');
  info.className = 'saved-list-info';

  const name = document.createElement('div');
  name.className = 'saved-list-name';
  name.textContent = saved.name || t('lists.unnamed');

  const meta = document.createElement('div');
  meta.className = 'saved-list-meta';
  meta.textContent = `${saved.listPoints} / ${saved.pointsLimit} pts`;

  const when = document.createElement('div');
  when.className = 'saved-list-when';
  when.textContent = t('lists.updated', { when: timeAgo(saved.updatedAt) });

  info.append(name, meta, when);

  const actions = document.createElement('div');
  actions.className = 'saved-list-actions';

  const loadButton = createButton(t('lists.load'), 'saved-list-btn');
  loadButton.title = t('lists.loadTitle');
  loadButton.addEventListener('click', () => cb.onLoad(saved));

  const refreshButton = createButton(t('lists.refresh'), 'saved-list-btn');
  refreshButton.title = t('lists.refreshTitle');
  refreshButton.addEventListener('click', () => {
    refreshButton.disabled = true;
    refreshButton.textContent = t('lists.refreshing');
    void cb.onRefresh(saved).finally(() => {
      refreshButton.disabled = false;
      refreshButton.textContent = t('lists.refresh');
    });
  });

  const deleteButton = createButton(t('lists.delete'), 'saved-list-btn saved-list-btn--danger');
  deleteButton.title = t('lists.deleteTitle');
  deleteButton.addEventListener('click', () => {
    if (!window.confirm(t('lists.confirmDelete', { name: saved.name || t('lists.thisList') }))) {
      return;
    }
    deleteButton.disabled = true;
    void cb.onDelete(saved);
  });

  actions.append(loadButton, refreshButton, deleteButton);
  item.append(info, actions);
  return item;
}

export function renderListsView(
  container: HTMLElement,
  lists: SavedList[],
  cb: ListsViewCallbacks,
): void {
  container.replaceChildren();

  const title = document.createElement('h1');
  title.className = 'view-title';
  title.textContent = t('lists.title');
  container.append(title);

  if (lists.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'view-placeholder';
    empty.textContent = t('lists.empty');
    container.append(empty);
    return;
  }

  const groups = new Map<string, SavedList[]>();
  for (const saved of lists) {
    const system = fullSystemName(saved.payload.gameSystemSlug || saved.gameSystem);
    const group = groups.get(system) ?? [];
    group.push(saved);
    groups.set(system, group);
  }

  const listEl = document.createElement('div');
  listEl.className = 'saved-list-groups';
  for (const [system, systemLists] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const section = document.createElement('section');
    section.className = 'saved-list-group';

    const heading = document.createElement('h2');
    heading.className = 'saved-list-system';
    heading.textContent = system;

    const groupList = document.createElement('div');
    groupList.className = 'saved-lists';
    for (const saved of systemLists) groupList.append(createListItem(saved, cb));

    section.append(heading, groupList);
    listEl.append(section);
  }
  container.append(listEl);
}
