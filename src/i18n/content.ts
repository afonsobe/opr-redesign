// Tradução do CONTEÚDO vindo do Army Forge (regras, armas e magias).
//
// Por que separado de src/i18n.ts:
//   - i18n.ts traduz textos fixos da interface, com chaves escritas à mão.
//   - aqui a chave é o `id` que o Army Forge manda, e o texto muda quando o
//     OPR lança uma versão nova do livro. São milhares de strings.
//
// Regra de ouro: a tradução acontece SÓ na hora de desenhar na tela. Os dados
// originais continuam em inglês no objeto `army`, porque várias lógicas do
// render dependem dos nomes em inglês (ex.: achar a regra "Tough", ligar uma
// regra citada dentro da descrição de outra, juntar armas iguais). Traduzir os
// dados antes dessas comparações quebraria tudo.
//
// Segurança contra texto defasado: cada tradução só é usada quando o texto que
// o Army Forge manda AGORA é igual (ignorando espaços nas pontas) ao texto
// inglês registrado em content.source.json. Se a OPR mudar um texto, o site
// mostra a tradução do dicionário com um † no final e explica o símbolo logo
// abaixo do título da tabela. O fluxo para retraduzir está documentado em
// scripts/collect-content.mjs (`--refresh-source`).
//
// Se um id ainda não tem tradução, cai no texto original em inglês. Nunca
// aparece vazio e nada quebra.

import { getLang } from '../i18n';
import ptBR from './content.pt-BR.json';
import sourceEn from './content.source.json';
import aliasesJson from './content.aliases.json';

interface RuleTranslation {
  name?: string;
  description?: string;
}

interface WeaponTranslation {
  name?: string;
}

interface SpellTranslation {
  name?: string;
  effect?: string;
}

interface TranslationSection {
  rules: Record<string, RuleTranslation>;
  weapons: Record<string, WeaponTranslation>;
  spells: Record<string, SpellTranslation>;
  items: Record<string, string>;
  meta?: { gameSystem?: number; system?: string };
}

interface TranslationFile {
  // New format: per-system sections to avoid mixing GF/GFF/AoF texts.
  // Legacy flat files (without `systems`) are treated as system-agnostic.
  systems?: Record<string, TranslationSection & { gameSystem?: number; system?: string }>;
  meta?: { gameSystem?: number; system?: string };
  // Legacy flat sections (kept only for backward compatibility).
  rules?: Record<string, RuleTranslation>;
  weapons?: Record<string, WeaponTranslation>;
  spells?: Record<string, SpellTranslation>;
  items?: Record<string, string>;
}

// Game-system code mapping that the Army Forge backend uses.
// Kept in sync with scripts/collect-content.mjs GAME_SYSTEM_IDS.
export const GAME_SYSTEM_IDS: Record<string, number> = {
  gf: 2,
  gff: 3,
  aof: 4,
  aofs: 5,
  aofr: 6,
  gfwf: 11,
};
export const GAME_SYSTEM_SLUGS: Record<number, string> = {
  2: 'gf',
  3: 'gff',
  4: 'aof',
  5: 'aofs',
  6: 'aofr',
  11: 'gfwf',
};

type LangSystemKey = 'gff' | 'gf' | 'aof' | 'aofs' | 'aofr' | 'gfwf';

const translations = ptBR as TranslationFile;
const source = sourceEn as unknown as TranslationSection;

function sourceSection(): TranslationSection {
  const file = source as TranslationFile;
  if (file.systems) {
    const key = activeSystem ?? file.meta?.system ??
      (file.meta?.gameSystem ? GAME_SYSTEM_SLUGS[file.meta.gameSystem] : undefined);
    return (key && file.systems[key]) || { rules: {}, weapons: {}, spells: {}, items: {} };
  }
  return source;
}

const EMPTY_SECTION: TranslationSection = { rules: {}, weapons: {}, spells: {}, items: {} };

// Registry of which system the current army list belongs to.
// Set by the app when a list loads (see index.ts). Falls back to the
// file's meta.gameSystem for the initial load.
let activeSystem: LangSystemKey | null = null;

