// Coletor de conteúdo do Army Forge para a memória de tradução.
//
// Uso:
//   node scripts/collect-content.mjs --list h-6aOj95jEaW
//   node scripts/collect-content.mjs --army w7qor7b2kuifcyvk --game 3
//   node scripts/collect-content.mjs --list h-6aOj95jEaW --out src/i18n/content.pt-BR.json
//
// O script baixa as regras comuns dos 5 sistemas, as regras/armas/magias do
// livro do exército e grava (ou atualiza) o arquivo de tradução.
//
// Regra de ouro: NUNCA sobrescreve uma tradução já existente. Só adiciona
// entradas novas com texto vazio, para você (ou uma IA) preencher depois.
//
// Chaves usadas no JSON:
//   rules.<id>      -> { name, description }
//   weapons.<weaponId> -> { name }   (weaponId, não o id da unidade!)
//   spells.<id>     -> { name, effect }

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const API = 'https://army-forge.onepagerules.com/api';
const GAME_SYSTEM_IDS = { gf: 2, gff: 3, aof: 4, aofs: 5, aofr: 6 };

function parseArgs(argv) {
  const args = { out: 'src/i18n/content.source.json' };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === '--list') args.list = argv[++i];
    else if (key === '--army') args.army = argv[++i];
    else if (key === '--game') args.game = argv[++i];
    else if (key === '--out') args.out = argv[++i];
  }
  return args;
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} -> HTTP ${response.status}`);
  return response.json();
}

// Percorre qualquer estrutura e devolve todo objeto que tenha `weaponId` e
// `name`. É assim que as armas aparecem aninhadas nos itens/upgrades.
function walkWeapons(node, out) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) walkWeapons(item, out);
    return;
  }
  if (typeof node.weaponId === 'string' && typeof node.name === 'string' && node.name.trim()) {
    // A mesma arma pode aparecer em várias unidades; guarda a primeira grafia.
    if (!out.has(node.weaponId)) out.set(node.weaponId, node.name.trim());
  }
  for (const value of Object.values(node)) walkWeapons(value, out);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.list && !args.army) {
    console.error('Informe --list <id-da-lista> ou --army <armyId> --game <2..6>.');
    process.exit(1);
  }

  let armyId = args.army;
  let gameSystem = args.game ? Number(args.game) : undefined;

  if (args.list) {
    const army = await getJson(`${API}/tts?id=${encodeURIComponent(args.list)}`);
    armyId = armyId || army.units?.[0]?.armyId;
    gameSystem = gameSystem || GAME_SYSTEM_IDS[String(army.gameSystem || '').toLowerCase()];
  }

  if (!armyId || !gameSystem) {
    console.error('Não consegui descobrir o armyId/gameSystem. Use --army e --game.');
    process.exit(1);
  }

  // 1) Regras comuns: os 5 sistemas compartilham os mesmos IDs, então deduplica.
  const rules = new Map();
  for (const systemId of Object.values(GAME_SYSTEM_IDS)) {
    const data = await getJson(`${API}/rules/common/${systemId}`);
    for (const rule of data.rules || []) {
      if (rule.id && rule.name) {
        rules.set(rule.id, { name: rule.name, description: rule.description || '' });
      }
    }
  }

  // 2) Livro do exército: regras próprias, armas e magias.
  const book = await getJson(`${API}/army-books/${encodeURIComponent(armyId)}?gameSystem=${gameSystem}`);

  for (const rule of [...(book.specialRules || []), ...(book.customRules || [])]) {
    if (rule?.id && rule?.name) {
      rules.set(rule.id, { name: rule.name, description: rule.description || '' });
    }
  }

  const weapons = new Map();
  walkWeapons(book.units || [], weapons);
  walkWeapons(book.upgradePackages || [], weapons);
  walkWeapons(book.customWeapons || [], weapons);

  // Itens (upgrades que não são armas), ex.: "Combat Mutations".
  const itemNames = new Set();
  for (const unit of book.units || []) {
    for (const item of unit.loadout || []) {
      if (
        item &&
        typeof item.name === 'string' &&
        item.name.trim() &&
        typeof item.attacks !== 'number' &&
        Array.isArray(item.content) &&
        item.content.length > 0
      ) {
        itemNames.add(item.name.trim());
      }
    }
  }
  for (const pkg of book.upgradePackages || []) {
    for (const section of pkg.sections || []) {
      for (const opt of section.options || []) {
        for (const gain of opt.gains || []) {
          if (gain?.type === 'ArmyBookItem' && gain.name) {
            itemNames.add(gain.name.trim());
          }
        }
      }
    }
  }

  const spells = new Map();
  for (const spell of book.spells || []) {
    if (spell?.id && spell?.name) {
      spells.set(spell.id, { name: spell.name, effect: spell.effect || '' });
    }
  }

  const collected = {
    meta: {
      armyId,
      gameSystem,
      book: book.name || '',
      collectedAt: new Date().toISOString().slice(0, 10),
    },
    rules: Object.fromEntries([...rules.entries()].sort(([a], [b]) => a.localeCompare(b))),
    weapons: Object.fromEntries(
      [...weapons.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([id, name]) => [id, { name }]),
    ),
    spells: Object.fromEntries([...spells.entries()].sort(([a], [b]) => a.localeCompare(b))),
    items: Object.fromEntries([...itemNames].sort().map((name) => [name, name])),
  };

  // 3) Se o arquivo de destino já existe, preserva o que já foi traduzido e só
  // acrescenta as chaves novas com campos vazios.
  const outPath = resolve(args.out);
  let existing = null;
  try {
    existing = JSON.parse(await readFile(outPath, 'utf8'));
  } catch {
    existing = null;
  }

  const merged = { meta: collected.meta, rules: {}, weapons: {}, spells: {}, items: {} };
  for (const section of ['rules', 'weapons', 'spells']) {
    for (const [id, source] of Object.entries(collected[section])) {
      const previous = existing?.[section]?.[id] || {};
      const entry = {};
      for (const field of Object.keys(source)) {
        // Sem arquivo anterior: grava o inglês (serve de referência para traduzir).
        // Com arquivo anterior: preserva a tradução e deixa vazio o que é novo.
        entry[field] = previous[field] ?? (existing ? '' : source[field]);
      }
      merged[section][id] = entry;
    }
  }
  // Itens: chave é o nome em inglês, valor é a tradução (string simples).
  for (const [name, source] of Object.entries(collected.items)) {
    merged.items[name] = existing?.items?.[name] ?? (existing ? '' : source);
  }

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');

  const count = (section) => Object.keys(merged[section]).length;
  console.log(`Livro: ${collected.meta.book} (${armyId}, sistema ${gameSystem})`);
  console.log(`Regras: ${count('rules')} | Armas: ${count('weapons')} | Magias: ${count('spells')} | Itens: ${count('items')}`);
  console.log(`Gravado em ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
