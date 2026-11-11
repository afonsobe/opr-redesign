import html2canvas from 'html2canvas';
import { getLang, t, tn } from './i18n';
// Tradução do conteúdo vindo do Army Forge (regras, armas e magias). Aplica-se
// só na hora de desenhar: os dados em `army` continuam em inglês para as
// comparações internas (Tough, AP, ligação de regras citadas etc.).
import {
  STALE_MARK,
  findSourceRuleByName,
  isStaleText,
  listSourceRules,
  trRuleDescription,
  trRuleGainName,
  trRuleLabel,
  trRuleName,
  trSpellEffect,
  trSpellName,
  trItemName,
  trWeaponName,
} from './i18n/content';

import { deleteCardImage, getCardImage, saveCardImage } from './db';
import type {
  ArmySpecialRule,
  ArmyList,
  CardDesign,
  SelectedUpgrade,
  Ship,
  ShipHeroTitle,
  ShipSystem,
  ShipWeapon,
  Unit,
  UnitRule,
  UpgradeGain,
  Weapon,
  WeaponSpecialRule,
} from './types';

// Stable per-list identity for a unit, used to key its saved background image.
// `selectionId` is unique per unit selection and survives "Refresh List"; falls
// back to the army-book id if a payload ever omits it.
export function unitImageId(unit: Unit): string {
  return unit.selectionId || unit.id || '';
}

// --- Unit data helpers -------------------------------------------------------

function getRules(unit: Unit) {
  return Array.isArray(unit.rules) ? unit.rules : [];
}

// A plain weapon exposes `attacks` directly. Bundled items (e.g. "Weapon Team")
// come through as an ArmyBookItem with no top-level `attacks` — the weapon lives
// nested in `content` — so we recurse to still treat those as weapons.
function hasWeaponProfile(item: { attacks?: number; content?: WeaponSpecialRule[] }): boolean {
  if (typeof item.attacks === 'number') return true;
  return Array.isArray(item.content) && item.content.some(hasWeaponProfile);
}

function isWeapon(item: Weapon): boolean {
  return hasWeaponProfile(item);
}

function getWeapons(unit: Unit): Weapon[] {
  return Array.isArray(unit.loadout) ? unit.loadout.filter(isWeapon) : [];
}

// The label a weapon renders under. A plain weapon ships its own `label` (e.g.
// "Shock Pistol (12\", A1, AP(4))"). A bundled item counts as a weapon because a
// weapon lives nested in its `content` (e.g. an "Energy Shield" carrying a "Bash"
// attack, or a "Weapon Team") — but such an item may omit its own top-level
// label, so we fall back to the nested weapon profiles' labels, then to the bare
// name. Without this fallback `mergeWeapons` reads `label` off `undefined` and
// the whole sheet fails to render.
function getWeaponLabel(weapon: Weapon): string {
  if (weapon.label?.trim()) return weapon.label;

  const nested = (Array.isArray(weapon.content) ? weapon.content : [])
    .filter(hasWeaponProfile)
    .map((item) => item.label?.trim() || item.name?.trim() || '')
    .filter(Boolean);
  if (nested.length > 0) return nested.join(', ');

  return weapon.name?.trim() ?? '';
}

function getUpgrades(unit: Unit): Weapon[] {
  return Array.isArray(unit.loadout) ? unit.loadout.filter((item) => !isWeapon(item)) : [];
}

function getWeaponSpecialRules(weapon: Weapon): WeaponSpecialRule[] {
  return Array.isArray(weapon.specialRules) ? weapon.specialRules : [];
}

// Regras concedidas por um item do loadout (ex.: "Camo Cloak" concedendo "Stealth").
// A fonte é o `content` do item (as regras que ele concede); se vier vazio ou
// ausente, usa `specialRules` como alternativa. Cada texto é o nome da regra com
// o rating quando existe, ex.: "Stealth" ou "Caster(3)".
function getItemRules(item: Weapon): string[] {
  const content = Array.isArray(item.content) ? item.content : [];
  const source = content.length > 0 ? content : Array.isArray(item.specialRules) ? item.specialRules : [];
  const texts: string[] = [];
  for (const rule of source) {
    const text = ruleText(rule);
    const trimmed = text?.trim();
    if (trimmed) texts.push(trimmed);
  }
  return texts;
}

// Some upgrades grant a special rule to a subset of a unit's models rather than
// a weapon or item — e.g. upgrading one model to a "Sergeant". Army Forge folds
// weapon/item upgrades into `loadout`, but a rule-only upgrade lands nowhere the
// card otherwise reads: it isn't in `loadout` and (being model-specific) isn't
// merged into `rules` either. So we read it straight from `selectedUpgrades`.
// Army Forge shows these as "1x Sergeant" — the count being how many models gain
// the rule — so we keep the count prefix even when it's 1.
function getUpgradeRuleGains(unit: Unit): { gain: UpgradeGain; count: number }[] {
  const selected = Array.isArray(unit.selectedUpgrades) ? unit.selectedUpgrades : [];
  const existing = new Set(getRules(unit).map((rule) => rule.name));
  const result: { gain: UpgradeGain; count: number }[] = [];

  for (const selection of selected) {
    const gains = Array.isArray(selection.option?.gains) ? selection.option.gains : [];
    const count = selection.upgrade?.affects?.value ?? 1;
    for (const gain of gains) {
      if (gain.type !== 'ArmyBookRule') continue;
      const label = gain.label?.trim() || gain.name?.trim() || '';
      if (!label || existing.has(gain.name ?? label)) continue;
      result.push({ gain, count });
    }
  }

  return result;
}

// Army Forge shows these as "1x Sergeant" — the count being how many models gain
// the rule — so we keep the count prefix even when it's 1.
//
// Quando a regra vem embutida em um item (ex.: "Combat Mutations (Piercing
// Growth)"), o texto antes dos parênteses é sabor/flavor e a regra de verdade
// é o que está dentro. Traduzimos só a regra, mantendo o flavor em inglês:
// "1x Combat Mutations (Crescimento Perfurante)".
function getUpgradeRulePills(unit: Unit): string[] {
  return getUpgradeRuleGains(unit).map(({ gain, count }) => {
    const label = gain.label?.trim() || gain.name?.trim() || '';
    const translatedRule = trRuleGainName(gain);
    const openParen = label.indexOf('(');
    if (openParen > 0 && label.endsWith(')')) {
      const flavor = label.slice(0, openParen).trim();
      const inner = label.slice(openParen + 1, -1).trim();
      const ruleText = translatedRule && translatedRule !== inner ? translatedRule : inner;
      return `${count}x ${flavor} (${ruleText})`;
    }
    return `${count}x ${translatedRule || label}`;
  });
}

function getTough(unit: Unit): string {
  const rule = getRules(unit).find((item) => item.name === 'Tough');
  return rule?.rating?.toString() ?? '-';
}

// The base-info line doubles as the card's "which army / which game" label, so a
// player who mixes printed cards from several lists can sort them back — e.g.
// "Eternal Dynasty - GF - 60x35mm". Army name and game system come from the list;
// the base size is the unit's round base.
function getBaseLabel(unit: Unit, armyName: string, gameSystem: string): string {
  const roundBase = unit.bases?.round;
  const baseSize = roundBase ? `${roundBase}mm` : '?';
  return [armyName, gameSystem.toUpperCase(), baseSize].filter(Boolean).join(' - ');
}

// Army Forge's `unit.cost` is only the base profile cost — the points paid for
// selected upgrades live on each upgrade option, not folded into the unit total.
// An option's price depends on which unit takes it, so it ships a `costs` array
// keyed by unit id; we match this unit's id and fall back to the flat `cost`.
function getUpgradeCost(unit: Unit, selection: SelectedUpgrade): number {
  const option = selection.option;
  if (!option) return 0;
  const match = Array.isArray(option.costs)
    ? option.costs.find((entry) => entry.unitId === unit.id)
    : undefined;
  if (match && typeof match.cost === 'number') return match.cost;
  return typeof option.cost === 'number' ? option.cost : 0;
}

// The true unit total shown on the card: base cost plus every selected upgrade.
// Merged "Combine Units" halves precompute this into `totalCost` (each half is
// priced against its own id, so the sum can't be recovered from the merged unit).
function getUnitTotalCost(unit: Unit): number {
  if (typeof unit.totalCost === 'number') return unit.totalCost;
  const base = typeof unit.cost === 'number' ? unit.cost : 0;
  const selected = Array.isArray(unit.selectedUpgrades) ? unit.selectedUpgrades : [];
  return base + selected.reduce((sum, sel) => sum + getUpgradeCost(unit, sel), 0);
}

// --- Small DOM helpers -------------------------------------------------------

function createSectionHeading(text: string): HTMLHeadingElement {
  const heading = document.createElement('h3');
  heading.className = 'sheet-heading';
  heading.textContent = text;
  return heading;
}

// Nota de rodapé para traduções desatualizadas (marcadas com †). Inserida
// logo abaixo do título de cada tabela e abaixo das cartas.
function createStaleNote(): HTMLParagraphElement {
  const note = document.createElement('p');
  note.className = 'stale-note';
  note.textContent = t('stale.note');
  return note;
}

// Liga/desliga o † no fim de um texto (para o † ficar depois de (X)/custo).
function stripStaleText(text: string): string {
  return isStaleText(text) ? text.slice(0, -STALE_MARK.length) : text;
}


function createTextElement(className: string, text: string): HTMLDivElement {
  const element = document.createElement('div');
  element.className = className;
  element.textContent = text;
  return element;
}

function createStat(label: string, value: string): HTMLDivElement {
  const stat = document.createElement('div');
  stat.className = 'stat';
  stat.append(
    createTextElement('stat-label', label),
    createTextElement('stat-value', value),
  );
  return stat;
}

interface MergedWeapon {
  name: string;
  range: string;
  attacks: string;
  ap: string;
  special: string;
  count: number;
}

// Mesma ideia de antes: armas com o mesmo perfil viram uma linha só, com a
// quantidade somada. O "Nx " do começo do label é removido pra não duplicar.
function mergeWeapons(weapons: Weapon[]): MergedWeapon[] {
  const order: string[] = [];
  const byKey = new Map<string, MergedWeapon>();

  for (const weapon of weapons) {
    const key = getWeaponLabel(weapon).replace(/^\s*\d+x\s+/, '');
    const count = typeof weapon.count === 'number' ? weapon.count : 0;
    const existing = byKey.get(key);
    if (existing) {
      existing.count += count;
      continue;
    }

    const rules = getWeaponSpecialRules(weapon);
    // A regra "AP" é separada na coluna PA; as demais viram texto na coluna
    // "Regras especiais", já traduzidas quando houver tradução.
    const apRule = rules.find((rule) => rule.name === 'AP');
    const others = rules
      .filter((rule) => rule.name !== 'AP')
      .map((rule) => trRuleLabel(rule))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    byKey.set(key, {
      name: trWeaponName(weapon) || key,
      range: weapon.range > 0 ? `${weapon.range}"` : '-',
      attacks: typeof weapon.attacks === 'number' ? `A${weapon.attacks}` : '-',
      ap: apRule?.rating != null ? String(apRule.rating) : '-',
      special: others.length > 0 ? others.join(', ') : '-',
      count,
    });
    order.push(key);
  }

  const result = order.map((key) => byKey.get(key) as MergedWeapon);
  // Armas de tiro (range diferente de '-') antes das de corpo a corpo (range '-').
  // Ordenação estável dentro de cada grupo (mantém ordem original).
  result.sort((a, b) => {
    const aGun = a.range !== '-';
    const bGun = b.range !== '-';
    if (aGun !== bGun) return aGun ? -1 : 1;
    return 0;
  });
  return result;
}

interface MergedItem {
  name: string;
  special: string;
  count: number;
}