export function setActiveSystem(gameSystem: string | number | undefined | null): void {
  if (typeof gameSystem === 'number') {
    const slug = GAME_SYSTEM_SLUGS[gameSystem];
    activeSystem = (slug as LangSystemKey) ?? null;
    return;
  }
  if (typeof gameSystem === 'string') {
    const lower = gameSystem.trim().toLowerCase();
    // Warfleets precisa vir antes de 'gf': "grimdark-future-warfleets2"
    // contém "grimdark-future" e seria classificada como GF.
    if (lower === 'ftl' || lower.includes('gfwf') || lower.includes('warfleet') || lower.includes('fleet')) activeSystem = 'gfwf';
    else if (lower.includes('gff') || lower.includes('firefight')) activeSystem = 'gff';
    else if (lower.includes('aofs') || lower.includes('skirmish')) activeSystem = 'aofs';
    else if (lower.includes('aofr') || lower.includes('regiment')) activeSystem = 'aofr';
    else if (lower.includes('aof') || lower.includes('age-of-fantasy')) activeSystem = 'aof';
    else if (lower.includes('gf') || lower.includes('grimdark-future')) activeSystem = 'gf';
    else activeSystem = null;
  }
}

export function getActiveSystem(): LangSystemKey | null {
  return activeSystem;
}

function resolveSection(): TranslationSection {
  // Per-system file: pick the section for the active system first.
  if (translations.systems) {
    const key: string | null =
      activeSystem ??
      ((translations.meta?.system as string | undefined) ?? null) ??
      (translations.meta?.gameSystem ? (GAME_SYSTEM_SLUGS[translations.meta.gameSystem] ?? null) : null);
    if (key && translations.systems[key]) return translations.systems[key];
    // No section for THIS system: never mix another system's texts.
    // Return an empty section so callers fall back to the English original.
    return EMPTY_SECTION;
  }
  // Legacy flat file.
  return {
    rules: translations.rules ?? {},
    weapons: translations.weapons ?? {},
    spells: translations.spells ?? {},
    items: translations.items ?? {},
  };
}

// Só traduz quando o idioma atual é pt-BR. Em inglês devolve o original.
function active(): boolean {
  return getLang() === 'pt-BR';
}

// Comparação ignora apenas espaços nas pontas. Qualquer outra diferença
// (palavra, pontuação, acento) marca a tradução como desatualizada: o site
// mostra a tradução do dicionário com um † no final (o símbolo é explicado
// logo abaixo do título de cada tabela).
// Exceção: o relay reescreve "this weapon" -> "this weapon/spell" nas regras
// citadas por magias (igual ao Army Forge), então as duas formas contam
// como o mesmo texto para fins de trava.
function norm(value: string | undefined | null): string {
  return (value ?? '').trim().replace(/\bthis weapon\/spell\b/g, 'this weapon');
}

// Símbolo de nota de rodapé usado quando o texto atual da API não bate com a
// fonte. É o † clássico das notas de rodapé (menos poluído que um asterísco).
export const STALE_MARK = '†';

function markStale(text: string): string {
  return text.endsWith(STALE_MARK) ? text : text + STALE_MARK;
}

function stripStale(text: string): string {
  return text.endsWith(STALE_MARK) ? text.slice(0, -STALE_MARK.length) : text;
}

/** true quando o texto exibido é uma tradução desatualizada (termina em †). */
export function isStaleText(text: string | undefined | null): boolean {
  return (text ?? '').endsWith(STALE_MARK);
}

// Texto vazio ou igual ao próprio nome é placeholder do Army Forge
// (ex.: a instância ranqueada de AP vem com description = "AP").
function isPlaceholder(value: string | undefined, name: string | undefined): boolean {
  const text = norm(value);
  return text === '' || text === norm(name);
}

interface RuleMatch {
  translated: RuleTranslation;
  source: RuleTranslation;
  /** true quando o nome inglês mudou na API (tradução desatualizada). */
  stale?: boolean;
}

