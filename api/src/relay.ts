// Framework-free relay core shared by the Express server (api/src/server.ts) and
// the Netlify Function (netlify/functions/army.mts). It only uses the global
// `fetch`, so it bundles cleanly in both a Node server and a serverless runtime.
//
// Why it exists: OnePageRules' army feed (/api/tts) is CORS-enabled, but the
// core/common rule descriptions (/api/rules/common/{id}) send no CORS header,
// so a static browser app can't read them directly. This runs server-side,
// merges both sources, and returns one combined payload. OPR permits this for
// free, non-monetized community use.

const OPR_TTS_URL = 'https://army-forge.onepagerules.com/api/tts';
const OPR_COMMON_RULES_URL = 'https://army-forge.onepagerules.com/api/rules/common';
const OPR_ARMY_BOOKS_URL = 'https://army-forge.onepagerules.com/api/army-books';

const GAME_SYSTEM_IDS: Record<string, number> = {
  gf: 2,
  gff: 3,
  aof: 4,
  aofs: 5,
  aofr: 6,
};

export interface RuleLike {
  id?: string;
  name?: string;
  description?: string;
  content?: RuleLike[];
}

export interface UnitLike {
  armyId?: string;
  rules?: RuleLike[];
  loadout?: RuleLike[];
}

export interface Spell {
  id?: string;
  name?: string;
  threshold?: number;
  effect?: string;
}

export interface ArmyBook {
  name?: string;
  versionString?: string;
  version?: string | number;
  spells?: Spell[];
  // Ids das regras citadas pelas magias do livro (ex.: AP, Enhanced Havocbound).
  usedRulesInSpells?: string[];
  // Lista completa de regras do livro, usada para trazer a descrição de regras
  // citadas apenas nas magias quando elas não vêm na lista.
  specialRules?: RuleLike[];
  gameSystemSlug?: string;
}

export interface BookInfo {
  id: string;
  name: string;
  version: string;
}

export interface ArmyPayload {
  gameSystem?: string;
  specialRules?: RuleLike[];
  units?: UnitLike[];
  spells?: Spell[];
  spellRuleIds?: string[];
  [key: string]: unknown;
}

/** Carries an HTTP status so each transport (Express / Netlify) can map it. */
export class RelayError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'RelayError';
    this.status = status;
  }
}

async function fetchCommonRules(gameSystem: string | undefined): Promise<RuleLike[]> {
  const id = gameSystem ? GAME_SYSTEM_IDS[gameSystem.toLowerCase()] : undefined;
  if (id === undefined) return [];

  try {
    const response = await fetch(`${OPR_COMMON_RULES_URL}/${id}`);
    if (!response.ok) return [];
    const data = (await response.json()) as { rules?: RuleLike[] };
    return Array.isArray(data.rules) ? data.rules : [];
  } catch (error) {
    console.error('Failed to fetch common rules:', error);
    return [];
  }
}

function hasCasterRule(rules: RuleLike[] | undefined): boolean {
  if (!Array.isArray(rules)) return false;
  return rules.some((rule) => rule.name === 'Caster' || hasCasterRule(rule.content));
}

function unitHasCaster(unit: UnitLike): boolean {
  return hasCasterRule(unit.rules) || hasCasterRule(unit.loadout);
}

// Busca o livro de cada exército usado na lista (normalmente 1; mais de um se a
// lista misturar livros). Dele saem as magias e o nome/versão do exército.
async function fetchBooks(
  army: ArmyPayload,
): Promise<{ armyId: string; book: ArmyBook }[]> {
  const id = army.gameSystem ? GAME_SYSTEM_IDS[army.gameSystem.toLowerCase()] : undefined;
  if (id === undefined) return [];

  const units = Array.isArray(army.units) ? army.units : [];
  const armyIds = [
    ...new Set(units.map((unit) => unit.armyId).filter((value): value is string => !!value)),
  ];

  const results = await Promise.all(
    armyIds.map(async (armyId) => {
      try {
        const response = await fetch(
          `${OPR_ARMY_BOOKS_URL}/${encodeURIComponent(armyId)}?gameSystem=${id}`,
        );
        if (!response.ok) return null;
        return { armyId, book: (await response.json()) as ArmyBook };
      } catch (error) {
        console.error(`Failed to fetch army book ${armyId}:`, error);
        return null;
      }
    }),
  );

  return results.filter(
    (entry): entry is { armyId: string; book: ArmyBook } => entry !== null,
  );
}