// Itens do loadout que não são armas (equipamentos, montarias, etc.) também
// aparecem na carta. Mesmo perfil = uma linha só, com a quantidade somada.
function mergeItems(items: Weapon[]): MergedItem[] {
  const merged = new Map<string, MergedItem>();
  const order: string[] = [];
  for (const item of items) {
    const originalName = item.name?.trim() || item.label?.trim() || '';
    const name = trItemName(originalName) || originalName;
    const itemTexts = getItemRules(item)
      .map((text) => text?.trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    const special = itemTexts.length > 0 ? itemTexts.join(', ') : '-';
    const key = `${originalName}::${special}`;
    const count = typeof item.count === 'number' ? item.count : 1;
    const existing = merged.get(key);
    if (existing) {
      existing.count += count;
      continue;
    }
    merged.set(key, { name, special, count });
    order.push(key);
  }
  return order.map((key) => merged.get(key) as MergedItem);
}

function createWeaponsTable(weapons: MergedWeapon[], items: Weapon[] = []): HTMLTableElement {
  const table = document.createElement('table');
  table.className = 'weapons-table';

  const head = table.createTHead().insertRow();
  const headerTexts: { text: string; className?: string }[] = [
    { text: t('wpn.weapon') },
    { text: t('wpn.range'), className: 'w-num' },
    { text: t('wpn.attacks'), className: 'w-num' },
    { text: t('wpn.ap'), className: 'w-num' },
    { text: t('wpn.special') },
  ];
  for (const header of headerTexts) {
    const th = document.createElement('th');
    if (header.className) th.className = header.className;
    th.textContent = header.text;
    head.appendChild(th);
  }

  const body = table.createTBody();
  for (const weapon of weapons) {
    const row = body.insertRow();
    const cells: [string, string][] = [
      [weapon.count > 1 ? `${weapon.count}x ${weapon.name}` : weapon.name, 'w-name'],
      [weapon.range, 'w-num'],
      [weapon.attacks, 'w-num'],
      [weapon.ap, 'w-num'],
      [weapon.special, 'w-special'],
    ];
    for (const [text, className] of cells) {
      const td = row.insertCell();
      td.className = className;
      td.textContent = text;
    }
  }

  if (items.length > 0) {
    const itemsBody = table.createTBody();
    const itemsHeadRow = itemsBody.insertRow();
    itemsHeadRow.className = 'items-head';
    const itemNameHeader = document.createElement('th');
    itemNameHeader.textContent = t('wpn.item');
    itemsHeadRow.appendChild(itemNameHeader);
    const itemEmptyHeader = document.createElement('th');
    itemEmptyHeader.colSpan = 3;
    itemsHeadRow.appendChild(itemEmptyHeader);
    const itemSpecialHeader = document.createElement('th');
    itemSpecialHeader.textContent = t('wpn.special');
    itemsHeadRow.appendChild(itemSpecialHeader);

    for (const entry of mergeItems(items)) {
      const row = itemsBody.insertRow();
      const cells: { text: string; className?: string; colSpan?: number }[] = [
        { text: entry.count > 1 ? `${entry.count}x ${entry.name}` : entry.name, className: 'w-name' },
        { text: '', colSpan: 3 },
        { text: entry.special, className: 'w-special' },
      ];
      for (const cell of cells) {
        const td = row.insertCell();
        if (cell.colSpan) td.colSpan = cell.colSpan;
        if (cell.className) td.className = cell.className;
        td.textContent = cell.text;
      }
    }
  }

  return table;
}

function createRulesContainer(unit: Unit): HTMLDivElement {
  const container = document.createElement('div');
  container.className = 'rules-container';

  const { labels, upgradePills } = unitRuleLabels(unit);

  if (labels.length === 0 && upgradePills.length === 0) {
    container.appendChild(createTextElement('muted', t('card.noRules')));
    return container;
  }

  const addPill = (text: string): void => {
    // Skip blanks so a label-less entry never renders as an empty pill.
    const label = text?.trim() || '';
    if (!label) return;
    const pill = document.createElement('span');
    pill.className = 'rule-pill';
    pill.textContent = label;
    container.appendChild(pill);
  };

  for (const pill of labels) addPill(pill);
  for (const pill of upgradePills) addPill(pill);

  return container;
}

// Nomes das regras de uma unidade (próprias + concedidas por itens + melhorias),
// já traduzidos, deduplicados e ordenados. Usado pelas pílulas do Classic e
// pela coluna Regras do roster compacto.
function unitRuleLabels(unit: Unit): { labels: string[]; upgradePills: string[] } {
  const rules = getRules(unit);
  const upgradePills = getUpgradeRulePills(unit);

  // Regras concedidas por itens do loadout (ex.: "Camo Cloak" concedendo "Stealth").
  const itemRuleTexts: string[] = [];
  for (const item of getUpgrades(unit)) {
    for (const text of getItemRules(item)) {
      const trimmed = text?.trim();
      if (trimmed) itemRuleTexts.push(trimmed);
    }
  }

  const pillTexts = new Set<string>();
  for (const rule of rules) {
    const text = ruleText(rule);
    const trimmed = text?.trim();
    if (trimmed) pillTexts.add(trimmed);
  }
  for (const text of itemRuleTexts) pillTexts.add(text);

  return {
    labels: Array.from(pillTexts).sort((a, b) => a.localeCompare(b)),
    upgradePills,
  };
}

// --- Design Tabela: linha compacta (roster) ---------------------------------
// Uma linha curta por unidade, com um cabeçalho único acima das linhas. É a
// versão "lista de exército": nome/pontos, Qua, Def, armas e regras lado a
// lado, sem repetir títulos de seção em cada unidade.

function createRosterHeader(): HTMLDivElement {
  const header = document.createElement('div');
  header.className = 'roster-head';
  const cells: [string, string][] = [
    [t('table.unit'), 'roster-head--unit'],
    [t('table.qua'), 'roster-head--qua'],
    [t('table.def'), 'roster-head--def'],
    [t('table.tough'), 'roster-head--tough'],
    [t('table.weapons'), 'roster-head--weapons'],
    [t('table.rules'), 'roster-head--rules'],
  ];
  for (const [text, className] of cells) {
    header.appendChild(createTextElement(`roster-head-cell ${className}`, text));
  }
  return header;
}

function rosterQuantity(count: number): string {
  return `${count > 0 ? count : 1}x`;
}

function rosterWeaponLine(weapon: MergedWeapon): HTMLDivElement {
  const line = document.createElement('div');
  line.className = 'roster-weapon';

  // Tudo o que importa na mesa fica entre parênteses, como no resumo do Army
  // Forge: "3x Slings (12\", A2, Assault)".
  const details: string[] = [];
  if (weapon.range !== '-') details.push(weapon.range);
  if (weapon.attacks !== '-') details.push(weapon.attacks);
  if (weapon.ap !== '-') details.push(`AP(${weapon.ap})`);
  if (weapon.special !== '-') details.push(weapon.special);
  const name = details.length > 0 ? `${weapon.name} (${details.join(', ')})` : weapon.name;

  const qty = document.createElement('span');
  qty.className = 'roster-qty';
  qty.textContent = rosterQuantity(weapon.count);
  line.append(qty, ` ${name}`);
  return line;
}

function rosterItemLine(item: MergedItem): HTMLDivElement {
  const line = document.createElement('div');
  line.className = 'roster-weapon';
  const name = item.special !== '-' ? `${item.name} (${item.special})` : item.name;
  const qty = document.createElement('span');
  qty.className = 'roster-qty';
  qty.textContent = rosterQuantity(item.count);
  line.append(qty, ` ${name}`);
  return line;
}

function createRosterWeaponsCell(weapons: MergedWeapon[], items: Weapon[]): HTMLDivElement {
  const cell = document.createElement('div');
  cell.className = 'roster-cell roster-cell--weapons';
  cell.dataset.label = t('table.weapons');

  if (weapons.length === 0 && items.length === 0) {
    cell.appendChild(createTextElement('muted', t('card.noWeapons')));
    return cell;
  }

  for (const weapon of weapons) cell.appendChild(rosterWeaponLine(weapon));
  for (const item of mergeItems(items)) cell.appendChild(rosterItemLine(item));
  return cell;
}

function createRosterRulesCell(unit: Unit): HTMLDivElement {
  const cell = document.createElement('div');
  cell.className = 'roster-cell roster-cell--rules';
  cell.dataset.label = t('table.rules');

  // Tough tem coluna própria no roster; não repete na lista de regras.
  const toughLabels = new Set(
    getRules(unit)
      .filter((rule) => rule.name === 'Tough')
      .map((rule) => ruleText(rule).trim()),
  );
  const { labels, upgradePills } = unitRuleLabels(unit);
  const entries = [
    ...labels.filter((label) => !toughLabels.has(label.trim())),
    ...upgradePills,
  ];
  if (entries.length === 0) {
    cell.appendChild(createTextElement('muted', t('card.noRules')));
    return cell;
  }

  const container = document.createElement('div');
  container.className = 'rules-container rules-container--compact';
  for (const entry of entries) {
    const pill = document.createElement('span');
    pill.className = 'rule-pill';
    pill.textContent = entry;
    container.appendChild(pill);
  }
  cell.appendChild(container);
  return cell;
}

// Texto de uma regra da unidade para a linha de regras: nome + rating (ex.: "Tough(9)").
function ruleText(rule: UnitRule): string {
  return trRuleLabel(rule);
}


// --- Card avatar image: círculo com pan / zoom / upload ----------------------

const DEFAULT_BG_OPACITY = 1;

const MIN_BG_SCALE = 0.5;
const MAX_BG_SCALE = 8;
const DEFAULT_BG_SCALE = 1;

// Center the slider at 1x, with 0.5x to the left and 8x to the right.
// Logarithmic mapping keeps the full range practical to control.
function scaleFromZoomPosition(position: number): number {
  const normalized = Math.max(-100, Math.min(100, position)) / 100;
  return normalized < 0
    ? Math.pow(MIN_BG_SCALE, -normalized)
    : Math.pow(MAX_BG_SCALE, normalized);
}

function zoomPositionFromScale(scale: number): number {
  if (scale < DEFAULT_BG_SCALE) {
    return (-Math.log(scale) / Math.log(MIN_BG_SCALE)) * 100;
  }
  return (Math.log(scale) / Math.log(MAX_BG_SCALE)) * 100;
}

interface CardImageState {
  scale: number;
  tx: number;
  ty: number;
  zoomSlider?: HTMLInputElement;
  opacitySlider?: HTMLInputElement;
  panXSlider?: HTMLInputElement;
  panYSlider?: HTMLInputElement;
}

// The largest image we accept, to keep IndexedDB lean.
const MAX_IMAGE_MB = 2;
const MAX_IMAGE_BYTES = MAX_IMAGE_MB * 1024 * 1024;

const cardImageStates = new WeakMap<HTMLDivElement, CardImageState>();

function getCardImageState(card: HTMLDivElement): CardImageState {
  let state = cardImageStates.get(card);
  if (!state) {
    state = { scale: DEFAULT_BG_SCALE, tx: 0, ty: 0 };
    cardImageStates.set(card, state);
  }
  return state;
}

// --- Tamanho do círculo: escala de 1 a 10, vale para todas as cartas ----------

const AVATAR_SIZE_KEY = 'avatarSizeLevel';
const MIN_AVATAR_LEVEL = 1;
const MAX_AVATAR_LEVEL = 10;
const DEFAULT_AVATAR_LEVEL = 2; // 58 px

function diameterFor(level: number): number {
  return 48 + (level - 1) * 10; // nível 1 = 48px, nível 2 = 58px, nível 10 = 138px
}

function loadAvatarLevel(): number {
  try {
    const raw = localStorage.getItem(AVATAR_SIZE_KEY);
    const value = raw === null ? NaN : parseInt(raw, 10);
    if (Number.isFinite(value)) {
      return Math.max(MIN_AVATAR_LEVEL, Math.min(MAX_AVATAR_LEVEL, value));
    }
  } catch (error) {
    console.error('Failed to read avatar size:', error);
  }
  return DEFAULT_AVATAR_LEVEL;
}

let avatarLevel = loadAvatarLevel();
const avatarSizeButtons: HTMLButtonElement[] = [];

function avatarDiameter(): number {
  return diameterFor(avatarLevel);
}

function applyAvatarSize(): void {
  document.documentElement.style.setProperty('--avatar-size', `${avatarDiameter()}px`);
}
applyAvatarSize();

function syncAvatarButtons(): void {
  for (const button of avatarSizeButtons) {
    const active = Number(button.dataset.level) === avatarLevel;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  }
}

// Muda o tamanho de todos os círculos de uma vez e reenquadra as imagens,
// mantendo cada foto na mesma posição relativa.
function setAvatarLevel(level: number): void {
  const oldDiameter = avatarDiameter();
  avatarLevel = Math.max(MIN_AVATAR_LEVEL, Math.min(MAX_AVATAR_LEVEL, level));
  try {
    localStorage.setItem(AVATAR_SIZE_KEY, avatarLevel.toString());
  } catch (error) {
    console.error('Failed to save avatar size:', error);
  }
  applyAvatarSize();
  syncAvatarButtons();
  const ratio = avatarDiameter() / oldDiameter;

  for (const card of Array.from(document.querySelectorAll<HTMLDivElement>('.card--has-image'))) {
    const img = card.querySelector<HTMLImageElement>('.card-bg');
    if (!img) continue;
    const state = getCardImageState(card);
    state.tx *= ratio;
    state.ty *= ratio;
    fitBgCover(card, img);
    clampPan(card, state);
    applyBgTransform(card);
    scheduleCardImagePersist(card);
  }
}

/** Barra com os botões 1 a 10. Quem chama decide onde ela fica na página. */
export function createAvatarSizeControl(): HTMLDivElement {
  const bar = document.createElement('div');
  bar.className = 'avatar-size-bar';

  const label = document.createElement('span');
  label.className = 'avatar-size-label';
    label.dataset.i18n = 'avatar.label';
  label.textContent = t('avatar.label');

  const options = document.createElement('div');
  options.className = 'avatar-size-options';

    for (let level = MIN_AVATAR_LEVEL; level <= MAX_AVATAR_LEVEL; level++) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'avatar-size-btn';
    if (level === DEFAULT_AVATAR_LEVEL) button.classList.add('is-default');
    button.dataset.level = level.toString();
    button.textContent = level.toString();
    button.title = `${diameterFor(level)} px`;
    button.addEventListener('click', () => setAvatarLevel(level));
    avatarSizeButtons.push(button);
    options.appendChild(button);
  }

  bar.append(label, options);
  syncAvatarButtons();
  return bar;
}

// --- Tamanho das cartas do design Standard (63,5 × 88 mm por padrão) --------

const CARD_SIZE_KEY = 'tcgCardSize';
export const DEFAULT_CARD_WIDTH_MM = 63.5;
export const DEFAULT_CARD_HEIGHT_MM = 88;
const MIN_CARD_MM = 30;
const MAX_CARD_MM = 300;

interface CardSize {
  width: number;
  height: number;
}

interface CardSizePreset extends CardSize {
  id: string;
  label: string;
}

// Tamanhos de carta mais comuns em jogos de tabuleiro. O Standard é o padrão;
// os demais servem de atalho, e qualquer valor pode ser digitado à mão.
const CARD_SIZE_PRESETS: CardSizePreset[] = [
  { id: 'standard', label: 'Standard', width: 63.5, height: 88 },
  { id: 'tarot', label: 'Tarot', width: 70, height: 120 },
  { id: 'usa', label: 'USA', width: 56, height: 87 },
  { id: 'euro', label: 'Euro', width: 59, height: 92 },
  { id: 'mini-usa', label: 'Mini USA', width: 41, height: 63 },
  { id: 'mini', label: 'Mini', width: 44, height: 67 },
  { id: 'bridge', label: 'Bridge', width: 57, height: 89 },
];

const cardSizeControls: Array<{
  width: HTMLInputElement;
  height: HTMLInputElement;
  preset: HTMLSelectElement;
}> = [];