// Índice nome (inglês) -> entrada da fonte. Quando duas regras têm o mesmo
// nome, prefere a que tem descrição de verdade (a versão genérica da regra).
let sourceByNameCache: {
  section: TranslationSection;
  map: Map<string, { id: string; entry: RuleTranslation }>;
} | null = null;

function sourceByName(name: string):
  | { id: string; entry: RuleTranslation }
  | undefined {
  const section = sourceSection();
  if (sourceByNameCache?.section !== section) {
    const map = new Map<string, { id: string; entry: RuleTranslation }>();
    for (const [id, entry] of Object.entries(section.rules)) {
      const label = norm(entry.name);
      if (!label) continue;
      const current = map.get(label);
      if (
        !current ||
        (isPlaceholder(current.entry.description, current.entry.name) &&
          !isPlaceholder(entry.description, entry.name))
      ) {
        map.set(label, { id, entry });
      }
    }
    sourceByNameCache = { section, map };
  }
  return sourceByNameCache.map.get(norm(name));
}

// Regras do livro no idioma-fonte (inglês), usadas como reserva quando o Army
// Forge não manda uma regra citada em `army.specialRules` (ex.: Twin-Fire e
// Deadly nas listas de Warfleets). A tradução continua sendo aplicada pelos
// helpers normais (`trRuleName`, `trRuleDescription`).
export interface SourceRuleEntry {
  id: string;
  name: string;
  description: string;
}

function sourceRuleDescription(entry: RuleTranslation): string {
  const description = (entry.description ?? '').trim();
  const name = (entry.name ?? '').trim();
  if (description && description !== name) return description;
  const generic = name ? sourceByName(name) : undefined;
  if (!generic || generic.entry === entry) return description;
  return (generic.entry.description ?? '').trim();
}

export function listSourceRules(): SourceRuleEntry[] {
  return Object.entries(sourceSection().rules)
    .map(([id, entry]) => ({
      id,
      name: (entry.name ?? '').trim(),
      description: sourceRuleDescription(entry),
    }))
    .filter((entry) => entry.name);
}

export function findSourceRuleByName(name: string): SourceRuleEntry | undefined {
  const hit = sourceByName(name);
  if (!hit) return undefined;
  return {
    id: hit.id,
    name: (hit.entry.name ?? '').trim(),
    description: sourceRuleDescription(hit.entry),
  };
}

// Devolve a tradução quando há entrada no dicionário. Quando o texto inglês
// atual não bate com a fonte, a entrada vem marcada como desatualizada.
function ruleMatch(rule: { id?: string; name?: string }): RuleMatch | undefined {
  if (!active()) return undefined;
  const label = norm(rule.name);
  const sourceRules = sourceSection().rules;
  const translatedRules = resolveSection().rules;

  if (rule.id) {
    const src = sourceRules[rule.id];
    const translated = translatedRules[rule.id];
    if (src && translated?.name) {
      const stale = !!label && norm(src.name) !== label;
      return { translated, source: src, stale };
    }
  }

  if (!label) return undefined;
  // Fallback por nome (regras que o Army Forge manda sem id). A chave do
  // índice já é o nome inglês, então a igualdade do nome está garantida.
  const hit = sourceByName(label);
  if (!hit) return undefined;
  const translated = translatedRules[hit.id];
  return translated?.name ? { translated, source: hit.entry } : undefined;
}

// Texto inglês ao qual a descrição de uma entrada corresponde. Quando a fonte
// guarda só o placeholder (ex.: "AP"), usa a descrição da versão genérica.
function sourceDescription(entry: RuleTranslation): string {
  if (!isPlaceholder(entry.description, entry.name)) return norm(entry.description);
  const generic = entry.name ? sourceByName(entry.name) : undefined;
  if (!generic) return '';
  return isPlaceholder(generic.entry.description, generic.entry.name)
    ? ''
    : norm(generic.entry.description);
}

function ruleEntry(rule: { id?: string; name?: string }): RuleTranslation | undefined {
  const match = ruleMatch(rule);
  if (!match?.translated?.name) return undefined;
  if (match.stale) return { ...match.translated, name: markStale(match.translated.name) };
  return match.translated;
}

