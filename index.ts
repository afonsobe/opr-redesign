import { extractArmyId, fetchArmy } from './src/api';
import {
  deleteList,
  getList,
  getLists,
  pruneCardImages,
  saveList,
  saveListSettings,
  type ListSettings,
  type SavedList,
} from './src/db';
import {
  createAvatarSizeControl,
  renderArmySummary,
  renderCards,
  renderSpecialRulesTable,
  renderSpellsTable,
  unitImageId,
} from './src/render';
import { initRouter, onRouteChange, onRouteEnter } from './src/router';
import type { ArmyList } from './src/types';
import { renderChangelog } from './src/views/changelog';
import { renderListsView, type ListsViewCallbacks } from './src/views/lists';
import { PALETTES, applyPalette, detectPalette, type Palette } from './src/palettes';
import { applyTranslations, getLang, setLang, t, type Lang } from './src/i18n';
import { setActiveSystem } from './src/i18n/content';
import { createThemeToggle } from './src/theme';
import packageMetadata from './package.json';

const CACHE_MAX_AGE_HOURS = 6;

const siteVersion = document.getElementById('site-version');
if (siteVersion) siteVersion.textContent = `v${packageMetadata.version}`;

const cardsContainerElement = document.getElementById('cards');
const inputElementElement = document.getElementById('armyLink');
const generateButton = document.getElementById('btnGenerate') as HTMLButtonElement | null;
const printButton = document.getElementById('btnPrint');
const refreshButton = document.getElementById('btnRefresh') as HTMLButtonElement | null;
const printOptions = document.querySelector('.print-options') as HTMLElement | null;
const optionPanels = document.querySelector('.option-panels') as HTMLElement | null;
const customizationOptions = document.getElementById('customization-options') as HTMLElement | null;
const paletteControlMount = document.getElementById('palette-control-mount') as HTMLElement | null;
const avatarSizeSlot = document.getElementById('avatar-size-slot') as HTMLElement | null;
const includeCardsCheckbox = document.getElementById('optCards') as HTMLInputElement | null;
const includeRulesCheckbox = document.getElementById('optRules') as HTMLInputElement | null;
const includeSpellsCheckbox = document.getElementById('optSpells') as HTMLInputElement | null;
const grayscaleCheckbox = document.getElementById('optGrayscale') as HTMLInputElement | null;
const customPaletteColors = document.getElementById('custom-palette-colors') as HTMLElement | null;
const customPaletteC1Input = document.getElementById('paletteCustomC1') as HTMLInputElement | null;
const customPaletteC2Input = document.getElementById('paletteCustomC2') as HTMLInputElement | null;
const combineUnitsCheckbox = document.getElementById('optCombine') as HTMLInputElement | null;
const customNamesCheckbox = document.getElementById('optCustomName') as HTMLInputElement | null;
const cardDesignButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-card-design]'));
const specialRulesSection = document.getElementById('special-rules');
const spellsSection = document.getElementById('spells');
const armySummarySection = document.getElementById('army-summary');
const listsView = document.getElementById('view-lists');
const changelogEntries = document.getElementById('changelog-entries');
const homeHelp = document.getElementById('home-help');
const faqView = document.getElementById('view-faq');
const homeHero = document.getElementById('home-hero');

if (!(cardsContainerElement instanceof HTMLDivElement)) {
  throw new Error('Missing #cards container.');
}

if (!(inputElementElement instanceof HTMLInputElement)) {
  throw new Error('Missing #armyLink input.');
}

const cardsContainer = cardsContainerElement;
const inputElement = inputElementElement;

const DEFAULT_DOCUMENT_TITLE = document.title;

// The army currently on screen, so "Refresh List" knows what to re-fetch and the
// "Combine similar units" toggle can re-render without re-fetching.
let currentArmyId: string | null = null;
let currentInput = '';
let currentArmy: ArmyList | null = null;
let cardDesign: 'classic' | 'tcg' = 'classic';
let lastAppliedPalette: Palette | null = null;

