export interface Palette {
  id: string;
  game: 'GF' | 'AoF' | 'geral';
  label: string;
  c1: string; // cor principal: heróis, pontos, títulos
  c2: string; // cor secundária: unidades comuns
  keywords: string[]; // palavras do nome da lista que ativam a paleta no modo automático
}

export const PALETTES: Palette[] = [
  // ===== Grimdark Future =====
  { id: 'alien-hives', game: 'GF', label: 'Alien Hives — vinho e teal', c1: '#7a1f4a', c2: '#2a6b66', keywords: ['alien hives'] },
  { id: 'battle-brothers', game: 'GF', label: 'Battle Brothers — azul-marinho e ouro', c1: '#1f3f7a', c2: '#9a7410', keywords: ['battle brothers'] },
  { id: 'blessed-sisters', game: 'GF', label: 'Blessed Sisters — carmim e grafite', c1: '#a5243a', c2: '#2e2e36', keywords: ['blessed sisters'] },
  { id: 'custodian-brothers', game: 'GF', label: 'Custodian Brothers — ouro e vermelho', c1: '#8a6a10', c2: '#8f1d1d', keywords: ['custodian'] },
  { id: 'dao-union', game: 'GF', label: 'DAO Union — laranja queimado e azul-aço', c1: '#b4530f', c2: '#35607f', keywords: ['dao union'] },
  { id: 'dark-elf-raiders', game: 'GF', label: 'Dark Elf Raiders — roxo e verde-veneno', c1: '#4b2a6e', c2: '#2d7d46', keywords: ['dark elf raider'] },
  { id: 'dwarf-guilds', game: 'GF', label: 'Dwarf Guilds — cobre e cinza-pedra', c1: '#8a4b14', c2: '#4e4a44', keywords: ['dwarf guild'] },
  { id: 'elven-jesters', game: 'GF', label: 'Elven Jesters — coral e turquesa', c1: '#b5472f', c2: '#1f7f8a', keywords: ['elven jester', 'jesters'] },
  { id: 'eternal-dynasty', game: 'GF', label: 'Eternal Dynasty — azul-petróleo e laranja', c1: '#1d5f78', c2: '#b5651d', keywords: ['eternal dynasty'] },
  { id: 'gangs-new-eden', game: 'GF', label: 'Gangs of New Eden — laranja e roxo', c1: '#b3541e', c2: '#5d3a7a', keywords: ['new eden'] },
  { id: 'havoc-brothers', game: 'GF', label: 'Havoc Brothers — vermelho e latão', c1: '#7d1414', c2: '#8f6b14', keywords: ['havoc brothers', 'nemesis claw'] },
  { id: 'high-elf-fleets', game: 'GF', label: 'High Elf Fleets — azul-celeste e dourado', c1: '#2c7bb0', c2: '#b9962a', keywords: ['high elf fleet'] },
  { id: 'human-defense', game: 'GF', label: 'Human Defense Force — oliva e bronze', c1: '#4a5a2a', c2: '#8a6a3a', keywords: ['human defense', 'defense force'] },
  { id: 'human-inquisition', game: 'GF', label: 'Human Inquisition — ameixa e latão', c1: '#4a1f33', c2: '#8a7a3a', keywords: ['inquisition'] },
  { id: 'infected-colonies', game: 'GF', label: 'Infected Colonies — oliva e roxo', c1: '#566b1f', c2: '#6a3a7a', keywords: ['infected colon'] },
  { id: 'jackals', game: 'GF', label: 'Jackals — ocre e cinza-azulado', c1: '#94661a', c2: '#4a6a7a', keywords: ['jackal'] },
  { id: 'machine-cult', game: 'GF', label: 'Machine Cult — laranja-ferrugem e cinza', c1: '#b03a14', c2: '#55595f', keywords: ['machine cult'] },
  { id: 'orc-marauders', game: 'GF', label: 'Orc Marauders — verde e laranja', c1: '#2f6b2a', c2: '#b0561a', keywords: ['orc marauder'] },
  { id: 'prime-brothers', game: 'GF', label: 'Prime Brothers — azul-aço e cobre', c1: '#355c7d', c2: '#a35a1d', keywords: ['prime brothers'] },
  { id: 'ratmen-clans', game: 'GF', label: 'Ratmen Clans — marrom e verde-podre', c1: '#6b4a1f', c2: '#3f8a4a', keywords: ['ratmen clan'] },
  { id: 'rebel-guerrillas', game: 'GF', label: 'Rebel Guerrillas — terracota e verde-militar', c1: '#9a4a2a', c2: '#4a5a3a', keywords: ['rebel guerrilla'] },
  { id: 'robot-legions', game: 'GF', label: 'Robot Legions — grafite e verde', c1: '#37454d', c2: '#2a7a4a', keywords: ['robot legion'] },
  { id: 'saurian-starhost', game: 'GF', label: 'Saurian Starhost — teal e dourado', c1: '#1a7a7a', c2: '#b98a1c', keywords: ['starhost'] },
  { id: 'soul-snatcher-cults', game: 'GF', label: 'Soul-Snatcher Cults — índigo e verde-limão', c1: '#3d2a5a', c2: '#7a8a2a', keywords: ['soul-snatcher', 'soul snatcher'] },
  { id: 'titan-lords', game: 'GF', label: 'Titan Lords — azul-noite e ouro velho', c1: '#26324a', c2: '#a07a1c', keywords: ['titan lords'] },
  { id: 'wormhole-daemons', game: 'GF', label: 'Wormhole Daemons — roxo e magenta', c1: '#5a2a7a', c2: '#b0306a', keywords: ['wormhole'] },
  // Livros extras do Army Forge
  { id: 'blood-brothers', game: 'GF', label: 'Blood Brothers — vermelho e grafite', c1: '#8a1c1c', c2: '#444a52', keywords: ['blood brothers'] },
  { id: 'dark-brothers', game: 'GF', label: 'Dark Brothers — verde-escuro e osso', c1: '#1f4a2e', c2: '#8a7a5a', keywords: ['dark brothers'] },
  { id: 'knight-brothers', game: 'GF', label: 'Knight Brothers — aço e bordô', c1: '#3e556e', c2: '#7a1f3a', keywords: ['knight brothers'] },
  { id: 'watch-brothers', game: 'GF', label: 'Watch Brothers — preto e prata', c1: '#2b2f36', c2: '#6f7882', keywords: ['watch brothers'] },
  { id: 'wolf-brothers', game: 'GF', label: 'Wolf Brothers — azul-gelo e couro', c1: '#3f5f78', c2: '#8a6a4a', keywords: ['wolf brothers'] },
  { id: 'blight-disciples', game: 'GF', label: 'Blight / Plague Disciples — verde-pútrido e marrom', c1: '#6a7a1f', c2: '#7a4a2a', keywords: ['blight disciples', 'plague disciples'] },
  { id: 'change-disciples', game: 'GF', label: 'Change Disciples — azul e rosa', c1: '#2a4fa0', c2: '#b0306a', keywords: ['change disciples', 'daemons of change'] },
  { id: 'lust-disciples', game: 'GF', label: 'Lust Disciples — magenta e turquesa', c1: '#a8286e', c2: '#1f7f9a', keywords: ['lust disciples'] },
  { id: 'war-disciples', game: 'GF', label: 'War Disciples — vermelho e bronze', c1: '#a31f1f', c2: '#7a5a2a', keywords: ['war disciples'] },

  // ===== Age of Fantasy =====
  { id: 'aof-beastmen', game: 'AoF', label: 'Beastmen — marrom e verde-floresta', c1: '#6b3f1f', c2: '#3f6a2a', keywords: ['beastmen'] },
  { id: 'aof-chivalrous', game: 'AoF', label: 'Chivalrous Kingdoms — azul-real e vermelho heráldico', c1: '#2e4fa3', c2: '#a82a2a', keywords: ['chivalrous'] },
  { id: 'aof-dark-elves', game: 'AoF', label: 'Dark Elves — roxo-noite e carmesim', c1: '#3a2a5c', c2: '#8a2a4a', keywords: ['dark elves'] },
  { id: 'aof-deep-sea-elves', game: 'AoF', label: 'Deep-Sea Elves — azul-profundo e coral', c1: '#1a4a7a', c2: '#c4514a', keywords: ['deep-sea', 'deep sea'] },
  { id: 'aof-duchies-vinci', game: 'AoF', label: 'Duchies of Vinci — vinho e azul-lago', c1: '#7a2a3a', c2: '#2f5f7a', keywords: ['vinci'] },
  { id: 'aof-havoc-dwarves', game: 'AoF', label: 'Havoc Dwarves — laranja-forja e grafite', c1: '#b35a10', c2: '#3a3a3a', keywords: ['havoc dwarves'] },
  { id: 'aof-sky-city-dwarves', game: 'AoF', label: 'Sky-City Dwarves — azul-aço e latão', c1: '#2a6a8a', c2: '#b0701a', keywords: ['sky-city', 'sky city'] },
  { id: 'aof-volcanic-dwarves', game: 'AoF', label: 'Volcanic Dwarves — lava e rocha escura', c1: '#b02a10', c2: '#4a3a30', keywords: ['volcanic'] },
  { id: 'aof-dwarves', game: 'AoF', label: 'Dwarves — rubi e bronze', c1: '#8a2a1a', c2: '#a07a2a', keywords: ['dwarves'] },
  { id: 'aof-eternal-wardens', game: 'AoF', label: 'Eternal Wardens — ouro escuro e azul-tempestade', c1: '#8f6a10', c2: '#2a5a9a', keywords: ['eternal wardens'] },
  { id: 'aof-ghostly-undead', game: 'AoF', label: 'Ghostly Undead — verde-espectral e cinza-azulado', c1: '#2d7a72', c2: '#5a6a8a', keywords: ['ghostly'] },
  { id: 'aof-giant-tribes', game: 'AoF', label: 'Giant Tribes — terra e verde-musgo', c1: '#8a5a3a', c2: '#5a6a3a', keywords: ['giant tribes'] },
  { id: 'aof-goblins', game: 'AoF', label: 'Goblins — verde-folha e mostarda', c1: '#5a8a1f', c2: '#8a6a1a', keywords: ['goblins'] },
  { id: 'aof-halflings', game: 'AoF', label: 'Halflings — marrom-trigo e verde-prado', c1: '#8a6a2a', c2: '#4a8a4a', keywords: ['halflings'] },
  { id: 'aof-havoc-war-clans', game: 'AoF', label: 'Havoc War Clans — sangue e ferro', c1: '#8a1a1a', c2: '#4a4a50', keywords: ['war clans'] },
  { id: 'aof-havoc-warriors', game: 'AoF', label: 'Havoc Warriors — vinho-escuro e latão', c1: '#5a1a2a', c2: '#8a6a2a', keywords: ['havoc warriors'] },
  { id: 'aof-high-elves', game: 'AoF', label: 'High Elves — azul-cobalto e ouro', c1: '#3a5fb5', c2: '#c2a02a', keywords: ['high elves'] },
  { id: 'aof-human-empire', game: 'AoF', label: 'Human Empire — vermelho e azul', c1: '#8a2020', c2: '#2a4a8a', keywords: ['human empire'] },
  { id: 'aof-kingdom-angels', game: 'AoF', label: 'Kingdom of Angels — ouro celestial e azul-céu', c1: '#9a8020', c2: '#3a8ac0', keywords: ['angels'] },
  { id: 'aof-mummified-undead', game: 'AoF', label: 'Mummified Undead — ouro-areia e turquesa', c1: '#9a7418', c2: '#2a8a8a', keywords: ['mummified'] },
  { id: 'aof-ogres', game: 'AoF', label: 'Ogres — vermelho-terra e couro', c1: '#8a3a2a', c2: '#6a5a3a', keywords: ['ogres'] },
  { id: 'aof-orcs', game: 'AoF', label: 'Orcs — verde-musgo e vermelho', c1: '#3f7a2a', c2: '#8a2a1a', keywords: ['orcs'] },
  { id: 'aof-ossified-undead', game: 'AoF', label: 'Ossified Undead — osso e verde-azulado', c1: '#7a6a4a', c2: '#3a7a6a', keywords: ['ossified'] },
  { id: 'aof-ratmen', game: 'AoF', label: 'Ratmen — marrom-escuro e verde-podre', c1: '#5a3f2a', c2: '#6a8a1f', keywords: ['ratmen'] },
  { id: 'aof-rift-daemons', game: 'AoF', label: 'Rift Daemons — roxo e laranja-fogo', c1: '#6a2a7a', c2: '#c0501a', keywords: ['rift daemons'] },
  { id: 'aof-saurians', game: 'AoF', label: 'Saurians — verde-jade e laranja', c1: '#1f6f5a', c2: '#c0661a', keywords: ['saurians'] },
  { id: 'aof-shadow-stalkers', game: 'AoF', label: 'Shadow Stalkers — azul-sombra e violeta', c1: '#3a3a50', c2: '#6a4a8a', keywords: ['shadow stalkers'] },
  { id: 'aof-vampiric-undead', game: 'AoF', label: 'Vampiric Undead — bordô e cinza-ardósia', c1: '#6a1a2a', c2: '#4a4a5a', keywords: ['vampiric'] },
  { id: 'aof-wood-elves', game: 'AoF', label: 'Wood Elves — verde-floresta e ouro-folha', c1: '#2f6a3a', c2: '#a07a1a', keywords: ['wood elves'] },

  // ===== Geral =====
  { id: 'default', game: 'geral', label: 'Padrão — grafite e teal', c1: '#3a3a4a', c2: '#2a6b66', keywords: [] },
];

// Escolhe a paleta pelo nome do exército; se nada combinar, usa a "Padrão".
// A ordem da lista importa: o primeiro que combinar vence.
const fallbackPalette = PALETTES.find((p) => p.id === 'default');
if (!fallbackPalette) throw new Error('Missing default palette.');

export function detectPalette(text: string): Palette {
  const lower = text.toLowerCase();
  return PALETTES.find((p) => p.keywords.some((k) => lower.includes(k))) ?? fallbackPalette!;
}

export function applyPalette(palette: Palette): void {
  const root = document.documentElement;
  root.style.setProperty('--c1', palette.c1);
  root.style.setProperty('--c2', palette.c2);
}