function ruleDescriptionTranslation(rule: {
  id?: string;
  name?: string;
  description?: string;
  __fallbackDesc?: string;
}): string | undefined {
  if (!active()) return undefined;
  const label = norm(rule.name);

  const candidates: RuleMatch[] = [];
  const match = ruleMatch(rule);
  if (match) candidates.push(match);

  // Entrada genérica com o mesmo nome (ex.: AP sem rating), usada quando a
  // instância ranqueada só traz o nome como descrição.
  if (label) {
    const generic = sourceByName(label);
    if (generic) {
      const translated = resolveSection().rules[generic.id];
      if (translated?.name) candidates.push({ translated, source: generic.entry });
    }
  }

  // Texto inglês que a tradução substituiria: a descrição atual ou, quando ela
  // é só o nome, a descrição genérica que o render usa como fallback.
  const english = isPlaceholder(rule.description, label)
    ? norm(rule.__fallbackDesc)
    : norm(rule.description);
  if (!english) return undefined;

  for (const candidate of candidates) {
    const translated = candidate.translated.description;
    if (!translated || isPlaceholder(translated, candidate.translated.name)) continue;
    const original = sourceDescription(candidate.source);
    if (original && original === english) return translated;
  }
  // Texto inglês mudou na API: mostra a tradução do dicionário marcada como
  // desatualizada em vez do inglês novo.
  for (const candidate of candidates) {
    const translated = candidate.translated.description;
    if (!translated || isPlaceholder(translated, candidate.translated.name)) continue;
    return markStale(translated);
  }
  return undefined;
}

// Exceções pontuais (content.aliases.json): nome alternativo EXATO que o Army
// Forge manda para a mesma arma, com a tradução a usar. Ex.: o Security Forces
// manda "Shock Weapons" (plural) para o weaponId de "Shock Weapon".
type AliasFile = Record<string, { weapons?: Record<string, Record<string, string>> } | undefined>;
const aliases = aliasesJson as unknown as AliasFile;

function activeSystemKey(): string | null {
  return (
    activeSystem ??
    ((translations.meta?.system as string | undefined) ?? null) ??
    (translations.meta?.gameSystem ? (GAME_SYSTEM_SLUGS[translations.meta.gameSystem] ?? null) : null)
  );
}

function weaponAlias(weaponId: string, apiName: string | undefined): string | undefined {
  const key = activeSystemKey();
  if (!key) return undefined;
  return aliases[key]?.weapons?.[weaponId]?.[norm(apiName)];
}

function weaponEntry(weapon: {
  weaponId?: string;
  id?: string;
  name?: string;
}): WeaponTranslation | undefined {
  if (!active()) return undefined;
  const key = weapon.weaponId || weapon.id;
  if (!key) return undefined;
  const src = sourceSection().weapons[key];
  const translated = resolveSection().weapons[key];
  if (!src || !translated?.name) return undefined;
  // Nome da arma mudou no Army Forge: mostra a tradução do dicionário marcada
  // como desatualizada, a menos que seja uma exceção explícita registrada em
  // content.aliases.json.
  if (norm(weapon.name) !== norm(src.name)) {
    const alias = weaponAlias(key, weapon.name);
    return alias ? { ...translated, name: alias } : { ...translated, name: markStale(translated.name) };
  }
  return translated;
}

type SpellField = 'name' | 'effect';

// Nome (inglês) -> tradução única, para quando o efeito da API mudou mas o nome
// continua igual a uma magia da fonte. Só vale se todas as variantes daquele
// nome têm a mesma tradução (a trava é por campo: nome e efeito separados).
let spellNameCache: {
  source: TranslationSection;
  translated: TranslationSection;
  map: Map<string, string | null>;
} | null = null;

function unanimousSpellName(name: string): string | undefined {
  const source = sourceSection();
  const translated = resolveSection();
  if (spellNameCache?.source !== source || spellNameCache?.translated !== translated) {
    const map = new Map<string, string | null>();
    for (const [key, src] of Object.entries(source.spells)) {
      const label = norm(src.name);
      const pt = translated.spells[key]?.name;
      if (!label || !pt) continue;
      const current = map.get(label);
      if (current === undefined) map.set(label, pt);
      else if (current !== pt) map.set(label, null);
    }
    spellNameCache = { source, translated, map };
  }
  return spellNameCache.map.get(norm(name)) ?? undefined;
}