function getCardDesign(): 'classic' | 'tcg' {
  return cardDesign;
}

function setCardDesign(design: 'classic' | 'tcg'): void {
  cardDesign = design;
  for (const button of cardDesignButtons) {
    const selected = button.dataset.cardDesign === design;
    button.classList.toggle('is-active', selected);
    button.setAttribute('aria-pressed', selected.toString());
  }
  document.body.classList.toggle('card-layout-tcg', design === 'tcg');
}
setCardDesign('classic');

// Seletor de paleta, criado aqui e colocado junto das opções de impressão.
const paletteSelect = document.createElement('select');
paletteSelect.id = 'optPalette';
function paletteDisplayName(p: Palette): string {
  if (p.id === 'default') return t('palette.default');
  if (p.id === 'custom') return t('palette.custom');
  return p.label.split(' — ')[0] ?? p.label;
}

// (Re)monta as opções do seletor no idioma atual, mantendo a escolha.
function buildPaletteOptions(): void {
  const previous = paletteSelect.value || 'auto';
  const group = (title: string, game: Palette['game']): string =>
    `<optgroup label="${title}">` +
    PALETTES.filter((p) => p.game === game)
      .map((p) => `<option value="${p.id}">${paletteDisplayName(p)}</option>`)
      .join('') +
    '</optgroup>';

  paletteSelect.innerHTML =
    '<option value="auto"></option>' +
    `<optgroup label="${t('palette.general')}"><option value="default">${t('palette.default')}</option><option value="custom">${t('palette.custom')}</option></optgroup>` +
    group('Grimdark Future', 'GF') +
    group('Age of Fantasy', 'AoF');
  paletteSelect.value = previous;
}
buildPaletteOptions();

const paletteLabel = document.createElement('label');
paletteLabel.className = 'palette-control-label';
const paletteLabelText = document.createElement('span');
paletteLabelText.dataset.i18n = 'opt.palette';
paletteLabel.append(paletteLabelText, paletteSelect);
paletteControlMount?.appendChild(paletteLabel);
// The size control lives in the customization panel and appears only when a
// card has an image (controlled by CSS).
avatarSizeSlot?.appendChild(createAvatarSizeControl());

function paletteStorageKey(): string {
  return `palette:${currentArmyId ?? ''}`;
}

function customPaletteStorageKey(): string {
  return `palette-custom:${currentArmyId ?? ''}`;
}

function isPaletteHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}

function readCustomPaletteColors(): { c1: string; c2: string } | null {
  try {
    const saved = localStorage.getItem(customPaletteStorageKey());
    if (!saved) return null;
    const colors = JSON.parse(saved) as { c1?: unknown; c2?: unknown };
    return isPaletteHexColor(colors.c1) && isPaletteHexColor(colors.c2)
      ? { c1: colors.c1, c2: colors.c2 }
      : null;
  } catch {
    return null;
  }
}

function saveCustomPaletteColors(): void {
  if (!isPaletteHexColor(customPaletteC1Input?.value) || !isPaletteHexColor(customPaletteC2Input?.value)) return;
  try {
    localStorage.setItem(
      customPaletteStorageKey(),
      JSON.stringify({ c1: customPaletteC1Input.value, c2: customPaletteC2Input.value }),
    );
  } catch (error) {
    console.error('Failed to save custom palette:', error);
  }
}

function restoreCustomPaletteColors(fallback: Palette): void {
  if (!customPaletteC1Input || !customPaletteC2Input) return;
  const saved = readCustomPaletteColors();
  customPaletteC1Input.value = saved?.c1 ?? fallback.c1;
  customPaletteC2Input.value = saved?.c2 ?? fallback.c2;
}

