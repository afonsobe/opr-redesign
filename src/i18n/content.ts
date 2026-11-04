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
// Se um id ainda não tem tradução, cai no texto original em inglês. Nunca
// aparece vazio e nada quebra.

import { getLang } from '../i18n';
import ptBR from './content.pt-BR.json';

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

interface TranslationFile extends TranslationSection {
  // New format: per-system sections to avoid mixing GF/GFF/AoF texts.
  // Legacy flat files (without `systems`) are treated as system-agnostic.
  systems?: Record<string, TranslationSection & { gameSystem?: number; system?: string }>;
  meta?: { gameSystem?: number; system?: string };
}

// Game-system code mapping that the Army Forge backend uses.
// Kept in sync with scripts/collect-content.mjs GAME_SYSTEM_IDS.
export const GAME_SYSTEM_IDS: Record<string, number> = {
  gf: 2,
  gff: 3,
  aof: 4,
  aofs: 5,
  aofr: 6,
};
export const GAME_SYSTEM_SLUGS: Record<number, string> = {
  2: 'gf',
  3: 'gff',
  4: 'aof',
  5: 'aofs',
  6: 'aofr',
};

type LangSystemKey = 'gff' | 'gf' | 'aof' | 'aofs' | 'aofr';

const translations = ptBR as TranslationFile;

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
    // Accept "grimdark-future", "grimdark-future-firefight", "age-of-fantasy", etc.
    if (lower.includes('gff') || lower.includes('firefight')) activeSystem = 'gff';
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
    // No matching section: fall back to any available section rather than mixing.
    const first = Object.values(translations.systems)[0];
    if (first) return first;
  }
  // Legacy flat file.
  return translations;
}

// Só traduz quando o idioma atual é pt-BR. Em inglês devolve o original.
function active(): boolean {
  return getLang() === 'pt-BR';
}

function ruleEntry(id: string | undefined): RuleTranslation | undefined {
  if (!active() || !id) return undefined;
  return resolveSection().rules[id];
}

function weaponEntry(weaponId: string | undefined): WeaponTranslation | undefined {
  if (!active() || !weaponId) return undefined;
  return resolveSection().weapons[weaponId];
}

function spellEntry(id: string | undefined): SpellTranslation | undefined {
  if (!active() || !id) return undefined;
  return resolveSection().spells[id];
}

/** Nome traduzido de uma regra (unidade ou regra especial de arma). */
export function trRuleName(rule: { id?: string; name?: string }): string {
  return ruleEntry(rule.id)?.name || rule.name || '';
}

/**
 * Nome traduzido seguido do termo original em inglês entre parênteses.
 * Só acrescenta o original quando houver tradução e ela for diferente.
 * Ex.: "Mortal (Deadly)", "Explosão (Blast)".
 */
export function trRuleNameWithOriginal(rule: { id?: string; name?: string }): string {
  const entry = ruleEntry(rule.id);
  const translated = entry?.name || rule.name || '';
  if (!entry?.name || entry.name === (rule.name || '')) return translated;
  return `${entry.name} (${rule.name})`;
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
  const entry = ruleEntry(rule.id);
  if (!entry?.name) return rule.label || rule.name || '';
  return rule.rating != null ? `${entry.name}(${rule.rating})` : entry.name;
}

/** Descrição traduzida de uma regra. */
export function trRuleDescription(rule: { id?: string; description?: string }): string {
  return ruleEntry(rule.id)?.description || rule.description || '';
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
  const key = weapon.weaponId || weapon.id;
  return weaponEntry(key)?.name || weapon.name || '';
}

/** Nome traduzido de uma magia. */
export function trSpellName(spell: { id?: string; name?: string }): string {
  return spellEntry(spell.id)?.name || spell.name || '';
}

/**
 * Nome traduzido da magia seguido do termo original em inglês.
 * Ex.: "Explosão Psíquica (Psychic Blast)".
 */
export function trSpellNameWithOriginal(spell: { id?: string; name?: string }): string {
  const entry = spellEntry(spell.id);
  const translated = entry?.name || spell.name || '';
  if (!entry?.name || entry.name === (spell.name || '')) return translated;
  return `${entry.name} (${spell.name})`;
}

/** Efeito traduzido de uma magia. */
export function trSpellEffect(spell: { id?: string; effect?: string }): string {
  return spellEntry(spell.id)?.effect || spell.effect || '';
}

/**
 * Nome de uma regra concedida por upgrade (ex.: "1x Sergeant").
 * O ganho traz o id da regra, então usa a mesma memória de tradução.
 */
export function trRuleGainName(gain: { id?: string; name?: string; label?: string }): string {
  const entry = ruleEntry(gain.id);
  if (entry?.name) return entry.name;
  return gain.name || gain.label || '';
}

/**
 * Nome traduzido de um item/upgrade (ex.: "Combat Mutations" -> "Mutações de Combate").
 * A chave é o próprio nome em inglês (itens não têm id estável).
 */
export function trItemName(name: string | undefined): string {
  if (!active() || !name) return name || '';
  return resolveSection().items?.[name] || name;
}