// Primeira variante com este nome inglês (para efeito desatualizado).
function firstSpellByName(name: string): SpellTranslation | undefined {
  const source = sourceSection();
  const translated = resolveSection();
  for (const [key, src] of Object.entries(source.spells)) {
    if (norm(src.name) === norm(name) && translated.spells[key]) return translated.spells[key];
  }
  return undefined;
}

// Nome pt quando o efeito inglês bate com exatamente uma tradução.
// Usado quando o nome mudou na API mas o efeito continua igual.
function spellNameByEffect(effect: string | undefined): string | undefined {
  const target = norm(effect);
  if (!target) return undefined;
  const source = sourceSection();
  const translated = resolveSection();
  const names = new Set<string>();
  for (const [key, src] of Object.entries(source.spells)) {
    if (norm(src.effect) === target) {
      const pt = translated.spells[key]?.name;
      if (pt) names.add(pt);
    }
  }
  return names.size === 1 ? [...names][0] : undefined;
}

function spellEntry(
  spell: { id?: string; name?: string; effect?: string },
  field: SpellField,
): SpellTranslation | undefined {
  // A chave é "nome::efeito" (em inglês): o Army Forge reutiliza o mesmo id de
  // magia em livros diferentes e o mesmo nome pode ter efeitos diferentes
  // (ex.: "Electric Tempest"). Cada variante tem a sua própria tradução.
  if (!active() || !spell.name) return undefined;
  const key = norm(spell.name) + '::' + norm(spell.effect);
  const src = sourceSection().spells[key];
  const translated = resolveSection().spells[key];
  if (src && translated?.name && norm(spell.name) === norm(src.name)) {
    if (field === 'name') return translated;
    return norm(spell.effect) === norm(src.effect) ? translated : undefined;
  }
  if (field === 'name') {
    // Nome igual (efeito inédito): continua traduzido, sem aviso.
    const name = unanimousSpellName(spell.name);
    if (name) return { name };
    // Nome mudou mas o efeito continua igual: mostra a tradução com aviso.
    const byEffect = spellNameByEffect(spell.effect);
    return byEffect ? { name: markStale(byEffect) } : undefined;
  }
  // Efeito mudou (nome igual): mostra a tradução do dicionário com aviso.
  const first = firstSpellByName(spell.name);
  if (first?.effect) return { name: first.name, effect: markStale(first.effect) };
  return undefined;
}

/** Nome traduzido de uma regra (unidade ou regra especial de arma). */
export function trRuleName(rule: { id?: string; name?: string }): string {
  return ruleEntry(rule)?.name || rule.name || '';
}

/**
 * Nome traduzido seguido do termo original em inglês entre parênteses.
 * Só acrescenta o original quando houver tradução e ela for diferente.
 * Ex.: "Mortal (Deadly)", "Explosão (Blast)".
 * Quando a tradução está desatualizada, o † vem no final:
 * "Mortal (Deadly)†".
 */
export function trRuleNameWithOriginal(rule: { id?: string; name?: string }): string {
  const entry = ruleEntry(rule);
  const translated = entry?.name || rule.name || '';
  const base = stripStale(translated);
  const stale = translated.endsWith(STALE_MARK);
  if (
    !entry?.name ||
    base === (rule.name || '') ||
    /\([^)]*\)/.test(base)
  ) {
    return translated;
  }
  return stale ? `${base} (${rule.name})${STALE_MARK}` : `${base} (${rule.name})`;
}

/**
 * Rótulo da regra, incluindo o valor entre parênteses.
 * Usado nas cartas (pílulas) e na coluna "Regras especiais" das armas.
 * O termo original em inglês NÃO é acrescentado aqui: aparece apenas nas
 * tabelas de regras especiais e de magias (ver render.ts).
 * "Fear(2)" -> "Medo(2)", "AP(1)" -> "PA(1)".
 * O label original é preservado quando não há tradução.
 */
