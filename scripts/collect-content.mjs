// Coletor de conteúdo do Army Forge para a memória de tradução.
//
// Uso:
//   node scripts/collect-content.mjs --list h-6aOj95jEaW
//   node scripts/collect-content.mjs --army w7qor7b2kuifcyvk --game 3
//   node scripts/collect-content.mjs --url "https://army-forge.onepagerules.com/army-info/grimdark-future-firefight/w7qor7b2kuifcyvk?armyName=Alien+Hives"
//   node scripts/collect-content.mjs --urls-file urls.txt
//   node scripts/collect-content.mjs --list h-6aOj95jEaW --refresh-source
//   node scripts/collect-content.mjs --all                       # todos os livros já registrados
//   node scripts/collect-content.mjs --all --system gfwf         # só um sistema
//   node scripts/collect-content.mjs --all --refresh-source      # aceita o inglês novo da API
//
// `--url` pode ser repetido e `--urls-file` lê uma URL por linha (ignora
// linhas vazias e começadas por #). Todos os livros são coletados numa
// passada só, separados por sistema.
//
// Aceita a URL da página "army info" do Army Forge (--url) e descobre sozinho
// o sistema e o armyId. A página é alimentada pelas mesmas APIs públicas que
// este script usa, então não é preciso baixar/subir PDF nenhum.
//
// O script captura o texto inglês do sistema e dos livros escolhidos em
// content.source.json, e atualiza a seção correspondente em content.pt-BR.json.
//
// Regra de ouro: NUNCA sobrescreve uma tradução já existente. Só adiciona
// entradas novas com texto vazio, para você (ou uma IA) preencher depois.
//
// `content.source.json` é a referência do texto inglês usado nas traduções.
// Por padrão ele também NÃO é sobrescrito: se a OPR mudar uma regra, a fonte
// continua com o texto antigo e o site passa a mostrar o inglês novo (ver
// src/i18n/content.ts). Depois de revisar a mudança, rode com
// `--refresh-source` para atualizar a referência e retraduzir os textos
// marcados por `npm run i18n:check`.
//
// Chaves usadas no JSON:
//   rules.<id>      -> { name, description }
//   weapons.<weaponId> -> { name }   (weaponId, não o id da unidade!)
//   spells.<id>     -> { name, effect }

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const API = 'https://army-forge.onepagerules.com/api';
const GAME_SYSTEM_IDS = { gf: 2, gff: 3, aof: 4, aofs: 5, aofr: 6, gfwf: 11 };

// Slugs usados nas URLs do site (army-info, listas, etc.).
const SYSTEM_SLUGS = {
  'grimdark-future': 2,
  'grimdark-future-firefight': 3,
  'age-of-fantasy': 4,
  'age-of-fantasy-skirmish': 5,
  'age-of-fantasy-regiments': 6,
  'grimdark-future-warfleets2': 11,
  'grimdark-future-warfleets': 11,
  gf: 2,
  gff: 3,
  aof: 4,
  aofs: 5,
  aofr: 6,
  gfwf: 11,
};

// Ex.: .../army-info/grimdark-future-firefight/w7qor7b2kuifcyvk?armyName=Alien+Hives
// Frotas (Warfleets): .../fleet-info/grimdark-future-warfleets2/<fleetId>?armyName=...
function parseArmyUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`URL inválida: ${value}`);
  }
  const match = url.pathname.match(/\/(army-info|fleet-info)\/([^/]+)\/([^/]+)/i);
  if (!match) {
    throw new Error('A URL precisa ser de uma página /army-info/<sistema>/<armyId> ou /fleet-info/<sistema>/<fleetId>.');
  }
  const isFleet = match[1].toLowerCase() === 'fleet-info';
  const slug = decodeURIComponent(match[2]).toLowerCase();
  const gameSystem = SYSTEM_SLUGS[slug];
  if (!gameSystem) {
    throw new Error(`Sistema desconhecido na URL: ${slug}`);
  }
  return { armyId: decodeURIComponent(match[3]), gameSystem, fleet: isFleet };
}

function parseArgs(argv) {
  const args = { out: 'src/i18n/content.pt-BR.json', source: 'src/i18n/content.source.json' };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === '--list') args.list = argv[++i];
    else if (key === '--army') args.army = argv[++i];
    else if (key === '--fleet') args.fleet = argv[++i];
    else if (key === '--game') args.game = argv[++i];
    else if (key === '--url') (args.urls ||= []).push(argv[++i]);
    else if (key === '--urls-file') args.urlsFile = argv[++i];
    else if (key === '--all') args.all = true;
    else if (key === '--system') args.system = argv[++i];
    else if (key === '--out') args.out = argv[++i];
    else if (key === '--source') args.source = argv[++i];
    else if (key === '--refresh-source') args.refreshSource = true;
  }
  return args;
}

