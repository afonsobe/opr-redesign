// Confere o dicionário contra a API atual do Army Forge.
//
// Uso:
//   node scripts/check-content.mjs
//   node scripts/check-content.mjs --system gff
//
// Para cada sistema presente em content.source.json, baixa de novo as regras
// comuns e os livros já coletados, e compara com a referência inglesa:
//   - "mudou":    o texto da API não é mais igual ao da fonte. O site já mostra
//                 o inglês novo; rode o coletor com --refresh-source e retraduza.
//   - "novo":     termo que apareceu na API e ainda não está na fonte.
//   - "removido": termo que estava na fonte e sumiu da API.
// Também lista traduções vazias e entradas sem referência na fonte.
//
// Sai com código 1 quando encontra algo para revisar.

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const API = 'https://army-forge.onepagerules.com/api';
const GAME_SYSTEM_IDS = { gf: 2, gff: 3, aof: 4, aofs: 5, aofr: 6 };

const args = { source: 'src/i18n/content.source.json', out: 'src/i18n/content.pt-BR.json' };
for (let i = 0; i < process.argv.length; i += 1) {
  const key = process.argv[i];
  if (key === '--system') args.system = process.argv[++i];
  else if (key === '--source') args.source = process.argv[++i];
  else if (key === '--out') args.out = process.argv[++i];
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} -> HTTP ${response.status}`);
  return response.json();
}

// Mesma varredura de scripts/collect-content.mjs: qualquer objeto com
// `weaponId` e `name` é uma arma (a chave é o weaponId, não o id da unidade).
function walkWeapons(node, out) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) walkWeapons(item, out);
    return;
  }
  if (typeof node.weaponId === 'string' && typeof node.name === 'string' && node.name.trim()) {
    if (!out.has(node.weaponId)) out.set(node.weaponId, { name: node.name });
  }
  for (const value of Object.values(node)) walkWeapons(value, out);
}

function collectItems(book) {
  const names = new Set();
  for (const unit of book.units || []) {
    // Itens fixos da unidade (ex.: "Shadow Synapses", que concede Caster).
    for (const item of unit.items || []) {
      if (item?.name?.trim()) names.add(item.name);
    }
    for (const item of unit.loadout || []) {
      if (
        item &&
        typeof item.name === 'string' &&
        item.name.trim() &&
        typeof item.attacks !== 'number' &&
        Array.isArray(item.content) &&
        item.content.length > 0
      ) {
        names.add(item.name);
      }
    }
  }
  for (const pkg of book.upgradePackages || []) {
    for (const section of pkg.sections || []) {
      for (const opt of section.options || []) {
        for (const gain of opt.gains || []) {
          if (gain?.type === 'ArmyBookItem' && gain.name) names.add(gain.name);
        }
      }
    }
  }
  return new Map([...names].map((name) => [name, { name }]));
}

async function collectCurrent(gameSystem, armyIds) {
  const rules = new Map();
  const common = await getJson(`${API}/rules/common/${gameSystem}`);
  for (const rule of common.rules || []) {
    if (rule.id && rule.name) {
      rules.set(rule.id, { name: rule.name, description: rule.description || '' });
    }
  }

  const weapons = new Map();
  const spells = new Map();
  const items = new Map();
  for (const armyId of armyIds) {
    const book = await getJson(
      `${API}/army-books/${encodeURIComponent(armyId)}?gameSystem=${gameSystem}`,
    );
    for (const rule of [...(book.specialRules || []), ...(book.customRules || [])]) {
      if (rule?.id && rule?.name) {
        rules.set(rule.id, { name: rule.name, description: rule.description || '' });
      }
    }
    walkWeapons(book.units || [], weapons);
    walkWeapons(book.upgradePackages || [], weapons);
    walkWeapons(book.customWeapons || [], weapons);
    for (const spell of book.spells || []) {
      if (spell?.id && spell?.name) {
        // Mesma chave composta do coletor (nome::efeito).
        const key = `${spell.name.trim()}::${(spell.effect || '').trim()}`;
        spells.set(key, { name: spell.name, effect: spell.effect || '' });
      }
    }
    for (const [name, entry] of collectItems(book)) items.set(name, entry);
  }
  return { rules, weapons, spells, items };
}

const trimmed = (value) => (value ?? '').trim();

function compare(sourceMap, currentMap, fields) {
  const changed = [];
  const missing = [];
  const added = [];

  for (const [key, src] of Object.entries(sourceMap || {})) {
    const cur = currentMap.get(key);
    if (!cur) {
      missing.push({ key, name: src.name });
      continue;
    }
    const diff = fields.filter((field) => trimmed(src[field]) !== trimmed(cur[field]));
    if (diff.length > 0) changed.push({ key, name: src.name || cur.name, fields: diff });
  }

  for (const [key, cur] of currentMap) {
    if (sourceMap?.[key] === undefined) added.push({ key, name: cur.name });
  }

  return { changed, missing, added };
}

function list(label, entries, describe) {
  if (entries.length === 0) return;
  console.log(`  ${label}: ${entries.length}`);
  for (const entry of entries) console.log(`    - ${describe(entry)}`);
}

function translationState(ptSection, sourceSection, fields) {
  let empty = 0;
  let orphan = 0;
  for (const [key, entry] of Object.entries(ptSection || {})) {
    if (!sourceSection?.[key]) orphan += 1;
    const filled =
      typeof entry === 'string'
        ? entry.trim() !== ''
        : fields.some((field) => trimmed(entry[field]) !== '');
    if (!filled) empty += 1;
  }
  return { empty, orphan };
}

async function main() {
  const sourceFile = JSON.parse(await readFile(resolve(args.source), 'utf8'));
  const outFile = JSON.parse(await readFile(resolve(args.out), 'utf8'));
  const systems = sourceFile.systems || {};
  const slugs = Object.keys(systems).filter(
    (slug) => !args.system || slug === args.system,
  );

  if (slugs.length === 0) {
    console.log('Nenhum sistema para conferir em content.source.json.');
    return 0;
  }

  let issues = 0;
  for (const slug of slugs) {
    const source = systems[slug];
    const gameSystem = source.meta?.gameSystem ?? GAME_SYSTEM_IDS[slug];
    const armyIds = Array.isArray(source.meta?.collections)
      ? source.meta.collections.map((entry) => entry.armyId).filter(Boolean)
      : [source.meta?.armyId].filter(Boolean);

    console.log(`\nSistema ${slug} (id ${gameSystem})`);
    if (armyIds.length === 0) {
      console.log('  Sem livros registrados na fonte; nada para comparar.');
      continue;
    }

    const current = await collectCurrent(gameSystem, armyIds);
    const pt = outFile.systems?.[slug] || { rules: {}, weapons: {}, spells: {}, items: {} };

    const sections = [
      ['Regras', source.rules, current.rules, ['name', 'description'], ['name', 'description']],
      ['Armas', source.weapons, current.weapons, ['name'], ['name']],
      ['Magias', source.spells, current.spells, ['name', 'effect'], ['name', 'effect']],
      ['Itens', source.items, current.items, [], []],
    ];

    for (const [label, sourceMap, currentMap, fields, ptFields] of sections) {
      const result = compare(sourceMap, currentMap, fields);
      const state = translationState(pt[mapKey(label)], sourceMap, ptFields);
      list(`${label} com texto novo na API`, result.changed, (entry) =>
        `${entry.name} (${entry.key}): ${entry.fields.join(', ')}`,
      );
      list(`${label} novas na API`, result.added, (entry) => `${entry.name} (${entry.key})`);
      list(`${label} removidas da API`, result.missing, (entry) => `${entry.name} (${entry.key})`);
      if (state.empty > 0) console.log(`  ${label} sem tradução: ${state.empty}`);
      if (state.orphan > 0) console.log(`  ${label} traduzidas sem fonte: ${state.orphan}`);
      issues += result.changed.length + result.added.length + result.missing.length;
    }
  }

  console.log(
    issues === 0
      ? '\nTudo em dia: a fonte bate com a API e as traduções continuam válidas.'
      : `\n${issues} termo(s) precisam de atenção. Rode o coletor com --refresh-source após revisar.`,
  );
  return issues === 0 ? 0 : 1;
}

// "Regras" -> "rules" etc. (as chaves do JSON são em inglês).
function mapKey(label) {
  return { Regras: 'rules', Armas: 'weapons', Magias: 'spells', Itens: 'items' }[label];
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