export function trRuleLabel(rule: {
  id?: string;
  name?: string;
  label?: string;
  rating?: number;
}): string {
  const entry = ruleEntry(rule);
  // Sem tradução: reconstruir do nome em inglês + rating, para nunca perder
  // o valor (ex.: Deadly com rating 2 => "Deadly(2)", como no Army Forge).
  if (!entry?.name) {
    if (rule.rating != null) {
      const englishName = rule.name?.trim() || rule.label?.trim() || '';
      if (englishName.endsWith(`(${rule.rating})`)) return englishName;
      if (!englishName) return rule.label || '';
      return `${englishName}(${rule.rating})`;
    }
    return rule.label || rule.name || '';
  }
  // Com tradução: aplicar o rating sobre o nome traduzido; nunca descartar.
  const stale = entry.name.endsWith(STALE_MARK);
  const clean = stripStale(entry.name);
  const rated = rule.rating != null ? `${clean}(${rule.rating})` : clean;
  return stale ? markStale(rated) : rated;
}

/** Descrição traduzida de uma regra. */
export function trRuleDescription(rule: {
  id?: string;
  name?: string;
  description?: string;
  __fallbackDesc?: string;
}): string {
  // Em inglês: nunca traduz. Se a descrição do Army Forge é só o nome
  // (ex. CQes0mDvF4bV AP desc='AP'), o chamador (render.ts) já aplica
  // o fallback genérico via __fallbackDesc. Aqui devolvemos o original.
  if (!active()) {
    return rule.description || '';
  }
  return ruleDescriptionTranslation(rule) || rule.description || '';
}

/**
 * Nome traduzido de uma arma.
 * Atenção: a chave é o `weaponId` (a arma em si), e NÃO o `id` (a instância
 * daquela arma dentro de uma unidade). O mesmo "Claws" aparece com vários
 * `id` diferentes, mas com um `weaponId` só.
 */
export function trWeaponName(weapon: {
  weaponId?: string;
  id?: string;
  name?: string;
}): string {
  return weaponEntry(weapon)?.name || weapon.name || '';
}

/** Nome traduzido de uma magia. */
export function trSpellName(spell: { id?: string; name?: string; effect?: string }): string {
  return spellEntry(spell, 'name')?.name || spell.name || '';
}

/**
 * Nome traduzido da magia seguido do termo original em inglês.
 * Ex.: "Explosão Psíquica (Psychic Blast)".
 * Quando desatualizada, o † vem no final:
 * "Explosão Psíquica (Psychic Blast)†".
 */
export function trSpellNameWithOriginal(spell: { id?: string; name?: string; effect?: string }): string {
  const entry = spellEntry(spell, 'name');
  const translated = entry?.name || spell.name || '';
  const base = stripStale(translated);
  const stale = translated.endsWith(STALE_MARK);
  if (!entry?.name || base === (spell.name || '')) return translated;
  return stale ? `${base} (${spell.name})${STALE_MARK}` : `${base} (${spell.name})`;
}

/** Efeito traduzido de uma magia. */
export function trSpellEffect(spell: { id?: string; name?: string; effect?: string }): string {
  return spellEntry(spell, 'effect')?.effect || spell.effect || '';
}

/**
 * Nome de uma regra concedida por upgrade (ex.: "1x Sergeant").
 * O ganho traz o id da regra, então usa a mesma memória de tradução.
 */
export function trRuleGainName(gain: { id?: string; name?: string; label?: string }): string {
  const entry = ruleEntry({ id: gain.id, name: gain.name || gain.label });
  if (entry?.name) return entry.name;
  return gain.name || gain.label || '';
}

/**
 * Nome traduzido de um item/upgrade (ex.: "Combat Mutations" -> "Mutações de Combate").
 * A chave é o próprio nome em inglês (itens não têm id estável).
 */
export function trItemName(name: string | undefined): string {
  if (!active() || !name) return name || '';
  // A chave é o nome inglês: só traduz se ele ainda existir na fonte.
  if (sourceSection().items?.[name] === undefined) return name;
  return resolveSection().items?.[name] || name;
}