function formatCardMm(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function matchingCardPreset(size: CardSize): string {
  const match = CARD_SIZE_PRESETS.find(
    (preset) =>
      Math.abs(preset.width - size.width) < 0.05 &&
      Math.abs(preset.height - size.height) < 0.05,
  );
  return match?.id ?? 'custom';
}

function parseCardMm(value: string): number | null {
  const parsed = parseFloat(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function clampCardMm(value: number): number {
  return Math.round(Math.min(MAX_CARD_MM, Math.max(MIN_CARD_MM, value)) * 10) / 10;
}

function loadCardSize(): CardSize {
  try {
    const raw = localStorage.getItem(CARD_SIZE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { width?: unknown; height?: unknown };
      return {
        width:
          typeof parsed.width === 'number'
            ? clampCardMm(parsed.width)
            : DEFAULT_CARD_WIDTH_MM,
        height:
          typeof parsed.height === 'number'
            ? clampCardMm(parsed.height)
            : DEFAULT_CARD_HEIGHT_MM,
      };
    }
  } catch (error) {
    console.error('Failed to read card size:', error);
  }
  return { width: DEFAULT_CARD_WIDTH_MM, height: DEFAULT_CARD_HEIGHT_MM };
}

let cardSize = loadCardSize();

// O conteúdo é desenhado no tamanho base (63,5 × 88 mm) e escalado junto com a
// largura; a altura fica independente para caber no papel escolhido. Sem zoom,
// a carta manteria os tipos pequenos e sobraria (ou faltaria) espaço.
function applyCardSize(): void {
  const root = document.documentElement.style;
  const scale = cardSize.width / DEFAULT_CARD_WIDTH_MM;
  root.setProperty('--tcg-card-w', `${cardSize.width}mm`);
  root.setProperty('--tcg-card-h', `${cardSize.height}mm`);
  root.setProperty('--tcg-scale', scale.toFixed(5));
  root.setProperty('--tcg-base-h', `${(cardSize.height / scale).toFixed(4)}mm`);
  // Na impressão, cabem tantas cartas por linha quantas couberem na largura
  // útil da A4 com margem de 6 mm (198 mm). Letter é mais larga, então também
  // serve.
  const gap = 0.75;
  const columns = Math.max(1, Math.floor((198 + gap) / (cardSize.width + gap)));
  root.setProperty('--tcg-print-cols', String(columns));
}
applyCardSize();

function saveCardSize(): void {
  try {
    localStorage.setItem(CARD_SIZE_KEY, JSON.stringify(cardSize));
  } catch (error) {
    console.error('Failed to save card size:', error);
  }
}

function syncCardSizeInputs(): void {
  const presetId = matchingCardPreset(cardSize);
  for (const control of cardSizeControls) {
    control.width.value = String(cardSize.width);
    control.height.value = String(cardSize.height);
    control.preset.value = presetId;
  }
}

// Mantém o seletor coerente com os campos sem reescrever o que está sendo
// digitado (só depois que o campo perde o foco os valores são normalizados).
function syncCardSizePreset(): void {
  const presetId = matchingCardPreset(cardSize);
  for (const control of cardSizeControls) control.preset.value = presetId;
}

function setCardSize(width: number, height: number): void {
  cardSize = { width: clampCardMm(width), height: clampCardMm(height) };
  applyCardSize();
  saveCardSize();
  syncCardSizeInputs();
}

/** Campos de largura e altura (mm) da carta do design Standard. */
export function createCardSizeControl(): HTMLDivElement {
  const bar = document.createElement('div');
  bar.className = 'card-size-bar';

  const label = document.createElement('span');
  label.className = 'card-size-label';
  label.dataset.i18n = 'cardsize.label';
  label.textContent = t('cardsize.label');

  const presetField = document.createElement('label');
  presetField.className = 'card-size-preset-field';
  const presetText = document.createElement('span');
  presetText.className = 'card-size-field-label';
  presetText.dataset.i18n = 'cardsize.preset';
  presetText.textContent = t('cardsize.preset');
  const presetSelect = document.createElement('select');
  presetSelect.className = 'card-size-preset';
  presetSelect.dataset.i18nAria = 'cardsize.preset';
  presetSelect.setAttribute('aria-label', t('cardsize.preset'));
  for (const preset of CARD_SIZE_PRESETS) {
    const option = document.createElement('option');
    option.value = preset.id;
    option.textContent = `${preset.label} — ${formatCardMm(preset.width)} × ${formatCardMm(preset.height)} mm`;
    presetSelect.appendChild(option);
  }
  const customOption = document.createElement('option');
  customOption.value = 'custom';
  customOption.dataset.i18n = 'cardsize.custom';
  customOption.textContent = t('cardsize.custom');
  presetSelect.appendChild(customOption);
  presetField.append(presetText, presetSelect);

  const fields = document.createElement('div');
  fields.className = 'card-size-fields';

  const makeField = (i18n: 'cardsize.width' | 'cardsize.height'): HTMLInputElement => {
    const field = document.createElement('label');
    field.className = 'card-size-field';
    const text = document.createElement('span');
    text.className = 'card-size-field-label';
    text.dataset.i18n = i18n;
    text.textContent = t(i18n);
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'card-size-input';
    input.min = String(MIN_CARD_MM);
    input.max = String(MAX_CARD_MM);
    input.step = '0.1';
    input.inputMode = 'decimal';
    input.dataset.i18nAria = i18n;
    input.setAttribute('aria-label', t(i18n));
    field.append(text, input);
    fields.appendChild(field);
    return input;
  };

  const widthInput = makeField('cardsize.width');
  const times = document.createElement('span');
  times.className = 'card-size-times';
  times.textContent = '×';
  fields.appendChild(times);
  const heightInput = makeField('cardsize.height');

  presetSelect.addEventListener('change', () => {
    if (presetSelect.value === 'custom') {
      widthInput.focus();
      widthInput.select();
      return;
    }
    const preset = CARD_SIZE_PRESETS.find((item) => item.id === presetSelect.value);
    if (preset) setCardSize(preset.width, preset.height);
  });

  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'card-size-reset';
  reset.dataset.i18n = 'cardsize.reset';
  reset.textContent = t('cardsize.reset');
  reset.addEventListener('click', () =>
    setCardSize(DEFAULT_CARD_WIDTH_MM, DEFAULT_CARD_HEIGHT_MM),
  );
  fields.appendChild(reset);

  // Enquanto o usuário digita, aplica só valores completos e dentro da faixa;
  // ao sair do campo, completa o que faltar e normaliza os dois campos.
  const commit = (normalize: boolean): void => {
    const width = parseCardMm(widthInput.value);
    const height = parseCardMm(heightInput.value);
    if (width == null || height == null) {
      if (normalize) syncCardSizeInputs();
      return;
    }
    const outOfRange =
      width < MIN_CARD_MM ||
      width > MAX_CARD_MM ||
      height < MIN_CARD_MM ||
      height > MAX_CARD_MM;
    if (outOfRange) {
      if (normalize) setCardSize(width, height);
      return;
    }
    cardSize = { width, height };
    applyCardSize();
    saveCardSize();
    if (normalize) syncCardSizeInputs();
    else syncCardSizePreset();
  };
  for (const input of [widthInput, heightInput]) {
    input.addEventListener('input', () => commit(false));
    input.addEventListener('change', () => commit(true));
  }

  cardSizeControls.push({ width: widthInput, height: heightInput, preset: presetSelect });
  syncCardSizeInputs();

  bar.append(label, presetField, fields);
  return bar;
}


// O círculo onde a imagem aparece.
function getAvatar(card: HTMLDivElement): HTMLDivElement | null {
  return card.querySelector<HTMLDivElement>('.card-image-area');
}

function fitBgCover(card: HTMLDivElement, img: HTMLImageElement): void {
  const avatar = getAvatar(card);
  if (!avatar) return;
  const boxW = avatar.clientWidth;
  const boxH = avatar.clientHeight;
  const natW = img.naturalWidth;
  const natH = img.naturalHeight;
  if (!boxW || !boxH || !natW || !natH) return;

  const coverScale = Math.max(boxW / natW, boxH / natH);
  img.style.width = `${natW * coverScale}px`;
  img.style.height = `${natH * coverScale}px`;
}

// Quanto a imagem pode se mover: só o que sobra além do círculo, para nunca
// aparecerem espaços vazios.
function getPanBounds(card: HTMLDivElement): { maxX: number; maxY: number } {
  const img = card.querySelector<HTMLImageElement>('.card-bg');
  const avatar = getAvatar(card);
  if (!img || !avatar) return { maxX: 0, maxY: 0 };
  const state = getCardImageState(card);
  const overflowX = (img.offsetWidth * state.scale - avatar.clientWidth) / 2;
  const overflowY = (img.offsetHeight * state.scale - avatar.clientHeight) / 2;
  return {
    maxX: Math.max(0, overflowX),
    maxY: Math.max(0, overflowY),
  };
}

function clampPan(card: HTMLDivElement, state: CardImageState): void {
  const { maxX, maxY } = getPanBounds(card);
  state.tx = Math.max(-maxX, Math.min(maxX, state.tx));
  state.ty = Math.max(-maxY, Math.min(maxY, state.ty));
}

function applyBgTransform(card: HTMLDivElement): void {
  const state = getCardImageState(card);
  card.style.setProperty('--card-bg-scale', state.scale.toString());
  card.style.setProperty('--card-bg-tx', `${state.tx}px`);
  card.style.setProperty('--card-bg-ty', `${state.ty}px`);
  const { maxX, maxY } = getPanBounds(card);
  card.classList.toggle('card--pannable', maxX > 0 || maxY > 0);
  syncPanSliders(card, maxX, maxY);
}

// Os sliders de posição mostram a posição como porcentagem do deslocamento
// possível; o valor em px continua sendo a fonte da verdade.
function syncPanSliders(card: HTMLDivElement, maxX: number, maxY: number): void {
  const state = getCardImageState(card);
  if (state.panXSlider) {
    state.panXSlider.value = maxX > 0 ? ((state.tx / maxX) * 100).toString() : '0';
  }
  if (state.panYSlider) {
    state.panYSlider.value = maxY > 0 ? ((state.ty / maxY) * 100).toString() : '0';
  }
}

function setCardPan(card: HTMLDivElement, axis: 'x' | 'y', percent: number): void {
  const state = getCardImageState(card);
  const { maxX, maxY } = getPanBounds(card);
  const fraction = percent / 100;
  if (axis === 'x') {
    state.tx = fraction * maxX;
  } else {
    state.ty = fraction * maxY;
  }
  clampPan(card, state);
  applyBgTransform(card);
  scheduleCardImagePersist(card);
}

function setCardScale(card: HTMLDivElement, scale: number): void {
  const state = getCardImageState(card);
  state.scale = Math.max(MIN_BG_SCALE, Math.min(MAX_BG_SCALE, scale));
  clampPan(card, state);
  applyBgTransform(card);
  if (state.zoomSlider) state.zoomSlider.value = zoomPositionFromScale(state.scale).toString();
  scheduleCardImagePersist(card);
}

function resetCardFraming(card: HTMLDivElement): void {
  const state = getCardImageState(card);
  state.scale = DEFAULT_BG_SCALE;
  state.tx = 0;
  state.ty = 0;
  applyBgTransform(card);
  if (state.zoomSlider) state.zoomSlider.value = zoomPositionFromScale(state.scale).toString();
}

// `resetFraming` é true para um upload novo (começa centralizado em 1x) e false
// ao restaurar uma imagem salva, quando o enquadramento já foi aplicado.
function setCardImage(card: HTMLDivElement, src: string | null, resetFraming = true): void {
  const avatar = getAvatar(card);
  if (!avatar) return;
  let img = avatar.querySelector<HTMLImageElement>('.card-bg');

  if (!src) {
    img?.remove();
    card.classList.remove('card--has-image');
    avatar.title = t('img.add');
    return;
  }

  if (!img) {
    img = document.createElement('img');
    img.className = 'card-bg';
    img.alt = '';
    avatar.appendChild(img);
  }

  const imageEl = img;
  imageEl.addEventListener(
    'load',
    () => {
      fitBgCover(card, imageEl);
      clampPan(card, getCardImageState(card));
      applyBgTransform(card);
    },
    { once: true },
  );

  img.src = src;
  card.classList.add('card--has-image');
  avatar.title = t('img.drag');
  if (resetFraming) resetCardFraming(card);
}

// --- Card image persistence (Localbase) --------------------------------------



// Grava a imagem e o enquadramento atuais, ou apaga o registro se a carta
// não tiver mais imagem.
function persistCardImage(card: HTMLDivElement): void {
  const { armyId, unitId } = card.dataset;
  if (!armyId || !unitId) return;

  const img = card.querySelector<HTMLImageElement>('.card-bg');
  if (!img || !card.classList.contains('card--has-image')) {
    void deleteCardImage(armyId, unitId).catch((error) => console.error(error));
    return;
  }

  const state = getCardImageState(card);
  void saveCardImage({
    armyId,
    unitId,
    src: img.src,
    scale: state.scale,
       // A posição é guardada em proporção do círculo, para valer em qualquer tamanho.
    tx: state.tx / avatarDiameter(),
    ty: state.ty / avatarDiameter(),
    opacity: DEFAULT_BG_OPACITY,
  }).catch((error) => console.error(error));
}

// Junta as mudanças rápidas (arrastar, sliders) em uma gravação só.
const persistTimers = new WeakMap<HTMLDivElement, number>();
function scheduleCardImagePersist(card: HTMLDivElement): void {
  const pending = persistTimers.get(card);
  if (pending) window.clearTimeout(pending);
  persistTimers.set(card, window.setTimeout(() => persistCardImage(card), 300));
}

function removeCardImage(card: HTMLDivElement): void {
  setCardImage(card, null);
  resetCardFraming(card);
  const { armyId, unitId } = card.dataset;
  if (armyId && unitId) void deleteCardImage(armyId, unitId).catch((error) => console.error(error));
}

// Carrega a imagem salva da unidade (se houver) e aplica o enquadramento.
async function restoreCardImage(card: HTMLDivElement, armyId: string, unitId: string): Promise<void> {
  let record;
  try {
    record = await getCardImage(armyId, unitId);
  } catch (error) {
    console.error('Failed to load card image:', error);
    return;
  }
  if (!record) return;

  const state = getCardImageState(card);
  state.scale = Math.max(MIN_BG_SCALE, Math.min(MAX_BG_SCALE, record.scale));
   state.tx = record.tx * avatarDiameter();
  state.ty = record.ty * avatarDiameter();

  if (state.zoomSlider) state.zoomSlider.value = zoomPositionFromScale(state.scale).toString();

  setCardImage(card, record.src, false);
}

function enableCardImagePanZoom(card: HTMLDivElement, avatar: HTMLDivElement): void {
  let active = false;
  let startX = 0;
  let startY = 0;
  let baseTx = 0;
  let baseTy = 0;

  avatar.addEventListener('pointerdown', (event) => {
    if (!card.classList.contains('card--has-image')) return;

    const state = getCardImageState(card);
    active = true;
    startX = event.clientX;
    startY = event.clientY;
    baseTx = state.tx;
    baseTy = state.ty;
    avatar.setPointerCapture(event.pointerId);
    card.classList.add('card--panning');
  });

  avatar.addEventListener('pointermove', (event) => {
    if (!active) return;
    const state = getCardImageState(card);
    state.tx = baseTx + (event.clientX - startX);
    state.ty = baseTy + (event.clientY - startY);
    clampPan(card, state);
    applyBgTransform(card);
  });

  const endDrag = (event: PointerEvent): void => {
    if (!active) return;
    active = false;
    card.classList.remove('card--panning');
    if (avatar.hasPointerCapture(event.pointerId)) {
      avatar.releasePointerCapture(event.pointerId);
    }
    scheduleCardImagePersist(card);
  };
  avatar.addEventListener('pointerup', endDrag);
  avatar.addEventListener('pointercancel', endDrag);

  avatar.addEventListener(
    'wheel',
    (event) => {
      if (!card.classList.contains('card--has-image')) return;
      event.preventDefault();
      const state = getCardImageState(card);
      const step = event.deltaY < 0 ? 0.1 : -0.1;
      setCardScale(card, state.scale + step);
    },
    { passive: false },
  );
}

// Cria o círculo no cabeçalho da carta; clicar nele (sem imagem) abre a janela
// de escolher arquivo.
function enableCardImageUpload(card: HTMLDivElement, design: CardDesign): void {
  const avatar = document.createElement('div');
  avatar.className = design === 'tcg' ? 'card-avatar card-image-area card-art' : 'card-avatar card-image-area';
  avatar.title = t('img.add');
  if (design === 'tcg') {
    const placeholder = document.createElement('span');
    placeholder.className = 'card-art-placeholder';
    placeholder.textContent = t('card.addArtwork');
    avatar.appendChild(placeholder);
    const header = card.querySelector('.card-header');
    if (header?.parentElement === card) header.after(avatar);
  } else {
    card.querySelector('.card-header')?.prepend(avatar);
  }

  enableCardImagePanZoom(card, avatar);

  avatar.addEventListener('click', () => {
    if (card.classList.contains('card--has-image')) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return;

      if (file.size > MAX_IMAGE_BYTES) {
        window.alert(t('img.tooLarge', { mb: MAX_IMAGE_MB }));
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        setCardImage(card, reader.result as string);
        persistCardImage(card);
      };
      reader.readAsDataURL(file);
    });
    input.click();
  });
}

function createSliderRow(
  label: string,
  options: { min: string; max: string; step: string; value: string },
  onInput: (value: string) => void,
): { row: HTMLLabelElement; slider: HTMLInputElement } {
  const row = document.createElement('label');
  row.className = 'toolbar-row';

  const text = document.createElement('span');
  text.className = 'toolbar-label';
  text.textContent = label;

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'toolbar-slider';
  slider.min = options.min;
  slider.max = options.max;
  slider.step = options.step;
  slider.value = options.value;
  slider.setAttribute('aria-label', label);
  slider.addEventListener('input', () => onInput(slider.value));

  row.append(text, slider);
  return { row, slider };
}

// --- PNG export --------------------------------------------------------------

function sanitizeFilename(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[^a-z0-9_-]+/gi, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || 'card';
}

async function renderCardToBlob(card: HTMLDivElement): Promise<Blob | null> {
  const canvas = await html2canvas(card, {
    scale: 3,
    useCORS: true,
    backgroundColor: '#ffffff',
    ignoreElements: (element) => element.classList.contains('card-bg-remove'),
  });
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function downloadCardPng(card: HTMLDivElement, filename: string): Promise<void> {
  const blob = await renderCardToBlob(card);
  if (blob) triggerBlobDownload(blob, filename);
}

function createDownloadButton(card: HTMLDivElement): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'toolbar-download';
  button.title = 'Download card as PNG';
  button.setAttribute('aria-label', 'Download card as PNG');
  button.innerHTML =
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>' +
    '<span>PNG</span>';
  button.addEventListener('click', () => {
    const name = sanitizeFilename(card.dataset.unitName ?? 'card');
    button.disabled = true;
    void downloadCardPng(card, `OPR Card Generator - Redesign - ${name}.png`).finally(() => {
      button.disabled = false;
    });
  });
  return button;
}

function wrapCardWithToolbar(card: HTMLDivElement): HTMLDivElement {
  card.style.setProperty('--card-bg-opacity', DEFAULT_BG_OPACITY.toString());
  applyBgTransform(card);

  const wrapper = document.createElement('div');
  wrapper.className = 'card-wrapper';

  const toolbar = document.createElement('div');
  toolbar.className = 'card-toolbar';



  const zoom = createSliderRow(
    t('img.zoom'),
    {
      min: '-100',
      max: '100',
      step: '1',
      value: '0',
    },
    (value) => setCardScale(card, scaleFromZoomPosition(parseFloat(value))),
  );
  getCardImageState(card).zoomSlider = zoom.slider;
  const zoomRangeLabels = document.createElement('div');
  zoomRangeLabels.className = 'zoom-range-labels';
  for (const label of ['0.5×', '1×', '8×']) {
    const stop = document.createElement('span');
    stop.textContent = label;
    zoomRangeLabels.appendChild(stop);
  }
  zoomRangeLabels.setAttribute('aria-hidden', 'true');

  // Horizontal / vertical position sliders — an alternative to dragging the
  // image, which is awkward on touch screens.
  const panX = createSliderRow(
    t('img.horizontal'),
    { min: '-100', max: '100', step: '1', value: '0' },
    (value) => setCardPan(card, 'x', parseFloat(value)),
  );
  getCardImageState(card).panXSlider = panX.slider;

  const panY = createSliderRow(
    t('img.vertical'),
    { min: '-100', max: '100', step: '1', value: '0' },
    (value) => setCardPan(card, 'y', parseFloat(value)),
  );
  getCardImageState(card).panYSlider = panY.slider;

  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'toolbar-reset';
  reset.textContent = t('img.recenter');
  reset.title = t('img.recenterTitle');
  reset.addEventListener('click', () => {
    resetCardFraming(card);
    scheduleCardImagePersist(card);
  });

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'toolbar-reset';
  remove.textContent = t('img.remove');
  remove.addEventListener('click', () => removeCardImage(card));

  const imageControls = document.createElement('div');
  imageControls.className = 'card-toolbar-image-controls';
  imageControls.append(zoom.row, zoomRangeLabels, panX.row, panY.row, reset, remove);

    toolbar.append(imageControls);
  wrapper.append(card, toolbar);
  return wrapper;
}

// --- Cards & tables ----------------------------------------------------------

// Signature of everything a card shows, so two selections that look identical
// (same profile, rules and loadout) collapse into one "Combine Similar Units"
// group. Deliberately excludes per-selection identifiers (selectionId, xp,
// notes) so genuine duplicates match while a customised copy stays separate.
// The custom name only joins the signature when it's actually shown, so that
// renamed units stay on their own card then but merge with their twins when
// custom names are hidden.
function unitSignature(unit: Unit, useCustomNames: boolean): string {
  const rules = getRules(unit)
    .map((rule) => `${rule.name}:${rule.rating ?? ''}`)
    .sort();
  const loadout = (Array.isArray(unit.loadout) ? unit.loadout : [])
    .map((item) => `${item.label ?? item.name ?? ''}:${item.count ?? ''}`)
    .sort();

  return JSON.stringify({
    name: unit.name,
    custom: useCustomNames ? unit.customName ?? '' : '',
    generic: unit.genericName,
    // Keep heroes joined to different units on separate cards — otherwise two
    // identical heroes would collapse into one and lose their distinct marker.
    joinToUnit: unit.joinToUnit ?? '',
    cost: unit.cost,
    size: unit.size,
    quality: unit.quality,
    defense: unit.defense,
    rules,
    loadout,
  });
}

// The title Army Forge shows for a unit: its custom name when renamed and custom
// names are on, otherwise the book name. Shared by the card title and the
// "Joined to ..." marker, so both name the same unit the same way.
function unitDisplayName(unit: Unit, useCustomNames: boolean): string {
  const customName = useCustomNames ? unit.customName?.trim() : '';
  return customName || unit.name || t('card.unnamed');
}

interface UnitGroup {
  unit: Unit;
  count: number;
}

// OPR's "Combine Units" special rule fuses two same-type units into one larger
// unit on the table. Army Forge marks both halves `combined: true` and points the
// second half's `joinToUnit` at the first's `selectionId`. The /tts feed still
// lists them as two units, each holding its own half of the models and loadout —
// which can differ (e.g. one half carries a Missile Launcher, the other a Gravity
// Rifle). We fold each joined half back into its host so the pair renders as a
// single card for the real, larger unit: models, points and loadout are summed,
// and rules from both halves are unioned. This is a genuine in-game merge, so it
// always applies — unlike the cosmetic "combine similar units" option below.
// (Heroes that merely join a unit have `combined: false`, so they stay separate.)
function mergeUnitHalves(host: Unit, joined: Unit[]): Unit {
  const all = [host, ...joined];

  const rules: UnitRule[] = [];
  const seenRules = new Set<string>();
  for (const unit of all) {
    for (const rule of getRules(unit)) {
      const key = `${rule.name}:${rule.rating ?? ''}`;
      if (seenRules.has(key)) continue;
      seenRules.add(key);
      rules.push(rule);
    }
  }

  return {
    ...host,
    size: all.reduce((sum, unit) => sum + (unit.size ?? 0), 0),
    cost: all.reduce((sum, unit) => sum + (unit.cost ?? 0), 0),
    // Sum each half's true total here — createCard reads `totalCost` directly for
    // merged units, since the joined half's upgrades are priced against its own id.
    totalCost: all.reduce((sum, unit) => sum + getUnitTotalCost(unit), 0),
    loadout: all.flatMap((unit) => (Array.isArray(unit.loadout) ? unit.loadout : [])),
    rules,
    selectedUpgrades: all.flatMap((unit) =>
      Array.isArray(unit.selectedUpgrades) ? unit.selectedUpgrades : [],
    ),
    combinedFromHalves: true,
  };
}

function mergeJoinedUnits(units: Unit[]): Unit[] {
  const bySelectionId = new Map<string, Unit>();
  for (const unit of units) {
    if (unit.selectionId) bySelectionId.set(unit.selectionId, unit);
  }

  // A joined half is one that's combined and points at an existing host.
  const joinsHost = (unit: Unit): boolean =>
    unit.combined === true && !!unit.joinToUnit && bySelectionId.has(unit.joinToUnit);

  // Gather each host's joined halves, preserving their first-seen order.
  const halvesByHost = new Map<string, Unit[]>();
  for (const unit of units) {
    if (!joinsHost(unit)) continue;
    const hostId = unit.joinToUnit as string;
    const halves = halvesByHost.get(hostId) ?? [];
    halves.push(unit);
    halvesByHost.set(hostId, halves);
  }

  const result: Unit[] = [];
  for (const unit of units) {
    if (joinsHost(unit)) continue; // folded into its host below
    const halves = halvesByHost.get(unit.selectionId);
    result.push(halves && halves.length > 0 ? mergeUnitHalves(unit, halves) : unit);
  }
  return result;
}

// The most identical units that may share a single combined card. Combining is
// purely cosmetic (to save paper), so three is plenty to keep a card readable.
const MAX_COMBINE = 3;

// Group identical units, preserving first-seen order (like Army Forge's
// "Combine Similar Units"): three separate Spider Rigs become one group of 3.
// Units combine regardless of how many models they have — the card just stands
// in for several identical units to save paper — but at most MAX_COMBINE share a
// card, so a fourth identical unit starts a fresh group.
function combineUnits(units: Unit[], useCustomNames: boolean): UnitGroup[] {
  const result: UnitGroup[] = [];
  // The current not-yet-full group for each signature, so a fourth duplicate
  // opens a new card instead of overflowing the third.
  const openGroup = new Map<string, UnitGroup>();

  for (const unit of units) {
    const signature = unitSignature(unit, useCustomNames);
    const existing = openGroup.get(signature);
    if (existing && existing.count < MAX_COMBINE) {
      existing.count += 1;
      continue;
    }
    const group: UnitGroup = { unit, count: 1 };
    openGroup.set(signature, group);
    result.push(group);
  }

  return result;
}

// Order the cards for the sheet: heroes first, then other units, each block by
// displayed points (descending). Every card is anchored to a host: a joined
// hero borrows its host's name and id so the two cluster together (and the
// hero sits just after its unit); everything else anchors to itself. Sorting
// by (hero block, host name, host id, host-before-hero, points) keeps each
// unit/hero pair side by side while equal-points ties stay A→Z.
function orderGroups(
  groups: UnitGroup[],
  nameBySelectionId: Map<string, string>,
  useCustomNames: boolean,
): UnitGroup[] {
  const anchorOf = (unit: Unit) => {
    const host = unit.joinToUnit;
    const isJoinedHero = !!host && nameBySelectionId.has(host);
    return {
      name: isJoinedHero
        ? nameBySelectionId.get(host as string) ?? ''
        : unitDisplayName(unit, useCustomNames),
      id: isJoinedHero ? (host as string) : unit.selectionId || '',
      role: isJoinedHero ? 1 : 0, // host unit first, joined hero right after it
    };
  };

  return [...groups].sort((a, b) => {
    const ka = anchorOf(a.unit);
    const kb = anchorOf(b.unit);
    const aIsHero = getRules(a.unit).some((rule) => rule.name === 'Hero');
    const bIsHero = getRules(b.unit).some((rule) => rule.name === 'Hero');
    if (aIsHero !== bIsHero) return aIsHero ? -1 : 1;

    const costDifference = getUnitTotalCost(b.unit) - getUnitTotalCost(a.unit);
    if (costDifference !== 0) return costDifference;

    return (
      ka.name.localeCompare(kb.name, undefined, { sensitivity: 'base' }) ||
      ka.id.localeCompare(kb.id) ||
      ka.role - kb.role
    );
  });
}

// Army Forge sometimes ships variant names joined by "||" (ex.: "Veteran Havoc
// Brother Leader||"). The card shows the second part of the variant when present;
// when it is empty, falls back to the first part (the unit's descriptive name,
// e.g. "Veteran Havoc Brother Leader") — the raw "||" never reaches the screen.
function subtitleFromGenericName(genericName: string): string {
  const parts = (genericName ?? '').split('||');
  const second = (parts[1] ?? '').trim();
  if (second) return second;
  const first = (parts[0] ?? '').trim();
  return first;
}

// Keep Standard card titles inside their fixed two-line area. Longer names get
// a slightly smaller font instead of increasing the title bar or being clipped.
function fitStandardCardTitle(card: HTMLElement): void {
  const title = card.querySelector<HTMLElement>('.card-name');
  if (!title) return;

  const computed = getComputedStyle(title);
  const measure = title.cloneNode(true) as HTMLElement;
  Object.assign(measure.style, {
    position: 'fixed',
    left: '-10000px',
    top: '0',
    visibility: 'hidden',
    display: 'block',
    width: `${title.clientWidth}px`,
    height: 'auto',
    maxHeight: 'none',
    overflow: 'visible',
    fontFamily: computed.fontFamily,
    fontWeight: computed.fontWeight,
    fontStyle: computed.fontStyle,
    letterSpacing: computed.letterSpacing,
    lineHeight: '1',
    whiteSpace: 'normal',
    overflowWrap: 'anywhere',
    webkitLineClamp: 'unset',
    webkitBoxOrient: 'initial',
  });
  document.body.appendChild(measure);

  const range = document.createRange();
  range.selectNodeContents(measure);
  let fittedSize = 5.5;
  for (let size = 7.5; size >= 5.5; size -= 0.25) {
    measure.style.fontSize = `${size}pt`;
    fittedSize = size;
    if (range.getClientRects().length <= 2) {
      break;
    }
  }
  title.style.fontSize = `${fittedSize}pt`;
  measure.remove();
}

function createCard(
  unit: Unit,
  count = 1,
  armyId = '',
  useCustomNames = false,
  joinedToName = '',
  armyName = '',
  gameSystem = '',
  design: CardDesign = 'classic',
): HTMLDivElement {
  const card = document.createElement('div');
  card.className = 'card';
  if (design === 'tcg') card.classList.add('card--tcg');
  if (design === 'table') card.classList.add('card--table', 'card--roster');
  const isHero = getRules(unit).some((rule) => rule.name === 'Hero');
  if (isHero) card.classList.add('card--hero');
  const isRoster = design === 'table';

  // Identify the card for image persistence. A combined card uses its first
  // unit's id, so its image is the one shown; the other units keep their own
  // stored images for when the user un-combines them.
  card.dataset.armyId = armyId;
  card.dataset.unitId = unitImageId(unit);

  // Army Forge keeps a renamed unit's edited title in `customName`, leaving the
  // book name in `name`. When custom names are enabled, show the custom title
  // and drop `name` to the subtitle (as Army Forge does); otherwise show the
  // book name over the generic name.
  const customName = useCustomNames ? unit.customName?.trim() : '';
  const baseName = unitDisplayName(unit, useCustomNames);
  const subtitle = customName ? unit.name : subtitleFromGenericName(unit.genericName);
  // A combined card stands in for `count` identical units but keeps the original
  // card's profile, points and loadout — combining is purely cosmetic (to save
  // paper), nothing is multiplied. The model count moves from the points line to
  // a `[size]` suffix on the name, e.g. "3x Battle Brothers [5]".
  const prefix = count > 1 ? `${count}x ` : '';
  const displayName = `${prefix}${baseName} [${unit.size}]`;
  card.dataset.unitName = displayName;

  const costParts = [`${getUnitTotalCost(unit)} pts`];
  if (unit.xp > 0) costParts.push(`XP ${unit.xp}`);

  const costElement = createTextElement('card-cost', costParts.join(' · '));
  // Flag units fused by the "Combine Units" rule so an accidental combine in Army
  // Forge is easy to spot — the card stands in for two units merged into one.
  if (unit.combinedFromHalves) {
    const badge = document.createElement('span');
    badge.className = 'combined-badge';
    badge.textContent = t('card.combined');
    costElement.append(' ', badge);
  }
  if (isHero) {
    const badge = document.createElement('span');
    badge.className = 'hero-badge';
    badge.textContent = t('card.heroBadge');
    costElement.append(' ', badge);
  }

  const header = document.createElement('div');
  header.className = 'card-header';
  header.append(createTextElement('card-name', displayName));
  if (subtitle) header.append(createTextElement('card-subtitle', subtitle));
  header.append(costElement);

  // A hero that joins a unit (Army Forge's `joinToUnit`, kept as its own card)
  // gets a "Joined to <unit>" marker, matching Army Forge so it's clear the two
  // activate together.
  if (joinedToName) {
    header.append(createTextElement('card-joined', t('card.joinedTo', { name: joinedToName })));
  }

  const stats = document.createElement('div');
  stats.className = 'stats';
  stats.append(
    createStat(t('card.quality'), `${unit.quality}+`),
    createStat(t('card.defense'), `${unit.defense}+`),
    createStat(t('card.tough'), getTough(unit)),
  );

  const weaponsContainer = document.createElement('div');
  weaponsContainer.className = 'weapons-container';

  const weapons = mergeWeapons(getWeapons(unit));
  const items = getUpgrades(unit);
  if (isRoster) {
    card.append(header);
    // Qua/Def/Tough viram colunas próprias.
    const quality = createStat(t('table.qua'), `${unit.quality}+`);
    quality.classList.add('roster-stat', 'roster-stat--qua');
    quality.title = t('card.quality');
    const defense = createStat(t('table.def'), `${unit.defense}+`);
    defense.classList.add('roster-stat', 'roster-stat--def');
    defense.title = t('card.defense');
    const tough = createStat(t('table.tough'), getTough(unit));
    tough.classList.add('roster-stat', 'roster-stat--tough');
    tough.title = t('card.tough');

    card.append(
      quality,
      defense,
      tough,
      createRosterWeaponsCell(weapons, items),
      createRosterRulesCell(unit),
    );
  } else {
    if (weapons.length === 0 && items.length === 0) {
      weaponsContainer.appendChild(createTextElement('muted', t('card.noWeapons')));
    } else {
      weaponsContainer.appendChild(createWeaponsTable(weapons, items));
    }

    if (design !== 'tcg') header.append(stats);
    card.append(header);
    if (design === 'tcg') card.append(stats);

    card.append(
      createTextElement('base-info', getBaseLabel(unit, armyName, gameSystem)),
      createTextElement('section-title section-title--rules', t('card.specialRules')),
      createRulesContainer(unit),
      createTextElement('section-title section-title--weapons', t('card.weapons')),
      weaponsContainer,
    );
  }

  if (unit.notes) {
    card.appendChild(createTextElement('card-notes', unit.notes));
  }

  enableCardImageUpload(card, design);

  return card;
}

// --- Fleet (Warfleets) ships --------------------------------------------------
// Listas "ftl" trocam `units` por `ships` (naves com estatísticas próprias).
// O salário é um card no mesmo molde: nome + classe/espaços, custo, pílulas de
// movimento/cruzeiro/esquiva/resistência e as regras da nave em texto corrido.

function getShips(army: ArmyList): Ship[] {
  return Array.isArray(army.ships) ? army.ships : [];
}

function shipNameOf(ship: Ship, nameOverride?: string): string {
  const name = (nameOverride ?? ship.name ?? '').trim() || 'Ship';
  const cls = typeof ship.class === 'string' ? ship.class.trim() : '';
  const slots = typeof ship.slots === 'number' ? ship.slots : undefined;
  let suffix = '';
  if (cls && slots != null) suffix = ` [${cls} ${slots}]`;
  else if (cls) suffix = ` [${cls}]`;
  return suffix ? `${name}${suffix}` : name;
}

function shipSpecialNames(ship: Ship): string[] {
  return (Array.isArray(ship.special) ? ship.special : [])
    .map((s) => (typeof s === 'string' ? s.trim() : ''))
    .filter(Boolean);
}

// Nome/ID/texto/custo crus de uma entrada opcional da nave (herói, título,
// sistema ou trait). O nome em inglês é o que o Army Forge usa nas comparações
// com `army.specialRules`; a tradução acontece só na hora de desenhar.
function shipEntryName(entry: unknown): string {
  if (typeof entry === 'string') return entry.trim();
  if (entry && typeof entry === 'object') {
    const name = (entry as { name?: unknown }).name;
    return typeof name === 'string' ? name.trim() : '';
  }
  return '';
}

function shipEntryId(entry: unknown): string | undefined {
  if (entry && typeof entry === 'object') {
    const id = (entry as { id?: unknown }).id;
    return typeof id === 'string' ? id : undefined;
  }
  return undefined;
}

function shipEntryRule(entry: unknown): string {
  if (entry && typeof entry === 'object') {
    const rule = (entry as { rule?: unknown }).rule;
    return typeof rule === 'string' ? rule.trim() : '';
  }
  return '';
}

function shipEntryCost(entry: unknown): number | undefined {
  if (entry && typeof entry === 'object') {
    const cost = (entry as { cost?: unknown }).cost;
    return typeof cost === 'number' ? cost : undefined;
  }
  return undefined;
}

function getShipSystems(ship: Ship): ShipSystem[] {
  return Array.isArray(ship.systems) ? ship.systems : [];
}

function getShipWeapons(ship: Ship): ShipWeapon[] {
  return Array.isArray(ship.weapons) ? ship.weapons : [];
}

// Herói e título são opcionais e vêm como objetos; a ordem segue o Army Forge
// (herói antes de título). O custo deles entra no total da nave, como o Army
// Forge mostra na lista, e a linha de herói/título exibe o valor como +N pts
// para deixar claro quanto do total vem deles.
function getShipHeroTitles(ship: Ship): ShipHeroTitle[] {
  const entries: ShipHeroTitle[] = [];
  for (const entry of [ship.hero, ship.title]) {
    const name = shipEntryName(entry);
    if (!name) continue;
    entries.push({
      id: shipEntryId(entry) ?? '',
      name,
      rule: shipEntryRule(entry),
      cost: shipEntryCost(entry),
    });
  }
  return entries;
}

// Custo total da nave como o Army Forge mostra na lista: base + herói/título.
// Sistemas e armas são sempre gratuitos nas regras de Warfleets.
function getShipTotalCost(ship: Ship): number {
  const base = typeof ship.cost === 'number' ? ship.cost : 0;
  return base + getShipHeroTitles(ship).reduce((sum, entry) => sum + (entry.cost ?? 0), 0);
}

function shipTraitNames(ship: Ship): string[] {
  return (Array.isArray(ship.traits) ? ship.traits : [])
    .map((entry) => shipEntryName(entry))
    .filter(Boolean);
}

// Todos os nomes de regra que a nave referencia: sistemas, herói/título,
// especiais da nave, traits e as regras especiais das armas. É a lista usada
// para montar a tabela de Regras especiais e o verso da carta.
function shipRuleNames(ship: Ship): string[] {
  const names: string[] = [];
  for (const system of getShipSystems(ship)) names.push(system.name);
  for (const entry of getShipHeroTitles(ship)) names.push(entry.name);
  names.push(...shipSpecialNames(ship), ...shipTraitNames(ship));
  for (const weapon of getShipWeapons(ship)) {
    for (const special of Array.isArray(weapon.special) ? weapon.special : []) {
      if (typeof special === 'string') names.push(special.trim());
    }
  }
  return [...new Set(names.filter(Boolean))];
}

// Textos de regra que o próprio payload da nave traz (sistemas e heróis/títulos).
// Servem para resolver a capacidade de caixas mesmo quando a lista salva não tem
// a regra em `army.specialRules`.
function shipInlineRules(ship: Ship): Map<string, string> {
  const map = new Map<string, string>();
  for (const system of getShipSystems(ship)) {
    if (system.name && system.rule) map.set(system.name.trim(), system.rule);
  }
  for (const entry of getShipHeroTitles(ship)) {
    if (entry.name && entry.rule) map.set(entry.name, entry.rule);
  }
  return map;
}

function findArmyRule(army: ArmyList, name: string): ArmySpecialRule | undefined {
  return (Array.isArray(army.specialRules) ? army.specialRules : []).find(
    (rule) => (rule.name ?? '').trim() === name,
  );
}

function shipRuleText(army: ArmyList, ship: Ship | undefined, name: string): string {
  const inline = ship ? shipInlineRules(ship).get(name) : undefined;
  if (inline) return inline;
  const rule = findArmyRule(army, name);
  if (rule?.description && rule.description.trim() && rule.description.trim() !== rule.name) {
    return rule.description;
  }
  return findSourceRuleByName(name)?.description ?? '';
}

// Nome traduzido de uma entrada opcional do ship (herói/título/sistema).
function namedEntryText(entry: unknown): string {
  const name = shipEntryName(entry);
  return name ? trRuleName({ id: shipEntryId(entry), name }) : '';
}

// Quantas caixas de dano uma melhoria suporta. O padrão é 2; o texto da regra
// manda em casos como Armored Plating (4) ou Crumple Hulls (3). Esquadrões usam
// "Takes X damage to be destroyed" e alguns são destruídos com 1 dano.
function damageCapacityFromText(text: string, fallback = 2): number {
  const explicit = text.match(/takes?\s+(\d+)\s+damage to be (?:disabled|destroyed)/i);
  if (explicit) return Number(explicit[1]);
  if (/destroyed if it takes any damage/i.test(text)) return 1;
  return fallback;
}

// Regras como Hardened (anões) aumentam em 1 a capacidade de TODOS os sistemas.
function shipHasHardenedSystems(army: ArmyList, ship: Ship): boolean {
  for (const name of shipRuleNames(ship)) {
    if (name === 'Hardened') return true;
    if (/Systems take \+1 damage to be disabled/i.test(shipRuleText(army, ship, name))) return true;
  }
  return false;
}

function shipSystemCapacity(army: ArmyList, ship: Ship, system: ShipSystem): number {
  const text = (system.rule ?? '').trim() || shipRuleText(army, ship, system.name);
  const base = damageCapacityFromText(text);
  return shipHasHardenedSystems(army, ship) ? base + 1 : base;
}

function shipWeaponCapacity(army: ArmyList, ship: Ship, weapon: ShipWeapon): number {
  return damageCapacityFromText(shipRuleText(army, ship, weapon.name));
}

function shipSquadronCapacity(army: ArmyList, ship: Ship): number {
  // Só as regras da própria unidade falam da vida do esquadrão; um sistema ou
  // arma com "takes X damage to be disabled" não é a vida da unidade.
  const names = [
    ...shipSpecialNames(ship),
    ...shipTraitNames(ship),
    ...getShipHeroTitles(ship).map((entry) => entry.name),
  ];
  for (const name of names) {
    const text = shipRuleText(army, ship, name);
    const explicit = text.match(/takes?\s+(\d+)\s+damage to be destroyed/i);
    if (explicit) return Number(explicit[1]);
    if (/destroyed if it takes any damage/i.test(text)) return 1;
  }
  return 2;
}

// O Army Forge nem sempre manda em `army.specialRules` todas as regras que a
// frota referencia (ex.: Twin-Fire e Deadly em Warfleets). O pool completa a
// lista com o dicionário do livro e, a partir das descrições, inclui regras
// citadas por outras (Particle Cannon cita Deadly). Devolve também os nomes
// usados, já sem tradução, para a tabela e o verso das cartas filtrarem certo.
function fleetRulePool(
  army: ArmyList,
  ships: Ship[],
): { pool: ArmySpecialRule[]; names: string[] } {
  const pool = Array.isArray(army.specialRules) ? [...army.specialRules] : [];
  const ids = new Set(pool.map((rule) => rule.id).filter(Boolean));
  const names = new Set<string>();
  for (const ship of ships) {
    for (const name of shipRuleNames(ship)) names.add(name);
  }

  const addSourceRule = (name: string): void => {
    const source = findSourceRuleByName(name);
    if (!source) return;
    if (!(source.id && ids.has(source.id))) {
      pool.push({
        id: source.id,
        name: source.name,
        aliasedRuleId: null,
        description: source.description,
        hasRating: null,
        coreType: null,
        targetType: 0,
      });
      if (source.id) ids.add(source.id);
    }
    names.add(source.name);
  };

  const poolNames = new Set(
    pool.map((rule) => (rule.name ?? '').trim()).filter(Boolean),
  );
  for (const name of [...names]) {
    if (!poolNames.has(name)) addSourceRule(name);
  }

  // Expansão de regras citadas: só as descrições das regras realmente usadas
  // alimentam a busca, para não puxar regras de entradas alheias à frota.
  const byName = new Map<string, ArmySpecialRule>();
  for (const rule of pool) {
    const name = (rule.name ?? '').trim();
    if (name) byName.set(name, rule);
  }
  const candidates = listSourceRules();
  const referenced = new Set<string>();
  for (const name of [...names]) {
    const description = (byName.get(name)?.description ?? '').trim();
    if (!description || description === name) continue;
    for (const candidate of candidates) {
      if (!candidate.name || names.has(candidate.name)) continue;
      if (new RegExp(`\\b${escapeRegExp(candidate.name)}\\b`).test(description)) {
        referenced.add(candidate.name);
      }
    }
  }
  for (const name of referenced) addSourceRule(name);

  return { pool, names: [...names] };
}

// Caixas de dano impressas na carta. Cada melhoria (sistema ou arma) suporta 2
// por padrão; o texto da regra manda em exceções (Armored Plating = 4) e
// esquadrões usam a capacidade de "Takes X damage to be destroyed".
function createDamageBoxes(capacity: number): HTMLSpanElement {
  const boxes = document.createElement('span');
  boxes.className = 'dmg-boxes';
  for (let index = 0; index < Math.max(0, capacity); index += 1) {
    const box = document.createElement('span');
    box.className = 'dmg-box';
    boxes.appendChild(box);
  }
  return boxes;
}

// O Army Forge marca o arco de tiro antes do nome de cada arma com um ícone:
// seta para cima = frente, setas para os lados = lateral, seta para baixo =
// traseira e quadrado = torreta (atira em todas as direções). `facing` segue o
// mesmo código do Army Forge (0 = frente, 1 = lateral, 2 = traseira).
type ShipFacingKind = 'front' | 'side' | 'rear' | 'turret';

function shipFacingKind(facing: number | undefined): ShipFacingKind {
  if (facing === 0) return 'front';
  if (facing === 1) return 'side';
  if (facing === 2) return 'rear';
  return 'turret';
}

function shipFacingLabel(kind: ShipFacingKind): string {
  if (kind === 'front') return t('wpn.facing.front');
  if (kind === 'side') return t('wpn.facing.side');
  if (kind === 'rear') return t('wpn.facing.rear');
  return t('wpn.turret');
}

function createShipFacingIcon(facing: number | undefined): HTMLSpanElement {
  const kind = shipFacingKind(facing);
  const label = shipFacingLabel(kind);
  const shapes: Record<ShipFacingKind, string> = {
    front: '<path d="M7 2.9 10.2 6.3H8.2v5H5.8v-5H3.8Z"/>',
    side:
      '<path d="M1.6 7 4.4 4.3v2.1h2.2v1.2H4.4v2.1Z"/>' +
      '<path d="M12.4 7 9.6 4.3v2.1H7.4v1.2h2.2v2.1Z"/>',
    rear: '<path d="M7 11.1 3.8 7.7h2v-5h2.4v5h2Z"/>',
    turret: '<rect x="3.7" y="3.7" width="6.6" height="6.6" rx="1.1"/>',
  };
  const icon = document.createElement('span');
  icon.className = `w-facing w-facing--${kind}`;
  icon.title = label;
  icon.setAttribute('role', 'img');
  icon.setAttribute('aria-label', label);
  icon.innerHTML =
    '<svg viewBox="0 0 14 14" aria-hidden="true" focusable="false">' +
    '<circle cx="7" cy="7" r="6.1" fill="none" stroke="currentColor" stroke-width="1.1"/>' +
    `<g fill="currentColor">${shapes[kind]}</g></svg>`;
  return icon;
}

function createShipUpgradeRow(
  name: string,
  options: { capacity?: number; cost?: number } = {},
): HTMLDivElement {  const row = document.createElement('div');
  row.className = 'ship-upgrade';
  row.appendChild(createTextElement('ship-upgrade-name', name));
  if (options.capacity != null) row.appendChild(createDamageBoxes(options.capacity));
  if (options.cost != null && options.cost > 0) {
    row.appendChild(createTextElement('ship-upgrade-cost', t('card.upgradePoints', { n: options.cost })));
  }
  return row;
}

function createShipCard(
  ship: Ship,
  army: ArmyList,
  armyId = '',
  design: CardDesign = 'classic',
  useCustomNames = false,
): HTMLDivElement {
  const card = document.createElement('div');
  card.className = 'card card--ship';
  if (design === 'tcg') card.classList.add('card--tcg');
  if (design === 'table') card.classList.add('card--table');
  if (ship.squadron) card.classList.add('card--squadron');

  card.dataset.armyId = armyId;
  card.dataset.unitId = ship.selectionId || ship.id || '';

  const count = typeof ship.count === 'number' && ship.count > 1 ? ship.count : 1;
  const prefix = count > 1 ? `${count}x ` : '';
  const customName = (ship.customName ?? '').trim();
  const nameOverride = useCustomNames && customName ? customName : undefined;
  const displayName = `${prefix}${shipNameOf(ship, nameOverride)}`;
  card.dataset.unitName = displayName;

  const heroTitles = getShipHeroTitles(ship);
  const systems = getShipSystems(ship);
  const specialNames = [...shipSpecialNames(ship), ...shipTraitNames(ship)];
  const weaponEntries = getShipWeapons(ship);

  const costParts = [`${getShipTotalCost(ship)} pts`];
  if (typeof ship.xp === 'number' && ship.xp > 0) costParts.push(`XP ${ship.xp}`);
  const costElement = createTextElement('card-cost', costParts.join(' · '));

  const header = document.createElement('div');
  header.className = 'card-header';
  header.append(createTextElement('card-name', displayName));
  header.append(costElement);

  const stats = document.createElement('div');
  stats.className = 'stats';
  stats.append(
    createStat(t('card.move'), `${ship.move ?? 0}"`),
    createStat(t('card.cruise'), `${ship.cruise ?? 0}"`),
    // O PDF do Army Forge mostra os valores sem "+" (Evade 2 / Tough 2).
    createStat(t('card.evade'), String(ship.evade ?? 0)),
    createStat(t('card.tough'), String(ship.tough ?? 0)),
  );

  if (design !== 'tcg') header.append(stats);
  card.append(header);
  if (design === 'tcg') card.append(stats);

  const body = document.createElement('div');
  body.className = 'ship-body';

  // Coluna principal: dano de esquadrão, herói/título, sistemas e as regras
  // especiais da própria nave. As armas ficam na coluna da direita no design
  // Tabela e empilhadas nos demais.
  const main = document.createElement('div');
  main.className = 'ship-body-main';

  if (ship.squadron) {
    const damage = document.createElement('div');
    damage.className = 'ship-damage';
    damage.append(
      createTextElement('ship-damage-label', t('card.squadronDamage')),
      createDamageBoxes(shipSquadronCapacity(army, ship)),
    );
    main.appendChild(damage);
  }

  if (heroTitles.length > 0) {
    main.appendChild(
      createTextElement('section-title section-title--hero', t('card.heroTitle')),
    );
    const list = document.createElement('div');
    list.className = 'ship-upgrade-list';
    for (const entry of heroTitles) {
      list.appendChild(
        createShipUpgradeRow(namedEntryText(entry), {
          cost: typeof entry.cost === 'number' ? entry.cost : undefined,
        }),
      );
    }
    main.appendChild(list);
  }

  if (systems.length > 0) {
    main.appendChild(
      createTextElement('section-title section-title--systems', t('card.systems')),
    );
    const list = document.createElement('div');
    list.className = 'ship-upgrade-list';
    for (const system of systems) {
      list.appendChild(
        createShipUpgradeRow(namedEntryText(system), {
          capacity: shipSystemCapacity(army, ship, system),
        }),
      );
    }
    main.appendChild(list);
  }

  if (specialNames.length > 0) {
    main.appendChild(
      createTextElement('section-title section-title--rules', t('card.specialRules')),
    );
    const rulesContainer = document.createElement('div');
    rulesContainer.className = 'rules-container';
    const pillTexts = new Set<string>();
    for (const name of specialNames) pillTexts.add(trRuleLabel({ name }));
    for (const pill of [...pillTexts].sort((a, b) => a.localeCompare(b))) {
      const el = document.createElement('span');
      el.className = 'rule-pill';
      el.textContent = pill;
      rulesContainer.appendChild(el);
    }
    main.appendChild(rulesContainer);
  }

  // Armas da nave: a torreta base (Ran/Att/Str da nave) aparece sempre — como
  // no Army Forge — e as armas escolhidas vêm depois. A torreta não é uma
  // melhoria, então fica sem caixas de dano.
  const weaponsWrap = document.createElement('div');
  weaponsWrap.className = 'ship-body-weapons';
  weaponsWrap.appendChild(
    createTextElement('section-title section-title--weapons', t('card.weapons')),
  );
  const weaponsContainer = document.createElement('div');
  weaponsContainer.className = 'weapons-container';
  const table = document.createElement('table');
  table.className = 'weapons-table';
  const head = table.createTHead().insertRow();
  for (const column of [
    { text: t('wpn.weapon') },
    { text: t('wpn.range'), className: 'w-num' },
    { text: t('wpn.attacks'), className: 'w-num' },
    { text: t('wpn.str'), className: 'w-num' },
    { text: t('wpn.damage'), className: 'w-num w-dmg' },
    { text: t('wpn.special') },
  ]) {
    const th = document.createElement('th');
    if (column.className) th.className = column.className;
    th.textContent = column.text;
    head.appendChild(th);
  }
  const tableBody = table.createTBody();
  const turretRow = tableBody.insertRow();
  const turretNameCell = turretRow.insertCell();
  turretNameCell.className = 'w-name';
  turretNameCell.append(createShipFacingIcon(undefined), t('wpn.turret'));
  for (const [text, className] of [
    [`${ship.range ?? 0}"`, 'w-num'],
    [String(ship.att ?? 0), 'w-num'],
    [String(ship.str ?? 0), 'w-num'],
    ['-', 'w-num w-dmg'],
    ['-', 'w-special'],
  ] as [string, string][]) {
    const td = turretRow.insertCell();
    td.className = className;
    td.textContent = text;
  }
  for (const weapon of weaponEntries) {
    const row = tableBody.insertRow();
    const range =
      typeof weapon.range === 'number'
        ? `${weapon.range}"`
        : weapon.range.includes('"')
          ? weapon.range
          : `${weapon.range}"`;
    const attacks = String(weapon.attacks);
    const str = String(weapon.str);
    const specials = Array.isArray(weapon.special) ? weapon.special : [];

    const nameCell = row.insertCell();
    nameCell.className = 'w-name';
    nameCell.append(
      createShipFacingIcon(weapon.facing),
      trWeaponName(weapon) || '-',
    );
    for (const text of [range, attacks, str]) {
      const cell = row.insertCell();
      cell.className = 'w-num';
      cell.textContent = text;
    }
    const damageCell = row.insertCell();
    damageCell.className = 'w-num w-dmg';
    damageCell.appendChild(createDamageBoxes(shipWeaponCapacity(army, ship, weapon)));
    const specialCell = row.insertCell();
    specialCell.className = 'w-special';
    specialCell.textContent =
      specials
        .map((special) => trRuleLabel({ name: special }))
        .filter(Boolean)
        .join(', ') || '-';
  }
  weaponsContainer.appendChild(table);
  weaponsWrap.appendChild(weaponsContainer);

  body.append(main, weaponsWrap);
  card.append(body);

  if (ship.notes) {
    card.appendChild(createTextElement('card-notes', String(ship.notes)));
  }

  enableCardImageUpload(card, design);

  return card;
}

function shipCardHasStale(ship: Ship): boolean {
  for (const name of [...shipSpecialNames(ship), ...shipTraitNames(ship)]) {
    if (isStaleText(trRuleLabel({ name }))) return true;
  }
  for (const entry of getShipHeroTitles(ship)) {
    if (isStaleText(namedEntryText(entry))) return true;
  }
  for (const system of getShipSystems(ship)) {
    if (isStaleText(namedEntryText(system))) return true;
  }
  for (const weapon of getShipWeapons(ship)) {
    if (isStaleText(trWeaponName(weapon))) return true;
    for (const special of Array.isArray(weapon.special) ? weapon.special : []) {
      if (isStaleText(trRuleLabel({ name: special }))) return true;
    }
  }
  return false;
}

/**
 * Fill `container` with cards. With `combineSimilar` (the default), identical
 * units collapse into a single card prefixed with their count. With
 * `useCustomNames`, a renamed unit shows its Army Forge custom name as the title.
 * Returns the number of units (unchanged by combining, so callers can detect an
 * empty list).
 */
export function renderCards(
  container: HTMLDivElement,
  army: ArmyList,
  combineSimilar = true,
  useCustomNames = false,
  design: CardDesign = 'classic',
): number {
  container.replaceChildren();
  
  const armyId = army.id || '';

  // Listas de Frota (Warfleets, "ftl"): os "ships" substituem os "units".
  const fleetShips = getShips(army);
  // O roster compacto só vale para listas de unidades; naves mantêm o layout
  // anterior do design Tabela.
  const rosterMode = design === 'table' && fleetShips.length === 0;
  container.classList.toggle('cards--roster', rosterMode);
  if (fleetShips.length > 0) {
    const orderedShips = [...fleetShips].sort((a, b) => {
      const costDiff = getShipTotalCost(b) - getShipTotalCost(a);
      if (costDiff !== 0) return costDiff;
      return shipNameOf(a).localeCompare(shipNameOf(b));
    });
    for (const ship of orderedShips) {
      const card = createShipCard(ship, army, armyId, design, useCustomNames);
      container.appendChild(wrapCardWithToolbar(card));
      if (design === 'tcg') fitStandardCardTitle(card);
      void restoreCardImage(card, armyId, ship.selectionId || ship.id || '');
    }
    const shipsHaveStale = orderedShips.some((ship) => shipCardHasStale(ship));
    if (shipsHaveStale) {
      container.appendChild(createStaleNote());
    }
    return fleetShips.length;
  }

  // Fold "Combine Units" halves into single units first — that's an in-game merge
  // that applies whether or not the cosmetic "combine similar units" option is on.
  const sourceUnits = Array.isArray(army.units) ? army.units : [];
  const units = mergeJoinedUnits(sourceUnits);
  const groups = combineSimilar
    ? combineUnits(units, useCustomNames)
    : units.map((unit) => ({ unit, count: 1 }));

  // Resolve each `joinToUnit` (a selectionId) to the host unit's name, so a
  // joined hero's card can name the unit it fights with — as Army Forge does.
  const nameBySelectionId = new Map<string, string>();
  for (const unit of sourceUnits) {
    if (unit.selectionId) nameBySelectionId.set(unit.selectionId, unitDisplayName(unit, useCustomNames));
  }

  // Heroes first (descending points), then other units by displayed points (descending).
  const orderedGroups = orderGroups(groups, nameBySelectionId, useCustomNames);

  if (rosterMode && orderedGroups.length > 0) {
    container.appendChild(createRosterHeader());
  }

  orderedGroups.forEach((group) => {
    const joinedToName = group.unit.joinToUnit
      ? nameBySelectionId.get(group.unit.joinToUnit) ?? ''
      : '';
    const card = createCard(
      group.unit,
      group.count,
      armyId,
      useCustomNames,
      joinedToName,
      army.name || '',
      army.gameSystem || '',
      design,
    );
    container.appendChild(wrapCardWithToolbar(card));
    if (design === 'tcg') fitStandardCardTitle(card);
    // Restore after wrapping so the toolbar's sliders exist to reflect the
    // stored zoom / opacity.
    void restoreCardImage(card, armyId, unitImageId(group.unit));
  });

  // Armas e rótulos com rating desatualizados aparecem nas cartas; a explicação
  // do † vai logo abaixo das cartas (próximo ao título de Regras especiais).
  let cardsHaveStale = false;
  for (const { unit } of orderedGroups) {
    if (cardsHaveStale) break;
    for (const pill of [...getRules(unit).map((r) => trRuleLabel(r)), ...getUpgradeRulePills(unit)]) {
      if (isStaleText(pill)) { cardsHaveStale = true; break; }
    }
    if (cardsHaveStale) break;
    for (const weapon of getWeapons(unit)) {
      if (isStaleText(trWeaponName(weapon))) { cardsHaveStale = true; break; }
      for (const rule of getWeaponSpecialRules(weapon)) {
        if (isStaleText(trRuleLabel(rule))) { cardsHaveStale = true; break; }
      }
      if (cardsHaveStale) break;
    }
    if (cardsHaveStale) break;
    for (const item of getUpgrades(unit)) {
      for (const rule of Array.isArray(item.content) ? item.content : Array.isArray(item.specialRules) ? item.specialRules : []) {
        if (isStaleText(trRuleLabel(rule as UnitRule))) { cardsHaveStale = true; break; }
      }
      if (cardsHaveStale) break;
    }
  }
  if (cardsHaveStale) container.appendChild(createStaleNote());

  return units.length;
}

// Capas oficiais do Army Forge (a mesma arte da home do app). O Army Forge não
// expõe esses arquivos pela API, então o mapa é fixo; a chave é o código do
// sistema e o valor é o prefixo do arquivo em army-forge.opr-cdn.com/app.
const CARD_BACK_COVERS: Record<string, string> = {
  gf: 'gf',
  gff: 'gff',
  aof: 'aof',
  aofs: 'aofs',
  aofr: 'aofr',
  ftl: 'ftl',
  gfwf: 'ftl',
};

// Escolhe a capa pelo slug do sistema (mais confiável que o código em listas
// antigas) e cai para o código quando o slug não é reconhecido.
function cardBackCode(army: ArmyList): string {
  const slug = (army.gameSystemSlug || '').toLowerCase();
  if (slug.includes('warfleet')) return 'ftl';
  if (slug.startsWith('grimdark-future-firefight')) return 'gff';
  if (slug.startsWith('grimdark-future')) return 'gf';
  if (slug.startsWith('age-of-fantasy-skirmish')) return 'aofs';
  if (slug.startsWith('age-of-fantasy-regiments')) return 'aofr';
  if (slug.startsWith('age-of-fantasy')) return 'aof';

  const code = (army.gameSystem || '').toLowerCase();
  return CARD_BACK_COVERS[code] ?? 'gf';
}

function cardBackImageFor(army: ArmyList): string {
  return `https://army-forge.opr-cdn.com/app/${cardBackCode(army)}_cover.jpg`;
}

// Junta ids/nomes de regras de uma cadeia de `content` (regras concedidas por
// armas e itens). Quando `grantedIds` é passado, essas regras contam como
// concedidas e alimentam a expansão de regras citadas na descrição.
function collectRuleRefs(
  entries: WeaponSpecialRule[] | undefined,
  usedIds: Set<string>,
  usedNames: Set<string>,
  grantedIds?: Set<string>,
): void {
  if (!Array.isArray(entries)) return;
  for (const entry of entries) {
    if (entry.id) {
      usedIds.add(entry.id);
      grantedIds?.add(entry.id);
    }
    if (entry.name) usedNames.add(entry.name);
    collectRuleRefs(entry.content, usedIds, usedNames, grantedIds);
  }
}

interface CardBackRuleEntry {
  name: string;
  /** Termo original em inglês, exibido entre parênteses como na tabela. */
  original?: string;
  description: string;
}

// Regras de uma unidade para o verso: próprias, das armas, dos itens e as
// concedidas por melhorias. AP entra sempre — vale para todas as unidades.
function unitRulesForBack(unit: Unit, army: ArmyList): CardBackRuleEntry[] {
  const usedIds = new Set<string>();
  const usedNames = new Set<string>();
  const grantedIds = new Set<string>();

  for (const rule of getRules(unit)) {
    if (rule.id) usedIds.add(rule.id);
    if (rule.name) usedNames.add(rule.name);
  }
  for (const weapon of getWeapons(unit)) {
    collectRuleRefs(getWeaponSpecialRules(weapon), usedIds, usedNames);
    collectRuleRefs(weapon.content, usedIds, usedNames, grantedIds);
  }
  for (const upgrade of getUpgrades(unit)) {
    collectRuleRefs(getWeaponSpecialRules(upgrade), usedIds, usedNames);
    collectRuleRefs(upgrade.content, usedIds, usedNames, grantedIds);
  }
  for (const { gain } of getUpgradeRuleGains(unit)) {
    if (gain.id) {
      usedIds.add(gain.id);
      grantedIds.add(gain.id);
    }
    if (gain.name) usedNames.add(gain.name);
  }
  // AP é comum a todas as unidades: o verso sempre traz a explicação.
  usedNames.add('AP');

  const armySpecialRules = Array.isArray(army.specialRules) ? army.specialRules : [];
  const commonRuleNames = new Set(
    (Array.isArray(army.commonRuleNames) ? army.commonRuleNames : [])
      .map((name) => name.trim())
      .filter(Boolean),
  );
  return resolveRulesForUse(armySpecialRules, usedIds, usedNames, grantedIds).map((rule) =>
    cardBackRuleEntry(rule, commonRuleNames),
  );
}

// Regras de uma nave (Warfleets). Os nomes vêm soltos na própria nave; quando o
// livro traz uma descrição com o mesmo nome, ela é usada. AP não se aplica.
function shipRulesForBack(ship: Ship, army: ArmyList): CardBackRuleEntry[] {
  const fleet = fleetRulePool(army, [ship]);
  const usedIds = new Set<string>();
  const usedNames = new Set<string>(fleet.names);
  for (const system of getShipSystems(ship)) {
    if (system.id) usedIds.add(system.id);
  }
  for (const entry of getShipHeroTitles(ship)) {
    if (entry.id) usedIds.add(entry.id);
  }
  for (const trait of Array.isArray(ship.traits) ? ship.traits : []) {
    const id = shipEntryId(trait);
    if (id) usedIds.add(id);
  }

  const commonRuleNames = new Set(
    (Array.isArray(army.commonRuleNames) ? army.commonRuleNames : [])
      .map((name) => name.trim())
      .filter(Boolean),
  );
  const entries = resolveRulesForUse(fleet.pool, usedIds, usedNames, new Set()).map((rule) =>
    cardBackRuleEntry(rule, commonRuleNames),
  );

  // Nomes sem entrada no livro ainda aparecem no verso, sem descrição.
  const seen = new Set(entries.map((entry) => entry.name));
  for (const name of fleet.names) {
    const label = trRuleLabel({ name });
    if (!label || seen.has(label)) continue;
    seen.add(label);
    entries.push({ name: label, description: '' });
  }
  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

// Formata o nome exibido de uma regra: traduzido quando há tradução, com "(X)"
// nas regras ranqueadas e com o † da tradução desatualizada. Também devolve o
// termo original em inglês para o parêntese — usado na tabela de Regras
// especiais e no verso das cartas, para os dois ficarem iguais.
function ruleNameDisplay(
  rule: ArmySpecialRule,
  commonRuleNames: Set<string>,
): { display: string; original: string; stale: boolean } {
  const rawName = getLang() === 'en' ? (rule.name ?? '') : trRuleName(rule);
  const stale = isStaleText(rawName);
  const baseName = stripStaleText(rawName);
  const isArmorPenetration = getLang() !== 'en' && (rule.name ?? '').trim() === 'AP';
  const isRated =
    isArmorPenetration ||
    (rule.hasRating === true && !commonRuleNames.has((rule.name ?? '').trim()));
  const display = isRated
    ? `${baseName}${baseName.includes(')') ? ' ' : ''}(X)`
    : baseName;

  const originalRuleName = rule.name?.trim() || '';
  const hasParentheticalExplanation = /\([^)]*\)/.test(baseName);
  const showOriginal =
    getLang() !== 'en' &&
    originalRuleName !== '' &&
    baseName !== originalRuleName &&
    (isArmorPenetration || !hasParentheticalExplanation);

  return { display, original: showOriginal ? originalRuleName : '', stale };
}

function cardBackRuleEntry(rule: ArmySpecialRule, commonRuleNames: Set<string>): CardBackRuleEntry {
  const { display, original, stale } = ruleNameDisplay(rule, commonRuleNames);

  const fallback = (rule as unknown as { __fallbackDesc?: string }).__fallbackDesc ?? '';
  const translated = getLang() === 'en' ? (rule.description ?? '') : trRuleDescription(rule);
  const isPlaceholder =
    translated.trim() === (rule.name ?? '') || translated.trim() === (rule.description ?? '');
  const description = (fallback && isPlaceholder ? fallback : translated).trim();

  return {
    name: stale ? display + STALE_MARK : display,
    original,
    description,
  };
}

// Monta o painel impresso no verso: nome da unidade, título e a lista
// "Regra: descrição" correspondente àquela unidade.
function createCardBackRulesPanel(unitName: string, entries: CardBackRuleEntry[]): HTMLDivElement {
  const panel = document.createElement('div');
  panel.className = 'card-back-panel';

  const head = document.createElement('div');
  head.className = 'card-back-panel-head';
  head.append(
    createTextElement('card-back-unit-name', unitName),
    createTextElement('card-back-rules-title', t('cardBacks.rulesTitle')),
  );

  const list = document.createElement('div');
  list.className = 'card-back-rules';
  if (entries.length === 0) {
    list.appendChild(createTextElement('muted', t('card.noRules')));
  } else {
    for (const entry of entries) {
      const paragraph = document.createElement('p');
      paragraph.className = 'card-back-rule';
      const name = document.createElement('strong');
      name.textContent = entry.name;
      if (entry.original) {
        const original = document.createElement('span');
        original.className = 'rule-name-original';
        original.textContent = ` (${entry.original})`;
        name.appendChild(original);
      }
      paragraph.appendChild(name);
      if (entry.description) {
        paragraph.append(': ', entry.description);
      }
      list.appendChild(paragraph);
    }
  }

  panel.append(head, list);
  return panel;
}

// Reduz a fonte do verso até o conteúdo caber no cartão (caixa fixa de
// 63,5 × 88 mm). Busca o maior tamanho que cabe entre 5,8pt e 2pt: textos longos
// (muitas regras ou descrições compridas) encolhem o quanto for preciso em vez
// de vazar. O `overflow: hidden` do CSS é só o último recurso.
//
// A medição usa as caixas da última regra e da lista, e não `scrollHeight`:
// como a lista tem `overflow: hidden`, o `scrollHeight` satura na altura da
// caixa e "parece caber" mesmo com a última linha já cortada.
function fitCardBackRules(back: HTMLElement): void {
  const list = back.querySelector<HTMLElement>('.card-back-rules');
  const last = list?.lastElementChild as HTMLElement | null | undefined;
  if (!list || !last) return;
  // Fora do documento (ou com a seção oculta) as caixas medem zero: nesse caso
  // mantemos o tamanho padrão em vez de encolher tudo para o mínimo.
  if (list.getBoundingClientRect().height <= 0) return;
  // Folga de ~1mm: sem ela a última linha encosta na borda e o arredondamento
  // da impressão pode cortá-la.
  const slack = 4;
  const fits = (size: number): boolean => {
    list.style.fontSize = `${size}pt`;
    const listBox = list.getBoundingClientRect();
    const padding = parseFloat(getComputedStyle(list).paddingBottom) || 0;
    const lastBox = last.getBoundingClientRect();
    return lastBox.bottom <= listBox.bottom - padding - slack;
  };
  const max = 5.8;
  const min = 2;
  if (fits(max)) return;
  let low = min;
  let high = max;
  for (let step = 0; step < 14; step += 1) {
    const mid = (low + high) / 2;
    if (fits(mid)) low = mid;
    else high = mid;
  }
  list.style.fontSize = `${low}pt`;
}

/**
 * Desenha o verso das cartas no modo Standard: um verso por carta visível, na
 * mesma ordem e na mesma quantidade, para que a impressão em duplex (frentes e
 * depois versos) alinhe carta a carta. Por padrão o verso é a capa do sistema;
 * com `rulesOnBack`, mostra as regras especiais daquela unidade.
 */
export function renderCardBacks(
  container: HTMLElement,
  army: ArmyList,
  cards: Element[],
  rulesOnBack = false,
): void {
  container.replaceChildren();

  if (cards.length === 0) return;

  const image = cardBackImageFor(army);
  // Os cartões carregam o id da unidade/nave que representam; unidades fundidas
  // pela regra "Combine Units" aparecem já mescladas, como nas frentes.
  const units = mergeJoinedUnits(Array.isArray(army.units) ? army.units : []);
  const unitById = new Map(units.map((unit) => [unitImageId(unit), unit]));
  const shipById = new Map(
    getShips(army).map((ship) => [ship.selectionId || ship.id || '', ship]),
  );

  for (const card of cards) {
    const back = document.createElement('div');
    back.className = 'card-back';
    back.setAttribute('aria-hidden', 'true');

    if (!rulesOnBack) {
      back.style.backgroundImage = `url("${image}")`;
      container.appendChild(back);
      continue;
    }

    const element = card as HTMLElement;
    const unitId = element.dataset.unitId ?? '';
    const unit = unitById.get(unitId);
    const ship = unit ? undefined : shipById.get(unitId);
    const unitName = element.dataset.unitName ?? unit?.name ?? ship?.name ?? '';
    const entries = unit
      ? unitRulesForBack(unit, army)
      : ship
        ? shipRulesForBack(ship, army)
        : [];

    back.classList.add('card-back--rules');
    back.appendChild(createCardBackRulesPanel(unitName, entries));
    container.appendChild(back);
    fitCardBackRules(back);
  }
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// A granted ability often names another rule only in its prose description, with
// no structural link in the data — e.g. "Shred when Shooting" reads "...gets
// Shred when shooting", and "Repel Ambushers" mentions "Ambush". For each granted
// rule on the unit, pull in the army rule it names so that rule's description
// shows in the table instead of dangling.
//
// Scoped deliberately: only rules granted via an item's `content` seed the scan
// (so a core rule like AP mentioning a stat in passing doesn't), and rating-based
// entries (Defense, Armor, Tough...) are never pulled in — those are stat
// modifiers mentioned inline, not keyword rules a reader needs spelled out.
function expandGrantedRules(
  included: ArmySpecialRule[],
  grantedIds: Set<string>,
  allRules: ArmySpecialRule[],
): ArmySpecialRule[] {
  const candidates = allRules.filter(
    (rule) => rule.name && rule.description && rule.hasRating !== true,
  );
  const result = [...included];
  const seenIds = new Set(included.map((rule) => rule.id));

  for (const source of included.filter((rule) => grantedIds.has(rule.id))) {
    const description = source.description ?? '';
    for (const candidate of candidates) {
      if (seenIds.has(candidate.id)) continue;
      // Whole-word, case-sensitive: descriptions name other rules capitalized,
      // which keeps common lowercase words from matching by accident.
      if (new RegExp(`\\b${escapeRegExp(candidate.name)}\\b`).test(description)) {
        seenIds.add(candidate.id);
        result.push(candidate);
      }
    }
  }

  return result;
}

// The army's points / activations / game system line, shared by the rules and
// spells table headers and the on-screen summary. "Combine similar units" hides
// how many units there really are, so the activation tally (matching Army Forge)
// is the unambiguous count.

// Código do sistema de jogo (como o Army Forge manda) -> nome completo.
// Códigos que não estiverem aqui aparecem como vieram, em maiúsculas.
const GAME_SYSTEM_NAMES: Record<string, string> = {
  gf: 'Grimdark Future',
  gff: 'Grimdark Future: Firefight',
  aof: 'Age of Fantasy',
  aofs: 'Age of Fantasy: Skirmish',
  aofr: 'Age of Fantasy: Regiments',
  ftl: 'Grimdark Future: Warfleets',
  gfwf: 'Grimdark Future: Warfleets',
};

const SMALL_WORDS = new Set(['of', 'the', 'and']);

function titleCaseSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((word, index) =>
      index > 0 && SMALL_WORDS.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(' ');
}

// "grimdark-future-firefight" -> "Grimdark Future: Firefight"
// "age-of-fantasy" -> "Age of Fantasy"
// "grimdark-future-warfleets2" -> "Grimdark Future: Warfleets" (sem o "2")
function gameNameFromSlug(slug: string): string {
  const base = ['grimdark-future', 'age-of-fantasy'].find(
    (prefix) => slug === prefix || slug.startsWith(`${prefix}-`),
  );
  if (!base) return titleCaseSlug(slug);
  const rest = slug.slice(base.length + 1).replace(/\d+$/, '').trim();
  return rest ? `${titleCaseSlug(base)}: ${titleCaseSlug(rest)}` : titleCaseSlug(base);
}

// Usa o nome que o Army Forge informou; sem ele (listas salvas antes dessa
// mudança), cai na tabela de siglas.
function gameSystemName(army: ArmyList): string {
  if (army.gameSystemSlug) return gameNameFromSlug(army.gameSystemSlug);
  const code = (army.gameSystem || '').toLowerCase();
  return GAME_SYSTEM_NAMES[code] ?? code.toUpperCase();
}



function armyInfoMeta(army: ArmyList): string {
  const activations = army.activationCount;
  const activationsPart =
    typeof activations === 'number' && activations > 0
      ? `${activations} ${tn('activation', activations)} · `
      : '';
  const books = (Array.isArray(army.armyBooks) ? army.armyBooks : [])
    .map((book) => [book.name, book.version].filter(Boolean).join(' '))
    .filter(Boolean)
    .join(' + ');
  const bookPart = books ? `${books} · ` : '';
  return `${bookPart}${army.listPoints} / ${army.pointsLimit} pts · ${activationsPart}${gameSystemName(army)}`;
}

// A table-header cell holding the army name and info line, spanning the table's
// full width.
function createArmyHeaderCell(army: ArmyList, colSpan: number): HTMLTableCellElement {
  const cell = document.createElement('th');
  cell.colSpan = colSpan;
  cell.className = 'army-header-cell';
  cell.append(
    createTextElement('army-info-name', army.name),
    createTextElement('army-info-meta', armyInfoMeta(army)),
  );
  return cell;
}

// --- Textos de Force Org (army.forceOrgErrors, vindos do /tts) -------------
// O Army Forge devolve frases em inglês com parâmetros (quantidades, faixas
// de pontos, nomes de unidades). As mensagens abaixo cobrem todas as frases
// geradas pela validação do Army Forge (exércitos e frotas). Nomes de
// unidades/naves ficam em inglês; o resto segue o idioma da interface. Se
// aparecer uma frase nova, cai no aviso genérico de Force Org.
function translateForceOrgError(message: string): string {
  const text = message.trim();

  const points = text.match(/^Points limit exceeded: (\d+)\/(\d+)$/);
  if (points) return t('fo.pointsLimit', { current: points[1] ?? '', limit: points[2] ?? '' });

  const heroes = text.match(/^Max 1 Hero per full (\d+)pts\.$/);
  if (heroes) return t('fo.heroes', { n: heroes[1] ?? '' });

  const unitsCombined = text.match(/^Max 1 unit per full (\d+)pts \(combined units count as just 1 unit\)\.$/);
  if (unitsCombined) return t('fo.unitsCombined', { n: unitsCombined[1] ?? '' });

  const units = text.match(/^Max 1 unit per full (\d+)pts\.$/);
  if (units) return t('fo.units', { n: units[1] ?? '' });

  const copies = text.match(/^Cannot have more than (\d+) copies of a particular unit \((.*)\)\.?$/);
  if (copies) return t('fo.copies', { n: copies[1] ?? '', name: copies[2] ?? '' });

  const unitPoints = text.match(/^May not bring any single unit worth more than 35% of total points \((\d+)pts\)\.$/);
  if (unitPoints) return t('fo.maxUnitPoints', { pts: unitPoints[1] ?? '' });

  if (/^Cannot combine units of unit size \[1\]\.$/.test(text)) return t('fo.cannotCombine');
  if (/^Heroes cannot join units that only contain a single model\.$/.test(text)) return t('fo.heroSingleModel');
  if (/^A unit can only have a maximum of one Hero attached\.$/.test(text)) return t('fo.heroAttached');

  const maxModels = text.match(
    /^Max 1 model per full (\d+)pts\. Maximum valid number of models is (\d+), current total is (\d+)\.$/,
  );
  if (maxModels) {
    return t('fo.maxModels', { n: maxModels[1] ?? '', max: maxModels[2] ?? '', cur: maxModels[3] ?? '' });
  }

  const maxTough = text.match(/^Max (Models\/)?Tough is (\d+), current total is (\d+)\.$/);
  if (maxTough) {
    const key = maxTough[1] ? 'fo.maxToughModels' : 'fo.maxTough';
    return t(key, { max: maxTough[2] ?? '', cur: maxTough[3] ?? '' });
  }

  if (/^Max 1 of the following upgrades per army \(not one of each!\): Sergeant, Musician or Banner\.$/.test(text)) {
    return t('fo.upgrades');
  }

  const unique = text.match(/^(.+) is a Unique unit and may only be taken once per army\.$/);
  if (unique) return t('fo.unique', { name: unique[1] ?? '' });

  // Frotas (Grimdark Future: Warfleets)
  const slots = text.match(/^(.+) only has (\d+) slots filled out of (\d+)\.$/);
  if (slots) return t('fo.slots', { name: slots[1] ?? '', n: slots[2] ?? '', total: slots[3] ?? '' });

  const fleetHeroes = text.match(/^Players may only bring up to 1 hero per (\d+)pts in their fleet$/);
  if (fleetHeroes) return t('fo.fleetHeroes', { n: fleetHeroes[1] ?? '' });

  const fleetDuplicates = text.match(
    /^Players may only bring X copies of the same ship, where X is 1 per (\d+)pts in their fleet$/,
  );
  if (fleetDuplicates) return t('fo.fleetDuplicates', { n: fleetDuplicates[1] ?? '' });

  const fleetShips = text.match(/^Fleets may only have max\. of 1 ship per (\d+)pts\.$/);
  if (fleetShips) return t('fo.fleetShips', { n: fleetShips[1] ?? '' });

  const fleetSquadrons = text.match(
    /^Fleets may only have max\. as many squadrons as total upgrades across all ships (\d+)\.$/,
  );
  if (fleetSquadrons) return t('fo.fleetSquadrons', { n: fleetSquadrons[1] ?? '' });

  return t('summary.forceOrgWarning');
}

// On-screen summary shown beneath the print options. Repeats the army name and
// info line so it stays visible while scrolling through many cards. Marked
// no-print so it never appears on the printed sheet.
export function renderArmySummary(section: HTMLElement, army: ArmyList): void {
  const details = document.createElement('div');
  details.className = 'army-summary-content';
  details.append(
    createTextElement('army-info-name', army.name),
    createTextElement('army-info-meta', armyInfoMeta(army)),
  );
  section.replaceChildren(details);

  const bookCounts = new Map<string, number>();
  for (const unit of Array.isArray(army.units) ? army.units : []) {
    if (unit.armyId) bookCounts.set(unit.armyId, (bookCounts.get(unit.armyId) ?? 0) + 1);
  }
  for (const ship of getShips(army)) {
    const fleetId = ship.fleetId === 'common' ? 'Xp0jnYANoRO2pFrw' : ship.fleetId;
    if (fleetId) bookCounts.set(fleetId, (bookCounts.get(fleetId) ?? 0) + 1);
  }
  const imageBook = (army.armyBooks ?? [])
    .filter((book) => book.imageUrl)
    .sort((a, b) => (bookCounts.get(b.id) ?? 0) - (bookCounts.get(a.id) ?? 0))[0];
  if (imageBook?.imageUrl) {
    const image = document.createElement('img');
    image.className = 'army-summary-image';
    image.src = imageBook.imageUrl;
    image.alt = imageBook.name;
    image.loading = 'lazy';
    image.decoding = 'async';
    image.referrerPolicy = 'no-referrer';
    image.addEventListener('error', () => image.remove(), { once: true });
    section.append(image);
  }
  // Avisos do Army Forge (ex.: "Cannot have more than 3 copies of a particular unit (Vulture).").
  // Mostra a mensagem exata da API; em pt-BR ela permanece em inglês até existir
  // tradução, como qualquer outro conteúdo sem entrada no dicionário.
  // Lista sem erros de force org nao mostra aviso.
  const forceOrgErrors = (Array.isArray(army.forceOrgErrors) ? army.forceOrgErrors : [])
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter(Boolean);
  if (forceOrgErrors.length > 0) {
    const warning = document.createElement('div');
    warning.className = 'army-force-org-warning';
    warning.textContent = forceOrgErrors.map((message) => `⚠ ${translateForceOrgError(message)}`).join(' ');
    details.append(warning);
  }
}

// Resolve as regras que uma lista/unidade referencia para as entradas reais de
// `army.specialRules`: acha por id (ou id alternativo) e por nome, completa a
// descrição de instâncias ranqueadas com o texto genérico, puxa regras citadas
// por habilidades concedidas, deduplica por nome e ordena pelo nome traduzido.
// Compartilhado pela tabela de Regras especiais e pelo verso de carta com regras.
function resolveRulesForUse(
  armySpecialRules: ArmySpecialRule[],
  usedIds: Set<string>,
  usedNames: Set<string>,
  grantedIds: Set<string>,
): ArmySpecialRule[] {
  const used = armySpecialRules.filter(
    (r) => usedIds.has(r.id) || (r.aliasedRuleId != null && usedIds.has(r.aliasedRuleId)) || (r.name != null && usedNames.has(r.name)),
  );
  // Army Forge ships rated instances (e.g. CQes0mDvF4bV AP hasRating:true, desc='AP')
  // whose description is just the name. The explanatory text lives on the
  // generic common rule (e.g. 17crjK7P6_w6 AP). Fall back by name so the table
  // shows the full text instead of AP:AP in the ACTIVE language.
  // Elements below: { rule, fallbackDesc? }
  type WithFallback = { rule: ArmySpecialRule; fallbackDesc?: string };
  const genericByName: Map<string, WithFallback> = new Map();
  for (const rule of armySpecialRules) {
    if (!rule.name) continue;
    if (rule.hasRating !== true && rule.description && rule.description.trim() && rule.description.trim() !== rule.name) {
      if (!genericByName.has(rule.name)) genericByName.set(rule.name, { rule });
    }
  }
  const withGenericDesc: (ArmySpecialRule & { __fallbackDesc?: string })[] = used.map((rule) => {
    const desc = (rule.description ?? '').trim();
    if (desc && desc !== rule.name) return rule;
    const wb = rule.name ? genericByName.get(rule.name) : undefined;
    if (!wb || wb.rule === rule) return rule;
    // Copy the generic description (English text) onto the rated instance,
    // so trRuleDescription can still translate it in pt-BR or return it
    // in English for en-US.
    return { ...rule, __fallbackDesc: wb.rule.description } as ArmySpecialRule & { __fallbackDesc?: string };
  });
  const expanded = expandGrantedRules(
    withGenericDesc as unknown as ArmySpecialRule[],
    grantedIds,
    armySpecialRules,
  );
  // Rated rules (AP, Regeneration Aura, ...) exist as one army.specialRules entry
  // per X value, but the table shows the generic name/description without the
  // rating, so distinct-X instances of the same rule would otherwise print as
  // identical duplicate rows.
  const seenNames = new Set<string>();
  const deduped = expanded.filter((rule) => {
    if (seenNames.has(rule.name)) return false;
    seenNames.add(rule.name);
    return true;
  });
  // Ordena pelo nome que o usuário vê (traduzido quando disponível). A
  // deduplicação acima continua usando o nome em inglês, que é o dado estável.
  return deduped.sort((a, b) => trRuleName(a).localeCompare(trRuleName(b)));
}

export function renderSpecialRulesTable(section: HTMLElement, army: ArmyList): void {
  section.replaceChildren();

  const usedIds = new Set<string>();
  // Army Forge sometimes ships weapon rules without an `id`
  // (e.g. Sniper Rifle with Deadly(2): { name: 'Deadly', rating: 2 }).
  // Track those by name too, so the deadbeat doesn't drop from the table.
  const usedNames = new Set<string>();
  // Ids reached through an item's `content` chain — the abilities granted to the
  // unit (e.g. Repel Ambushers). Only these seed the granted-rule scan below.
  const grantedIds = new Set<string>();
  const collect = (entries: WeaponSpecialRule[] | undefined): void => {
    if (!Array.isArray(entries)) return;
    for (const entry of entries) {
      if (entry.id) usedIds.add(entry.id);
      if (entry.name) usedNames.add(entry.name);
      collect(entry.content);
    }
  };
  const collectGranted = (entries: WeaponSpecialRule[] | undefined): void => {
    if (!Array.isArray(entries)) return;
    for (const entry of entries) {
      if (entry.id) {
        usedIds.add(entry.id);
        grantedIds.add(entry.id);
      }
      if (entry.name) usedNames.add(entry.name);
      collectGranted(entry.content);
    }
  };

  const units = Array.isArray(army.units) ? army.units : [];
  for (const unit of units) {
    for (const rule of getRules(unit)) usedIds.add(rule.id);    for (const weapon of getWeapons(unit)) {
      collect(getWeaponSpecialRules(weapon));
      collectGranted(weapon.content);
    }
    for (const upgrade of getUpgrades(unit)) {
      collect(getWeaponSpecialRules(upgrade));
      collectGranted(upgrade.content);
    }
    // Rule-only model upgrades (e.g. Sergeant) live in `selectedUpgrades`, not in
    // loadout, so collect their rule ids here too. Treat them as granted so the
    // expand scan can pull in any rule their description names.
    for (const { gain } of getUpgradeRuleGains(unit)) {
      if (gain.id) {
        usedIds.add(gain.id);
        grantedIds.add(gain.id);
      }
    }
  }

  // Frotas (Warfleets): as "regras especiais" das naves são nomes soltos.
  // Os nomes em inglês são os mesmos que `army.specialRules` usa; traduzir aqui
  // faria a busca falhar e a tabela perder as regras dos sistemas e das armas.
  const ships = getShips(army);
  const fleet = fleetRulePool(army, ships);
  for (const name of fleet.names) usedNames.add(name);
  for (const ship of ships) {
    for (const system of getShipSystems(ship)) {
      if (system.id) usedIds.add(system.id);
    }
    for (const entry of getShipHeroTitles(ship)) {
      if (entry.id) usedIds.add(entry.id);
    }
    for (const trait of Array.isArray(ship.traits) ? ship.traits : []) {
      const id = shipEntryId(trait);
      if (id) usedIds.add(id);
    }
  }

  const spellRuleIds = Array.isArray(army.spellRuleIds) ? army.spellRuleIds : [];
  for (const id of spellRuleIds) usedIds.add(id);

  const armySpecialRules = Array.isArray(army.specialRules) ? army.specialRules : [];
  // Regras comuns do sistema (vindas do relay). No Army Forge elas não têm
  // `hasRating`, então só as regras próprias do livro mostram "(X)" na tabela.
  const commonRuleNames = new Set(
    (Array.isArray(army.commonRuleNames) ? army.commonRuleNames : [])
      .map((name) => name.trim())
      .filter(Boolean),
  );
  // Reserva para listas salvas antes dessa mudança (sem `spellRuleIds`): procura
  // no efeito de cada magia o nome de uma regra que tenha descrição própria e não
  // seja ranqueada (hasRating !== true), como "Enhanced Havocbound".
  if (spellRuleIds.length === 0) {
    for (const spell of Array.isArray(army.spells) ? army.spells : []) {
      const effect = spell?.effect ?? '';
      if (!effect) continue;
      for (const rule of armySpecialRules) {
        if (rule.hasRating === true) continue;
        const desc = (rule.description ?? '').trim();
        const name = (rule.name ?? '').trim();
        if (!name || !desc || desc === name) continue;
        if (new RegExp(`\\b${escapeRegExp(name)}\\b`).test(effect)) usedNames.add(name);
      }
    }
  }
  const sorted = resolveRulesForUse(
    fleet.pool,
    usedIds,
    usedNames,
    grantedIds,
  );

  const table = document.createElement('table');
  table.className = 'special-rules-table';

  const thead = document.createElement('thead');

  const armyRow = document.createElement('tr');
  armyRow.appendChild(createArmyHeaderCell(army, 2));
  thead.appendChild(armyRow);

  if (sorted.length > 0) {
    const headerRow = document.createElement('tr');
    for (const text of [t('table.rule'), t('table.description')]) {
      const th = document.createElement('th');
      th.textContent = text;
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
  }

  const tbody = document.createElement('tbody');
  for (const rule of sorted) {
    const tr = document.createElement('tr');

    const nameTd = document.createElement('td');
    nameTd.className = 'rule-name';
    // † fica depois de (X): "Resistência(X)†" em vez de "Resistência†(X)".
    const { display, original, stale } = ruleNameDisplay(rule, commonRuleNames);
    nameTd.textContent = stale ? display + STALE_MARK : display;
    // Termo original em inglês, apenas nas tabelas, em cinza e itálico.
    if (original) {
      const originalSpan = document.createElement('span');
      originalSpan.className = 'rule-name-original';
      originalSpan.textContent = ` (${original})`;
      nameTd.appendChild(originalSpan);
    }

    const descTd = document.createElement('td');
    const fb = (rule as unknown as { __fallbackDesc?: string }).__fallbackDesc;
    // Use o fallback genérico inglês só se trRuleDescription retornou o
    // placeholder (igual ao nome). Em pt-BR, o content.ts já resolve a
    // tradução genérica, então não usamos o inglês.
    const trDesc = getLang() === 'en' ? (rule.description ?? '') : trRuleDescription(rule);
    const isPlaceholder = trDesc.trim() === (rule.name ?? '') || trDesc.trim() === (rule.description ?? '');
    descTd.textContent = fb && isPlaceholder ? fb : trDesc;

    tr.append(nameTd, descTd);
    tbody.appendChild(tr);
  }

  table.append(thead, tbody);
  if (sorted.length > 0) {
    section.append(createSectionHeading(t('table.specialRules')));
    const hasStale = sorted.some(
      (rule) =>
        isStaleText(getLang() === 'en' ? '' : trRuleName(rule)) ||
        isStaleText(getLang() === 'en' ? '' : trRuleDescription(rule)),
    );
    if (hasStale) section.append(createStaleNote());
  }
  section.append(table);
}

export function renderSpellsTable(section: HTMLElement, army: ArmyList): void {
  section.replaceChildren();

  const spells = Array.isArray(army.spells) ? army.spells : [];
  if (spells.length === 0) return;

  const sorted = [...spells].sort(
    (a, b) => a.threshold - b.threshold || trSpellName(a).localeCompare(trSpellName(b)),
  );

  const bookNames = (army.armyBooks ?? [])
    .map((book) => (book?.name ?? '').trim())
    .filter(Boolean);
  const spellsTitle = bookNames.length > 0 ? t('table.spellsArmy', { book: bookNames.join(' + ') }) : t('table.spells');

  const table = document.createElement('table');
  table.className = 'special-rules-table spells-table';

  const thead = document.createElement('thead');

  const armyRow = document.createElement('tr');
  armyRow.appendChild(createArmyHeaderCell(army, 2));
  thead.appendChild(armyRow);

  const headerRow = document.createElement('tr');
  for (const text of [t('table.spell'), t('table.effect')]) {
    const th = document.createElement('th');
    th.textContent = text;
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);

  const tbody = document.createElement('tbody');
  for (const spell of sorted) {
    const tr = document.createElement('tr');

    const nameTd = document.createElement('td');
    nameTd.className = 'rule-name';
    const rawSpellName = trSpellName(spell);
    // † fica depois do custo: "Tempestade (5)†" em vez de "Tempestade† (5)".
    const spellStale = isStaleText(rawSpellName);
    const cleanSpellName = stripStaleText(rawSpellName);
    const costText = ` (${spell.threshold ?? 0})`;
    nameTd.textContent = spellStale ? cleanSpellName + costText + STALE_MARK : cleanSpellName + costText;
    const originalSpellName = spell.name?.trim() || '';
    if (originalSpellName && cleanSpellName !== originalSpellName) {
      const originalSpan = document.createElement('span');
      originalSpan.className = 'rule-name-original';
      originalSpan.textContent = ` (${originalSpellName})`;
      nameTd.appendChild(originalSpan);
    }

    const effectTd = document.createElement('td');
    effectTd.textContent = trSpellEffect(spell);

    tr.append(nameTd, effectTd);
    tbody.appendChild(tr);
  }

  table.append(thead, tbody);
  section.append(createSectionHeading(spellsTitle));
  const spellsHaveStale = sorted.some(
    (spell) => isStaleText(trSpellName(spell)) || isStaleText(trSpellEffect(spell)),
  );
  if (spellsHaveStale) section.append(createStaleNote());
  section.append(table);
}