function automaticPalette(): Palette {
  // Automatic: first match the army book name, then the user-provided list name.
  const bookNames = (currentArmy?.armyBooks ?? []).map((book) => book.name).join(' ');
  const fromBook = detectPalette(bookNames);
  if (fromBook.id !== 'default') return fromBook;
  return detectPalette(currentArmy?.name ?? '');
}

function currentPalette(): Palette {
  if (paletteSelect.value === 'custom') {
    const colors = readCustomPaletteColors() ?? {
      c1: customPaletteC1Input?.value ?? '#3a3a4a',
      c2: customPaletteC2Input?.value ?? '#2a6b66',
    };
    return {
      id: 'custom',
      game: 'geral',
      label: t('palette.custom'),
      c1: colors.c1,
      c2: colors.c2,
      keywords: [],
    };
  }

  const chosen = PALETTES.find((p) => p.id === paletteSelect.value);
  if (chosen) return chosen;
  return automaticPalette();
}

// Aplica a paleta e deixa visível, no seletor, qual está em uso.
function refreshPalette(): void {
  const palette = currentPalette();
  applyPalette(palette);
  lastAppliedPalette = palette;
  if (customPaletteColors) customPaletteColors.hidden = paletteSelect.value !== 'custom';
  const autoOption = paletteSelect.options.item(0);
  if (autoOption) {
    autoOption.textContent =
      paletteSelect.value === 'auto'
        ? t('palette.autoPicked', { name: paletteDisplayName(palette) })
        : t('palette.auto');
  }
}
paletteSelect.addEventListener('change', () => {
  if (paletteSelect.value === 'custom') {
    restoreCustomPaletteColors(lastAppliedPalette ?? automaticPalette());
    saveCustomPaletteColors();
  }
  try {
    localStorage.setItem(paletteStorageKey(), paletteSelect.value);
  } catch (error) {
    console.error('Failed to save palette:', error);
  }
  refreshPalette();
  persistCurrentSettings();
});

for (const input of [customPaletteC1Input, customPaletteC2Input]) {
  input?.addEventListener('input', () => {
    saveCustomPaletteColors();
    refreshPalette();
    persistCurrentSettings();
  });
}

// Default toggle states, matching the `checked` attributes in index.html. Used
// when a saved list predates per-army settings, so it loads predictably.
const DEFAULT_SETTINGS: ListSettings = {
  combineSimilar: false,
  useCustomNames: true,
  cardDesign: 'classic',
  includeCards: true,
  includeRules: true,
  includeSpells: true,
  printGrayscale: false,
};

function getCurrentSettings(): ListSettings {
  return {
    combineSimilar: combineUnitsCheckbox?.checked ?? DEFAULT_SETTINGS.combineSimilar,
    useCustomNames: customNamesCheckbox?.checked ?? DEFAULT_SETTINGS.useCustomNames,
    cardDesign: getCardDesign(),
    includeCards: includeCardsCheckbox?.checked ?? DEFAULT_SETTINGS.includeCards,
    includeRules: includeRulesCheckbox?.checked ?? DEFAULT_SETTINGS.includeRules,
    includeSpells: includeSpellsCheckbox?.checked ?? DEFAULT_SETTINGS.includeSpells,
    printGrayscale: grayscaleCheckbox?.checked ?? DEFAULT_SETTINGS.printGrayscale,
  };
}

// Reflect a saved list's settings (or the defaults) onto the checkboxes, then
// sync the print body classes that derive from them. Call before displaying the
// army so the first render already honors the restored options.
function applySettings(settings?: ListSettings): void {
  const resolved = settings ?? DEFAULT_SETTINGS;
  if (combineUnitsCheckbox) combineUnitsCheckbox.checked = resolved.combineSimilar;
  if (customNamesCheckbox) customNamesCheckbox.checked = resolved.useCustomNames;
  setCardDesign(resolved.cardDesign === 'tcg' ? 'tcg' : 'classic');
  if (includeCardsCheckbox) includeCardsCheckbox.checked = resolved.includeCards;
  if (includeRulesCheckbox) includeRulesCheckbox.checked = resolved.includeRules;
  if (includeSpellsCheckbox) includeSpellsCheckbox.checked = resolved.includeSpells;
  if (grayscaleCheckbox) grayscaleCheckbox.checked = resolved.printGrayscale ?? false;
  applyPrintToggles();
}