// Atualiza a referência inglesa. Sem `--refresh-source`, mantém o texto já
// registrado: é ele que permite detectar que a API mudou e esconder uma
// tradução defasada. Com a flag, aceita o texto novo de propósito.
function mergeSource(previous, collected, refresh) {
  const merged = { ...(previous || {}) };
  for (const [key, value] of Object.entries(collected || {})) {
    if (refresh || merged[key] === undefined) merged[key] = value;
  }
  return merged;
}

// A API do Army Forge devolve 5xx/520 esporádicos quando muitos livros são
// coletados em sequência. Tenta de novo com uma pequena espera antes de falhar.
async function getJson(url, attempts = 5) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
      lastError = new Error(`${url} -> HTTP ${response.status}`);
      if (response.status < 500 && response.status !== 429) throw lastError;
    } catch (error) {
      lastError = error;
    }
    if (attempt < attempts) {
      await new Promise((done) => setTimeout(done, 500 * attempt));
    }
  }
  throw lastError;
}

// As regras comuns são iguais para todos os livros de um sistema. Guarda uma
// cópia por sistema para não baixar a mesma lista dezenas de vezes.
const commonRulesCache = new Map();

async function commonRules(gameSystem) {
  if (!commonRulesCache.has(gameSystem)) {
    commonRulesCache.set(gameSystem, getJson(`${API}/rules/common/${gameSystem}`));
  }
  return commonRulesCache.get(gameSystem);
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
    if (!out.has(node.weaponId)) out.set(node.weaponId, node.name);
  }
  for (const value of Object.values(node)) walkWeapons(value, out);
}

// Baixa um livro e devolve regras/armas/magias/itens como Mapas.
async function collectBook(armyId, gameSystem) {
  // 1) Regras comuns: SOMENTE do sistema da lista (sem misturar GF com GFF, etc.).
  // Os 5 sistemas compartilham os mesmos IDs mas com textos DIFERENTES.
  const rules = new Map();
  const data = await commonRules(gameSystem);
  for (const rule of data.rules || []) {
    if (rule.id && rule.name) {
      rules.set(rule.id, { name: rule.name, description: rule.description || '' });
    }
  }

  // 2) Livro do exército: regras próprias, armas e magias.
  const book = await getJson(
    `${API}/army-books/${encodeURIComponent(armyId)}?gameSystem=${gameSystem}`,
  );

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
    // Itens fixos da unidade (ex.: "Shadow Synapses", que concede Caster).
    for (const item of unit.items || []) {
      if (item?.name?.trim()) itemNames.add(item.name);
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
        itemNames.add(item.name);
      }
    }
  }
  for (const pkg of book.upgradePackages || []) {
    for (const section of pkg.sections || []) {
      for (const opt of section.options || []) {
        for (const gain of opt.gains || []) {
          if (gain?.type === 'ArmyBookItem' && gain.name) {
            itemNames.add(gain.name);
          }
        }
      }
    }
  }

  const spells = new Map();
  for (const spell of book.spells || []) {
    if (spell?.id && spell?.name) {
      // Chave composta (nome::efeito) para suportar variantes do mesmo nome
      // com efeitos diferentes entre livros (ex.: "Electric Tempest").
      const key = `${spell.name.trim()}::${(spell.effect || '').trim()}`;
      spells.set(key, { name: spell.name, effect: spell.effect || '' });
    }
  }

  return {
    meta: {
      armyId,
      gameSystem,
      book: book.name || '',
      collectedAt: new Date().toISOString().slice(0, 10),
    },
    rules,
    weapons: new Map([...weapons].map(([id, name]) => [id, { name }])),
    spells,
    items: new Map([...itemNames].map((name) => [name, name])),
  };
}

// Livros de frota (Warfleets, gameSystem 11): vivem em /api/gfwf/<uid>, com
// ships/heroes/titles/upgrades/weapons/specialRules (sem spells). Regras
// comuns vêm de /rules/common/11; heróis/títulos/melhorias entram como regras
// (id + nome + texto), pois o texto da regra é o conteúdo traduzível.
async function collectFleetBook(fleetUid, gameSystem) {
  const rules = new Map();
  const data = await commonRules(gameSystem);
  for (const rule of data.rules || []) {
    if (rule.id && rule.name) {
      rules.set(rule.id, { name: rule.name, description: rule.description || '' });
    }
  }

  const book = await getJson(`${API}/gfwf/${encodeURIComponent(fleetUid)}`);

  for (const rule of book.specialRules || []) {
    if (rule?.id && rule?.name) {
      rules.set(rule.id, { name: rule.name, description: rule.rule || rule.description || '' });
    }
  }
  // Heróis, títulos e melhorias: o `rule` é a descrição da regra concedida.
  for (const entry of [...(book.heroes || []), ...(book.titles || []), ...(book.upgrades || [])]) {
    if (entry?.id && entry?.name) {
      rules.set(entry.id, { name: entry.name, description: entry.rule || '' });
    }
  }

  const weapons = new Map();
  for (const weapon of book.weapons || []) {
    if (weapon?.id && weapon?.name) {
      weapons.set(weapon.id, { name: weapon.name });
    }
  }

  // Warfleets não tem magias nem upgrades-item (naves ficam em inglês, como
  // as unidades dos outros sistemas).
  return {
    meta: {
      armyId: fleetUid,
      gameSystem,
      book: book.name || '',
      collectedAt: new Date().toISOString().slice(0, 10),
    },
    rules,
    weapons,
    spells: new Map(),
    items: new Map(),
  };
}

