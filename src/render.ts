import html2canvas from 'html2canvas';
import { getLang, t, tn } from './i18n';
// Tradução do conteúdo vindo do Army Forge (regras, armas e magias). Aplica-se
// só na hora de desenhar: os dados em `army` continuam em inglês para as
// comparações internas (Tough, AP, ligação de regras citadas etc.).
import {
  trRuleDescription,
  trRuleGainName,
  trRuleLabel,
  trRuleName,
  trSpellEffect,
  trSpellName,
  trWeaponName,
} from './i18n/content';

import { deleteCardImage, getCardImage, saveCardImage } from './db';
import type {
  ArmySpecialRule,
  ArmyList,
  SelectedUpgrade,
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

    const merged = new Map<string, { name: string; special: string; count: number }>();
    const itemOrder: string[] = [];
    for (const item of items) {
      const name = item.name?.trim() || item.label?.trim() || '';
      const itemTexts = getItemRules(item)
        .map((text) => text?.trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
      const special = itemTexts.length > 0 ? itemTexts.join(', ') : '-';
      const key = `${name}::${special}`;
      const count = typeof item.count === 'number' ? item.count : 1;
      const existing = merged.get(key);
      if (existing) {
        existing.count += count;
        continue;
      }
      merged.set(key, { name, special, count });
      itemOrder.push(key);
    }

    for (const key of itemOrder) {
      const entry = merged.get(key);
      if (!entry) continue;
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

  const rules = getRules(unit);
  const upgrades = getUpgrades(unit);
  const upgradeRulePills = getUpgradeRulePills(unit);

  // Regras concedidas por itens do loadout (ex.: "Camo Cloak" concedendo "Stealth").
  const itemRuleTexts: string[] = [];
  for (const item of upgrades) {
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

  if (rules.length === 0 && itemRuleTexts.length === 0 && upgradeRulePills.length === 0) {
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

  const sortedRules = Array.from(pillTexts).sort((a, b) => a.localeCompare(b));
  for (const pill of sortedRules) addPill(pill);
  for (const pill of upgradeRulePills) addPill(pill);

  return container;
}

// Texto de uma regra da unidade para a linha de regras: nome + rating (ex.: "Tough(9)").
function ruleText(rule: UnitRule): string {
  return trRuleLabel(rule);
}

// --- Card avatar image: círculo com pan / zoom / upload ----------------------

const DEFAULT_BG_OPACITY = 1;

const MIN_BG_SCALE = 1;
const MAX_BG_SCALE = 4;
const DEFAULT_BG_SCALE = 1;

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


// O círculo onde a imagem aparece.
function getAvatar(card: HTMLDivElement): HTMLDivElement | null {
  return card.querySelector<HTMLDivElement>('.card-avatar');
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
  if (state.zoomSlider) state.zoomSlider.value = state.scale.toString();
  scheduleCardImagePersist(card);
}

function resetCardFraming(card: HTMLDivElement): void {
  const state = getCardImageState(card);
  state.scale = DEFAULT_BG_SCALE;
  state.tx = 0;
  state.ty = 0;
  applyBgTransform(card);
  if (state.zoomSlider) state.zoomSlider.value = state.scale.toString();
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

  if (state.zoomSlider) state.zoomSlider.value = state.scale.toString();

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
function enableCardImageUpload(card: HTMLDivElement): void {
  const avatar = document.createElement('div');
  avatar.className = 'card-avatar';
  avatar.title = t('img.add');
  card.querySelector('.card-header')?.prepend(avatar);

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
      min: MIN_BG_SCALE.toString(),
      max: MAX_BG_SCALE.toString(),
      step: '0.05',
      value: DEFAULT_BG_SCALE.toString(),
    },
    (value) => setCardScale(card, parseFloat(value)),
  );
  getCardImageState(card).zoomSlider = zoom.slider;

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
    imageControls.append(zoom.row, panX.row, panY.row, reset, remove);

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

// Order the cards for the sheet: alphabetically by unit name, but keeping each
// joined Hero next to the unit it joins (Army Forge's `joinToUnit`). Every card
// is anchored to a host: a joined hero borrows its host's name and id so the two
// cluster together (and the hero sits just after its unit); everything else
// anchors to itself. Sorting by (host name, host id, host-before-hero) gives an
// A→Z list where each unit/hero pair stays side by side.
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

function createCard(
  unit: Unit,
  count = 1,
  armyId = '',
  useCustomNames = false,
  joinedToName = '',
  armyName = '',
  gameSystem = '',
): HTMLDivElement {
  const card = document.createElement('div');
  card.className = 'card';
    if (getRules(unit).some((rule) => rule.name === 'Hero')) card.classList.add('card--hero');

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
  if (weapons.length === 0 && items.length === 0) {
    weaponsContainer.appendChild(createTextElement('muted', t('card.noWeapons')));
  } else {
    weaponsContainer.appendChild(createWeaponsTable(weapons, items));
  }

   header.append(stats);

  card.append(
    header,
    createTextElement('base-info', getBaseLabel(unit, armyName, gameSystem)),
    createTextElement('section-title', t('card.specialRules')),
    createRulesContainer(unit),
    createTextElement('section-title', t('card.weapons')),
    weaponsContainer,
  );

  if (unit.notes) {
    card.appendChild(createTextElement('card-notes', unit.notes));
  }

  enableCardImageUpload(card);

  return card;
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
): number {
  container.replaceChildren();
  
  const armyId = army.id || '';
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

  // Alphabetical order, with joined hero/unit pairs kept side by side.
  const orderedGroups = orderGroups(groups, nameBySelectionId, useCustomNames);

  for (const group of orderedGroups) {
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
    );
    container.appendChild(wrapCardWithToolbar(card));
    // Restore after wrapping so the toolbar's sliders exist to reflect the
    // stored zoom / opacity.
    void restoreCardImage(card, armyId, unitImageId(group.unit));
  }

  return units.length;
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
function gameNameFromSlug(slug: string): string {
  const base = ['grimdark-future', 'age-of-fantasy'].find(
    (prefix) => slug === prefix || slug.startsWith(`${prefix}-`),
  );
  if (!base) return titleCaseSlug(slug);
  const rest = slug.slice(base.length + 1);
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

// On-screen summary shown beneath the print options. Repeats the army name and
// info line so it stays visible while scrolling through many cards. Marked
// no-print so it never appears on the printed sheet.
export function renderArmySummary(section: HTMLElement, army: ArmyList): void {
  section.replaceChildren(
    createTextElement('army-info-name', army.name),
    createTextElement('army-info-meta', armyInfoMeta(army)),
  );
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
    warning.textContent = forceOrgErrors.map((message) => `⚠ ${message}`).join(' ');
    section.append(warning);
  }
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
    for (const rule of getRules(unit)) usedIds.add(rule.id);
    for (const weapon of getWeapons(unit)) {
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
  const sorted = deduped.sort((a, b) => trRuleName(a).localeCompare(trRuleName(b)));

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
    const baseName = getLang() === 'en' ? (rule.name ?? '') : trRuleName(rule);
    // Regras ranqueadas do livro mostram "(X)" (ex.: Crossing Attack(X)), como no
    // Army Forge; regras comuns (Deadly, AP, Tough) e regras sem valor ficam só
    // com o nome. O valor real (2, 3, ...) aparece apenas nas cartas.
    const isRated =
      rule.hasRating === true && !commonRuleNames.has((rule.name ?? '').trim());
    const displayName = isRated ? `${baseName}(X)` : baseName;
    nameTd.textContent = displayName;
    // Termo original em inglês, apenas nas tabelas, em cinza e itálico.
    const originalRuleName = rule.name?.trim() || '';
    if (getLang() !== 'en' && originalRuleName && baseName !== originalRuleName) {
      const originalSpan = document.createElement('span');
      originalSpan.className = 'rule-name-original';
      originalSpan.textContent = ` (${originalRuleName})`;
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
    if (sorted.length > 0) section.append(createSectionHeading(t('table.specialRules')));
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
    const spellNameForDisplay = trSpellName(spell);
    const costText = ` (${spell.threshold ?? 0})`;
    nameTd.textContent = `${spellNameForDisplay}${costText}`;
    const originalSpellName = spell.name?.trim() || '';
    if (originalSpellName && trSpellName(spell) !== originalSpellName) {
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
  section.append(table);
}
