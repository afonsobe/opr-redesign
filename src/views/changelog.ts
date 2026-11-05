import changelog from '../data/changelog.json';
import { getLang } from '../i18n';

export interface ChangelogEntry {
  date: string;
  datePtBR?: string;
  items: string[];
  itemsPtBR?: string[];
}

// Turn an item string into DOM nodes, converting **bold** spans into <strong>
// so the data file stays plain text instead of raw HTML.
function appendFormatted(target: HTMLElement, text: string): void {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  parts.forEach((part, index) => {
    if (!part) return;
    if (index % 2 === 1) {
      const strong = document.createElement('strong');
      strong.textContent = part;
      target.appendChild(strong);
    } else {
      target.appendChild(document.createTextNode(part));
    }
  });
}

function createEntry(entry: ChangelogEntry): HTMLDivElement {
  const lang = getLang();
  const wrapper = document.createElement('div');
  wrapper.className = 'changelog-entry';

  const date = document.createElement('h2');
  date.className = 'changelog-date';
  date.textContent = lang === 'pt-BR' ? entry.datePtBR ?? entry.date : entry.date;

  const list = document.createElement('ul');
  list.className = 'changelog-list';
  for (const [index, itemEN] of entry.items.entries()) {
    const item = lang === 'pt-BR' ? entry.itemsPtBR?.[index] ?? itemEN : itemEN;
    const li = document.createElement('li');
    appendFormatted(li, item);
    list.appendChild(li);
  }

  wrapper.append(date, list);
  return wrapper;
}

/** Render the changelog entries (newest first) into `container`. */
export function renderChangelog(container: HTMLElement): void {
  container.replaceChildren();
  for (const entry of changelog as ChangelogEntry[]) {
    container.appendChild(createEntry(entry));
  }
}