// Persist the current toggle states against the army on screen, so loading it
// again later restores them.
function persistCurrentSettings(): void {
  if (!currentArmyId) return;
  void saveListSettings(currentArmyId, getCurrentSettings()).catch((error) =>
    console.error('Failed to save list settings:', error),
  );
}

function setDocumentTitle(listName?: string): void {
  const name = listName?.trim();
  document.title = name || DEFAULT_DOCUMENT_TITLE;
}

function setPrintControlsVisible(visible: boolean): void {
  if (printButton) printButton.style.display = visible ? '' : 'none';
  if (refreshButton) refreshButton.style.display = visible ? '' : 'none';
  if (optionPanels) optionPanels.style.display = visible ? '' : 'none';
  if (printOptions) printOptions.style.display = visible ? '' : 'none';
  if (customizationOptions) customizationOptions.hidden = !visible;
  // The welcome block greets users while no army is on screen and steps aside
  // once the cards take over.
  if (homeHero) homeHero.hidden = visible;
  // The onboarding help is the inverse of the army being on screen: show it
  // whenever no army is loaded, hide it once cards render.
  if (homeHelp) homeHelp.hidden = visible;
}

function setMessage(message: string, type: 'loading' | 'error' | 'empty' = 'empty'): void {
  setPrintControlsVisible(false);
  setDocumentTitle();
  cardsContainer.replaceChildren();
  armySummarySection?.replaceChildren();
  specialRulesSection?.replaceChildren();
  spellsSection?.replaceChildren();

  const messageElement = document.createElement('div');
  messageElement.className = `message ${type}`;
  messageElement.textContent = message;

  cardsContainer.appendChild(messageElement);
}

function displayArmy(army: ArmyList, input: string): void {
  currentArmyId = army.id || null;
  currentInput = input;
  currentArmy = army;
  restoreCustomPaletteColors(automaticPalette());
  // Fixa o dicionário de conteúdo no sistema desta lista (evita misturar GF com GFF).
  setActiveSystem((army as { gameSystemSlug?: string }).gameSystemSlug ?? army.gameSystem);

    // Restaura a paleta escolhida antes para esta lista (ou "automática").
  const savedPalette = localStorage.getItem(paletteStorageKey());
  paletteSelect.value = savedPalette === 'custom' || PALETTES.some((p) => p.id === savedPalette)
    ? savedPalette ?? 'auto'
    : 'auto';
  refreshPalette();

  const unitCount = renderCards(
    cardsContainer,
    army,
    combineUnitsCheckbox?.checked ?? true,
    customNamesCheckbox?.checked ?? false,
    getCardDesign(),
  );

  if (unitCount === 0) {
    setMessage(t('msg.noUnits'), 'empty');
  } else {
    setDocumentTitle(army.gameSystem ? `${army.gameSystem.toUpperCase()} - ${army.name}` : army.name);
    setPrintControlsVisible(true);
  }

  if (armySummarySection) renderArmySummary(armySummarySection, army);
  if (specialRulesSection) renderSpecialRulesTable(specialRulesSection, army);
  if (spellsSection) renderSpellsTable(spellsSection, army);
}