// Magias: só dos livros que têm unidades Conjuradoras (comportamento de antes).
function collectSpells(
  army: ArmyPayload,
  books: { armyId: string; book: ArmyBook }[],
): Spell[] {
  const units = Array.isArray(army.units) ? army.units : [];
  const casterArmyIds = new Set(
    units
      .filter((unit) => unit.armyId && unitHasCaster(unit))
      .map((unit) => unit.armyId as string),
  );

  const seen = new Set<string>();
  const spells: Spell[] = [];
  for (const { armyId, book } of books) {
    if (!casterArmyIds.has(armyId)) continue;
    for (const spell of Array.isArray(book.spells) ? book.spells : []) {
      const key = spell.id ?? spell.name;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      spells.push({
        id: spell.id,
        name: spell.name,
        threshold: spell.threshold,
        effect: spell.effect,
      });
    }
  }
  return spells;
}

// Regras citadas pelas magias: união (sem repetir) dos usedRulesInSpells dos
// livros que têm unidades Conjuradoras — os mesmos livros que alimentam as magias.
function collectSpellRuleIds(
  army: ArmyPayload,
  books: { armyId: string; book: ArmyBook }[],
): string[] {
  const units = Array.isArray(army.units) ? army.units : [];
  const casterArmyIds = new Set(
    units
      .filter((unit) => unit.armyId && unitHasCaster(unit))
      .map((unit) => unit.armyId as string),
  );

  const ids = new Set<string>();
  for (const { armyId, book } of books) {
    if (!casterArmyIds.has(armyId)) continue;
    for (const id of Array.isArray(book.usedRulesInSpells) ? book.usedRulesInSpells : []) {
      if (id) ids.add(id);
    }
  }
  return [...ids];
}

// Garante que as regras citadas nas magias estejam no payload: se alguma id não
// está entre as regras da lista, adiciona a entrada vinda do livro (sem duplicar).
function addSpellRuleEntries(
  payload: ArmyPayload,
  books: { armyId: string; book: ArmyBook }[],
  ids: string[],
): ArmyPayload {
  const specialRules = Array.isArray(payload.specialRules) ? [...payload.specialRules] : [];
  const knownIds = new Set(
    specialRules.map((rule) => rule.id).filter((id): id is string => !!id),
  );
  const bookRules = new Map<string, RuleLike>();
  for (const { book } of books) {
    for (const rule of Array.isArray(book.specialRules) ? book.specialRules : []) {
      if (rule.id && !bookRules.has(rule.id)) bookRules.set(rule.id, rule);
    }
  }
  for (const id of ids) {
    if (knownIds.has(id)) continue;
    const rule = bookRules.get(id);
    if (rule) specialRules.push(rule);
  }
  return { ...payload, specialRules, spellRuleIds: ids };
}

// Nome e versão de cada livro usado, ex.: { name: "Havoc Brothers", version: "3.6.0" }.
function collectBookInfo(books: { armyId: string; book: ArmyBook }[]): BookInfo[] {
  return books
    .map(({ armyId, book }) => ({
      id: armyId,
      name: book.name?.trim() ?? '',
      version: book.versionString ?? (book.version != null ? String(book.version) : ''),
    }))
    .filter((info) => info.name);
}

function mergeRules(army: ArmyPayload, commonRules: RuleLike[]): ArmyPayload {
  const armySpecialRules = Array.isArray(army.specialRules) ? army.specialRules : [];
  const seen = new Set(armySpecialRules.map((rule) => rule.id));

  const merged = [...armySpecialRules];
  for (const rule of commonRules) {
    if (rule.id && !seen.has(rule.id)) {
      seen.add(rule.id);
      merged.push(rule);
    }
  }

  return { ...army, specialRules: merged };
}

/**
 * Load an Army Forge list and enrich it with core rule descriptions and spells.
 * Throws {@link RelayError} (with an HTTP status) on upstream/network failure.
 */
export async function loadArmy(id: string): Promise<ArmyPayload> {
  const trimmed = id.trim();
  if (!trimmed) {
    throw new RelayError(400, 'Missing army id.');
  }

  let ttsResponse: Response;
  try {
    ttsResponse = await fetch(`${OPR_TTS_URL}?id=${encodeURIComponent(trimmed)}`);
  } catch (error) {
    console.error('Failed to load army:', error);
    throw new RelayError(502, 'Could not load this army list.');
  }

  if (!ttsResponse.ok) {
    throw new RelayError(502, `Army Forge returned ${ttsResponse.status}.`);
  }

    const army = (await ttsResponse.json()) as ArmyPayload;
  const [commonRules, books] = await Promise.all([
    fetchCommonRules(army.gameSystem),
    fetchBooks(army),
  ]);

  const payload: ArmyPayload = {
    ...mergeRules(army, commonRules),
    spells: collectSpells(army, books),
    armyBooks: collectBookInfo(books),
     gameSystemSlug: books
      .map(({ book }) => book.gameSystemSlug)
      .find((slug): slug is string => !!slug),
  };

  return addSpellRuleEntries(payload, books, collectSpellRuleIds(army, books));
}