// Lista de livros a coletar, sem repetir armyId.
async function resolveTargets(args) {
  const targets = [];
  const urls = [...(args.urls || [])];
  if (args.urlsFile) {
    const text = await readFile(resolve(args.urlsFile), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) urls.push(trimmed);
    }
  }
  for (const url of urls) targets.push(parseArmyUrl(url));

  if (targets.length === 0 && args.list) {
    const army = await getJson(`${API}/tts?id=${encodeURIComponent(args.list)}`);
    targets.push({
      armyId: army.units?.[0]?.armyId,
      gameSystem: GAME_SYSTEM_IDS[String(army.gameSystem || '').toLowerCase()],
    });
  }
  if (targets.length === 0 && args.army) {
    targets.push({ armyId: args.army, gameSystem: args.game ? Number(args.game) : undefined });
  }
  if (targets.length === 0 && args.fleet) {
    targets.push({ armyId: args.fleet, gameSystem: args.game ? Number(args.game) : GAME_SYSTEM_IDS.gfwf, fleet: true });
  }
  // --all: repete a coleta de todos os livros já registrados na fonte, sem
  // precisar montar uma lista de URLs. É o caminho normal para atualizar o
  // dicionário depois de uma atualização da OPR.
  if (args.all) {
    let file = {};
    try {
      file = JSON.parse(await readFile(resolve(args.source), 'utf8'));
    } catch {
      /* fonte ainda não existe */
    }
    for (const [slug, section] of Object.entries(file.systems || {})) {
      if (args.system && slug !== args.system) continue;
      const gameSystem = section.meta?.gameSystem ?? GAME_SYSTEM_IDS[slug];
      if (!gameSystem) continue;
      const collections = Array.isArray(section.meta?.collections)
        ? section.meta.collections
        : [{ armyId: section.meta?.armyId }];
      for (const entry of collections) {
        if (!entry?.armyId) continue;
        targets.push({
          armyId: entry.armyId,
          gameSystem,
          fleet: gameSystem === GAME_SYSTEM_IDS.gfwf,
        });
      }
    }
    if (targets.length === 0) {
      throw new Error(
        `Nenhum livro registrado em ${args.source}${args.system ? ` para o sistema ${args.system}` : ''}.`,
      );
    }
  }

  const unique = [];
  const seen = new Set();
  for (const target of targets) {
    if (!target.armyId || !target.gameSystem) {
      throw new Error(
        'Não consegui descobrir o armyId/gameSystem de uma das URLs. Use --army e --game.',
      );
    }
    const id = `${target.gameSystem}:${target.armyId}`;
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push(target);
  }
  return unique;
}

