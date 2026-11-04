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

interface TranslationFile {
  rules: Record<string, RuleTranslation>;
  weapons: Record<string, WeaponTranslation>;
  spells: Record<string, SpellTranslation>;
  items: Record<string, string>;
}

const translations = ptBR as TranslationFile;

// Só traduz quando o idioma atual é pt-BR. Em inglês devolve o original.
function active(): boolean {
  return getLang() === 'pt-BR';
}

function ruleEntry(id: string | undefined): RuleTranslation | undefined {
  if (!active() || !id) return undefined;
  return translations.rules[id];
}

function weaponEntry(weaponId: string | undefined): WeaponTranslation | undefined {
  if (!active() || !weaponId) return undefined;
  return translations.weapons[weaponId];
}

function spellEntry(id: string | undefined): SpellTranslation | undefined {
  if (!active() || !id) return undefined;
  return translations.spells[id];
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
  return translations.items?.[name] || name;
}