async function loadArmy(): Promise<void> {
  const input = inputElement.value.trim();
  const armyId = extractArmyId(input);

  if (!armyId) {
    setMessage(t('msg.pasteLink'), 'error');
    inputElement.focus();
    return;
  }

  localStorage.setItem('lastArmyInput', input);

  // Cópia salva: restaura as opções da lista, evita buscas recentes ao servidor
  // e serve como reserva se uma busca necessária falhar.
  let cached: SavedList | undefined;
  try {
    cached = (await getList(armyId)) ?? undefined;
  } catch (error) {
    console.error('Failed to read cached list:', error);
  }
  if (cached) {
    applySettings(cached.settings);
    const updatedAt = Date.parse(cached.updatedAt);
    const ageMs = Date.now() - updatedAt;
    const maxAgeMs = CACHE_MAX_AGE_HOURS * 60 * 60 * 1000;

    if (Number.isFinite(updatedAt) && ageMs >= 0 && ageMs < maxAgeMs) {
      displayArmy(cached.payload, cached.input);
      return;
    }
  }

  setMessage(t('msg.loading'), 'loading');
  generateButton?.setAttribute('disabled', 'true');

  try {
    // Cache ausente ou vencido: busca a versão mais recente no Army Forge.
    const army = await fetchArmy(armyId);
    await pruneRemovedUnitImages(army);
    displayArmy(army, input);

    try {
      await saveList(army, input);
      // Só grava as opções na primeira vez; depois mantém as que já existiam.
      if (!cached && army.id) await saveListSettings(army.id, getCurrentSettings());
    } catch (saveError) {
      console.error('Failed to save list:', saveError);
    }
  } catch (error) {
    console.error(error);
    if (cached) {
      // Falhou a busca: mostra a cópia salva em vez de dar erro.
      displayArmy(cached.payload, cached.input);
    } else {
      setMessage(
        t('msg.loadError'),
        'error',
      );
    }
  } finally {
    generateButton?.removeAttribute('disabled');
  }
}

// After a refresh, drop saved card images for units no longer in the list.
// Units still present (even when combined into another card) are kept.
async function pruneRemovedUnitImages(army: ArmyList): Promise<void> {
  if (!army.id) return;
  const keep = new Set((Array.isArray(army.units) ? army.units : []).map(unitImageId));
  try {
    await pruneCardImages(army.id, keep);
  } catch (error) {
    console.error('Failed to prune card images:', error);
  }
}

/** Re-fetch the army on screen from the relay and refresh the cached copy. */
async function refreshArmy(): Promise<void> {
  if (!currentArmyId) return;

  const id = currentArmyId;
  const input = currentInput || id;
  refreshButton?.setAttribute('disabled', 'true');

  try {
    const army = await fetchArmy(id);
    await pruneRemovedUnitImages(army);
    displayArmy(army, input);
    try {
      await saveList(army, input);
    } catch (saveError) {
      console.error('Failed to save list:', saveError);
    }
  } catch (error) {
    console.error(error);
    window.alert(t('msg.refreshError'));
  } finally {
    refreshButton?.removeAttribute('disabled');
  }
}

generateButton?.addEventListener('click', loadArmy);
refreshButton?.addEventListener('click', () => void refreshArmy());
printButton?.addEventListener('click', () => window.print());

// Sync the print-hiding body classes from the current checkbox states. Driven by
// the checkboxes' change events and re-run whenever settings are applied
// programmatically (which doesn't fire change).
function applyPrintToggles(): void {
  document.body.classList.toggle('print-hide-cards', !(includeCardsCheckbox?.checked ?? true));
  document.body.classList.toggle('print-hide-rules', !(includeRulesCheckbox?.checked ?? true));
  document.body.classList.toggle('print-hide-spells', !(includeSpellsCheckbox?.checked ?? true));
  document.body.classList.toggle('print-grayscale', grayscaleCheckbox?.checked ?? false);
}

for (const checkbox of [includeCardsCheckbox, includeRulesCheckbox, includeSpellsCheckbox, grayscaleCheckbox]) {
  checkbox?.addEventListener('change', () => {
    applyPrintToggles();
    persistCurrentSettings();
  });
}
applyPrintToggles();