const slugFor = (gameSystem) =>
  Object.entries(GAME_SYSTEM_IDS).find(([, id]) => id === gameSystem)?.[0];

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const targets = await resolveTargets(args);

  if (targets.length === 0) {
    console.error(
      'Informe --url <página army-info>, --urls-file <arquivo>, --list <id-da-lista>, --army <armyId> --game <2..6> ou --all.',
    );
    process.exit(1);
  }

  // Junta todos os livros por sistema. A última grafia vista vence, igual à
  // coleta de um livro por vez.
  const bySlug = new Map();
  for (const target of targets) {
    const slug = slugFor(target.gameSystem);
    if (!slug) throw new Error(`Sistema desconhecido: ${target.gameSystem}`);

    const collected =
      target.fleet || target.gameSystem === GAME_SYSTEM_IDS.gfwf
        ? await collectFleetBook(target.armyId, target.gameSystem)
        : await collectBook(target.armyId, target.gameSystem);
    let bucket = bySlug.get(slug);
    if (!bucket) {
      bucket = {
        slug,
        rules: new Map(),
        weapons: new Map(),
        spells: new Map(),
        items: new Map(),
        books: [],
        meta: null,
      };
      bySlug.set(slug, bucket);
    }
    for (const [key, value] of collected.rules) bucket.rules.set(key, value);
    for (const [key, value] of collected.weapons) bucket.weapons.set(key, value);
    for (const [key, value] of collected.spells) bucket.spells.set(key, value);
    for (const [key, value] of collected.items) bucket.items.set(key, value);
    bucket.books.push({
      armyId: target.armyId,
      book: collected.meta.book,
      collectedAt: collected.meta.collectedAt,
    });
    bucket.meta = collected.meta;

    console.log(
      `Coletado: ${collected.meta.book} (${target.armyId}, sistema ${target.gameSystem})`,
    );
  }

  // Source is an immutable snapshot of the English API payload, grouped by game system.
  const sourcePath = resolve(args.source);
  let sourceFile = {};
  try {
    sourceFile = JSON.parse(await readFile(sourcePath, 'utf8'));
  } catch {
    /* first collection */
  }
  const sourceSystems = sourceFile.systems || {};
  if (!sourceFile.systems && sourceFile.rules) {
    const previousSlug = slugFor(sourceFile.meta?.gameSystem);
    if (previousSlug) sourceSystems[previousSlug] = sourceFile;
  }

  const outPath = resolve(args.out);
  let existing = null;
  try {
    existing = JSON.parse(await readFile(outPath, 'utf8'));
  } catch {
    existing = null;
  }

  const existingSystems = existing?.systems || {};
  const merged = { ...existing, meta: existing?.meta || {}, systems: { ...existingSystems } };

  for (const bucket of bySlug.values()) {
    const { slug } = bucket;
    const collected = {
      meta: bucket.meta,
      rules: Object.fromEntries([...bucket.rules.entries()].sort(([a], [b]) => a.localeCompare(b))),
      weapons: Object.fromEntries(
        [...bucket.weapons.entries()].sort(([a], [b]) => a.localeCompare(b)),
      ),
      spells: Object.fromEntries(
        [...bucket.spells.entries()].sort(([a], [b]) => a.localeCompare(b)),
      ),
      items: Object.fromEntries([...bucket.items.entries()].sort()),
    };

    const previousSource = sourceSystems[slug] || {};
    const previousCollections = Array.isArray(previousSource.meta?.collections)
      ? previousSource.meta.collections
      : previousSource.meta?.armyId
        ? [{ armyId: previousSource.meta.armyId, book: previousSource.meta.book || '' }]
        : [];
    const updatedIds = new Set(bucket.books.map((entry) => entry.armyId));
    const collections = [
      ...previousCollections.filter((entry) => !updatedIds.has(entry.armyId)),
      ...bucket.books,
    ];

    sourceSystems[slug] = {
      meta: { ...previousSource.meta, ...collected.meta, system: slug, collections },
      rules: mergeSource(previousSource.rules, collected.rules, args.refreshSource),
      weapons: mergeSource(previousSource.weapons, collected.weapons, args.refreshSource),
      spells: mergeSource(previousSource.spells, collected.spells, args.refreshSource),
      items: mergeSource(previousSource.items, collected.items, args.refreshSource),
    };

    // Preserve existing translations and add new API terms as empty entries.
    const previousSection = existingSystems[slug] || {};
    const section = {
      // Keep extra bookkeeping already present (e.g. `collections`) and refresh
      // the rest with what was just collected.
      meta: { ...previousSection.meta, ...collected.meta, system: slug },
      rules: { ...(previousSection.rules || {}) },
      weapons: { ...(previousSection.weapons || {}) },
      spells: { ...(previousSection.spells || {}) },
      items: { ...(previousSection.items || {}) },
    };
    for (const sectionKey of ['rules', 'weapons', 'spells']) {
      for (const [id, source] of Object.entries(collected[sectionKey])) {
        const previous = previousSection[sectionKey]?.[id] || {};
        const entry = {};
        for (const field of Object.keys(source)) {
          // English stays in content.source.json; new translations start blank.
          entry[field] = previous[field] ?? '';
        }
        section[sectionKey][id] = entry;
      }
    }
    // Itens: chave é o nome em inglês, valor é a tradução (string simples).
    for (const [name, source] of Object.entries(collected.items)) {
      section.items[name] = previousSection.items?.[name] ?? '';
    }
    merged.systems[slug] = section;

    const count = (key) => Object.keys(section[key]).length;
    console.log(`Sistema ${slug}: ${collections.length} livro(s)`);
    console.log(
      `  Regras: ${count('rules')} | Armas: ${count('weapons')} | Magias: ${count('spells')} | Itens: ${count('items')}`,
    );
  }

  await mkdir(dirname(sourcePath), { recursive: true });
  await writeFile(sourcePath, `${JSON.stringify({ systems: sourceSystems }, null, 2)}\n`, 'utf8');

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');

  console.log(
    args.refreshSource
      ? '\nFonte inglesa atualizada (--refresh-source). Revise as traduções (npm run i18n:check).'
      : '\nFonte inglesa preservada (use --refresh-source para aceitar o texto novo da API).',
  );
  console.log(`Gravado em ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