// Unlike the print toggles, these change the cards themselves, so re-render the
// army on screen (no re-fetch needed) whenever either flips.
const reRenderCards = (): void => {
  if (currentArmy) {
    renderCards(
      cardsContainer,
      currentArmy,
      combineUnitsCheckbox?.checked ?? true,
      customNamesCheckbox?.checked ?? false,
      getCardDesign(),
    );
  }
};
const onCardOptionChange = (): void => {
  reRenderCards();
  persistCurrentSettings();
};
combineUnitsCheckbox?.addEventListener('change', onCardOptionChange);
customNamesCheckbox?.addEventListener('change', onCardOptionChange);
for (const button of cardDesignButtons) {
  button.addEventListener('click', () => {
    setCardDesign(button.dataset.cardDesign === 'tcg' ? 'tcg' : 'classic');
    onCardOptionChange();
  });
}
inputElement.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    void loadArmy();
  }
});

const listsCallbacks: ListsViewCallbacks = {
  onLoad: (saved: SavedList) => {
    inputElement.value = saved.input;
    localStorage.setItem('lastArmyInput', saved.input);
    applySettings(saved.settings);
    displayArmy(saved.payload, saved.input);
    window.location.hash = '#/';
  },
  onRefresh: async (saved: SavedList) => {
    try {
      const army = await fetchArmy(saved.id);
      await pruneRemovedUnitImages(army);
      await saveList(army, saved.input);
    } catch (error) {
      console.error('Failed to refresh list:', error);
      window.alert(t('msg.refreshError'));
    }
    await refreshListsView();
  },
  onDelete: async (saved: SavedList) => {
    await deleteList(saved.id);
    await refreshListsView();
  },
};

async function refreshListsView(): Promise<void> {
  if (!listsView) return;
  const lists = await getLists();
  renderListsView(listsView, lists, listsCallbacks);
}

onRouteEnter('/lists', () => {
  void refreshListsView();
});

// Clear the loaded army whenever the user leaves Home. Returning to Home then
// shows the FAQ again instead of the previous army — a deliberate nudge to get
// people reading the FAQ while they learn the system. The lists view loads an
// army and *then* navigates to Home, so entering Home itself never resets.
function resetHome(): void {
  currentArmyId = null;
  currentInput = '';
  currentArmy = null;
  cardsContainer.replaceChildren();
  armySummarySection?.replaceChildren();
  specialRulesSection?.replaceChildren();
  spellsSection?.replaceChildren();
  inputElement.value = '';
  localStorage.removeItem('lastArmyInput');
  applySettings(DEFAULT_SETTINGS);
  setDocumentTitle();
  setPrintControlsVisible(false);
}

onRouteChange((route) => {
  if (route !== '/') resetHome();
});

if (changelogEntries) renderChangelog(changelogEntries);

// Clone the FAQ (callout + Q&A) onto the Home screen so it greets users while no
// army is loaded — the FAQ page itself stays as the canonical source, this just
// surfaces the same content where people actually look.
if (homeHelp && faqView) {
  const heading = document.createElement('h2');
  heading.className = 'home-help-title';
  heading.textContent = 'New here? How to use OPR Card Generator';
  homeHelp.appendChild(heading);
  for (const node of Array.from(faqView.querySelectorAll('.faq-callout, .faq-section'))) {
    homeHelp.appendChild(node.cloneNode(true));
  }
}

inputElement.value = localStorage.getItem('lastArmyInput') ?? '';
setPrintControlsVisible(false);

const langSelect = document.getElementById('langSelect') as HTMLSelectElement | null;
if (langSelect) {
  langSelect.value = getLang();
  langSelect.addEventListener('change', () => {
    setLang(langSelect.value as Lang);
    applyTranslations();
    if (changelogEntries) renderChangelog(changelogEntries);
    buildPaletteOptions();
    if (currentArmy) {
      displayArmy(currentArmy, currentInput); // redesenha cartas e tabelas
    } else {
      refreshPalette();
    }
    void refreshListsView();
  });
}
applyTranslations();
refreshPalette();
document.querySelector('.topbar')?.appendChild(createThemeToggle());





initRouter();
