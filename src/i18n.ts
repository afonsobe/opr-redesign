export type Lang = 'en' | 'pt-BR';

const en = {
  'nav.openMenu': 'Open menu',
  'nav.home': 'Home',
  'nav.lists': 'My Lists',
  'nav.faq': 'FAQ',
  'nav.changelog': 'Changelog',
  'nav.about': 'About',
  'lang.label': 'Language',

  'home.eyebrow': 'OnePageRules · Army Forge',
  'home.title': 'Turn your army list into ready-to-play cards',
  'home.subtitle':
    'Paste a shared Army Forge link and get one printable card per unit — stats, special rules and weapons included. Free, no sign-up.',
  'home.inputLabel': 'Army Forge shared link or list ID',
  'home.placeholder': 'Paste your shared Army Forge link or list ID...',
  'btn.generate': 'Generate Cards',
  'btn.refresh': 'Refresh List',
  'btn.refreshTitle': 'Pull the latest version from Army Forge',
  'btn.print': 'Print',

  'opt.cards': 'Include cards in print',
  'opt.rules': 'Include rules table in print',
  'opt.spells': 'Include spells table in print',
  'opt.customNames': 'Use custom unit names',
  'opt.combine': 'Combine similar units',
  'opt.title': 'Options',
  'opt.palette': 'Color palette:',
  'palette.auto': 'Automatic (by army book or list name)',
  'palette.autoPicked': 'Automatic → {name}',
  'palette.general': 'General',
  'palette.default': 'Default',
  'avatar.label': 'Image size:',
  'avatar.default': 'default',

  'msg.loading': 'Loading army list...',
  'msg.pasteLink': 'Paste a shared Army Forge link or list ID.',
  'msg.loadError':
    'Could not load this army list. Check the link, try again, or verify whether the browser blocked the request.',
  'msg.noUnits': 'This army list did not return any units.',
  'msg.refreshError': 'Could not refresh this list. Check your connection and try again.',

  'lists.title': 'My Lists',
  'lists.placeholder': 'Saved lists will appear here.',
  'lists.empty':
    'No saved lists yet. Generate cards on the Home page and they will be saved here automatically.',
  'lists.unnamed': 'Unnamed list',
  'lists.updated': 'Updated {when}',
  'lists.unknown': 'unknown',
  'lists.justNow': 'just now',
  'lists.load': 'Load',
  'lists.loadTitle': 'Load this list instantly from your saved copy.',
  'lists.refresh': 'Refresh',
  'lists.refreshing': 'Refreshing...',
  'lists.refreshTitle':
    'Update this list with its latest version saved on Army Forge. Only runs when you click it.',
  'lists.delete': 'Delete',
  'lists.deleteTitle': 'Remove this list from your saved lists.',
  'lists.confirmDelete': 'Remove "{name}" from your saved lists?',
  'lists.thisList': 'this list',

  'card.quality': 'Quality',
  'card.defense': 'Defense',
  'card.tough': 'Tough',
  'card.specialRules': 'Special Rules',
  'card.weapons': 'Weapons',
  'card.noRules': 'No special rules',
  'card.noWeapons': 'No weapons',
  'card.combined': 'Combined',
  'card.joinedTo': '🔗 Joined to {name}',
  'card.unnamed': 'Unnamed unit',
  'wpn.weapon': 'Weapon',
  'wpn.range': 'RNG',
  'wpn.attacks': 'ATK',
  'wpn.ap': 'AP',
  'wpn.special': 'Special rules',
  'activation.one': 'activation',
  'activation.other': 'activations',

  'table.specialRules': 'Special Rules',
  'table.spells': 'Spells',
  'table.rule': 'Rule',
  'table.description': 'Description',
  'table.cost': 'Cost',
  'table.spell': 'Spell',
  'table.effect': 'Effect',

  'img.add': 'Click to add an image',
  'img.drag': 'Drag to move · scroll to zoom',
  'img.tooLarge': 'That image is too large. Please choose one under {mb} MB.',
  'img.zoom': 'Zoom',
  'img.horizontal': 'Horizontal',
  'img.vertical': 'Vertical',
  'img.recenter': 'Recenter',
  'img.recenterTitle': 'Reset zoom and position',
  'img.remove': 'Remove image',
};

export type Key = keyof typeof en;

// O TypeScript avisa se faltar alguma chave aqui.
const ptBR: Record<Key, string> = {
  'nav.openMenu': 'Abrir menu',
  'nav.home': 'Início',
  'nav.lists': 'Minhas listas',
  'nav.faq': 'FAQ',
  'nav.changelog': 'Novidades',
  'nav.about': 'Sobre',
  'lang.label': 'Idioma',

  'home.eyebrow': 'OnePageRules · Army Forge',
  'home.title': 'Transforme sua lista em cartas prontas para jogar',
  'home.subtitle':
    'Cole um link compartilhado do Army Forge e receba uma carta imprimível por unidade — com atributos, regras especiais e armas. Grátis, sem cadastro.',
  'home.inputLabel': 'Link compartilhado do Army Forge ou ID da lista',
  'home.placeholder': 'Cole o link compartilhado do Army Forge ou o ID da lista...',
  'btn.generate': 'Gerar cartas',
  'btn.refresh': 'Atualizar lista',
  'btn.refreshTitle': 'Buscar a versão mais recente no Army Forge',
  'btn.print': 'Imprimir',

  'opt.cards': 'Incluir cartas na impressão',
  'opt.rules': 'Incluir tabela de regras na impressão',
  'opt.spells': 'Incluir tabela de magias na impressão',
  'opt.customNames': 'Usar nomes personalizados das unidades',
  'opt.combine': 'Combinar unidades iguais',
  'opt.title': 'Opções',
  'opt.palette': 'Paleta de cores:',
  'palette.auto': 'Automática (pelo livro ou nome da lista)',
  'palette.autoPicked': 'Automática → {name}',
  'palette.general': 'Geral',
  'palette.default': 'Padrão — grafite e teal',
  'avatar.label': 'Tamanho da imagem:',
  'avatar.default': 'padrão',

  'msg.loading': 'Carregando lista do exército...',
  'msg.pasteLink': 'Cole um link compartilhado do Army Forge ou o ID da lista.',
  'msg.loadError':
    'Não foi possível carregar esta lista. Confira o link, tente de novo ou verifique se o navegador bloqueou a solicitação.',
  'msg.noUnits': 'Esta lista não retornou nenhuma unidade.',
  'msg.refreshError': 'Não foi possível atualizar esta lista. Verifique sua conexão e tente de novo.',

  'lists.title': 'Minhas listas',
  'lists.placeholder': 'As listas salvas aparecerão aqui.',
  'lists.empty':
    'Nenhuma lista salva ainda. Gere cartas na página inicial e elas serão salvas aqui automaticamente.',
  'lists.unnamed': 'Lista sem nome',
  'lists.updated': 'Atualizada {when}',
  'lists.unknown': 'desconhecido',
  'lists.justNow': 'agora mesmo',
  'lists.load': 'Carregar',
  'lists.loadTitle': 'Carregar esta lista na hora, a partir da cópia salva.',
  'lists.refresh': 'Atualizar',
  'lists.refreshing': 'Atualizando...',
  'lists.refreshTitle':
    'Atualiza esta lista com a versão mais recente do Army Forge. Só acontece quando você clica.',
  'lists.delete': 'Excluir',
  'lists.deleteTitle': 'Remover esta lista das suas listas salvas.',
  'lists.confirmDelete': 'Remover "{name}" das suas listas salvas?',
  'lists.thisList': 'esta lista',

  'card.quality': 'Qualidade',
  'card.defense': 'Defesa',
  'card.tough': 'Resistência',
  'card.specialRules': 'Regras especiais',
  'card.weapons': 'Armas',
  'card.noRules': 'Sem regras especiais',
  'card.noWeapons': 'Sem armas',
  'card.combined': 'Combinada',
  'card.joinedTo': '🔗 Junta-se a {name}',
  'card.unnamed': 'Unidade sem nome',
  'wpn.weapon': 'Arma',
  'wpn.range': 'ALC',
  'wpn.attacks': 'ATQ',
  'wpn.ap': 'PA',
  'wpn.special': 'Regras especiais',
  'activation.one': 'ativação',
  'activation.other': 'ativações',

  'table.specialRules': 'Regras especiais',
  'table.spells': 'Magias',
  'table.rule': 'Regra',
  'table.description': 'Descrição',
  'table.cost': 'Custo',
  'table.spell': 'Magia',
  'table.effect': 'Efeito',

  'img.add': 'Clique para adicionar uma imagem',
  'img.drag': 'Arraste para mover · role para dar zoom',
  'img.tooLarge': 'Essa imagem é grande demais. Escolha uma com menos de {mb} MB.',
  'img.zoom': 'Zoom',
  'img.horizontal': 'Horizontal',
  'img.vertical': 'Vertical',
  'img.recenter': 'Centralizar',
  'img.recenterTitle': 'Redefinir zoom e posição',
  'img.remove': 'Remover imagem',
};

const dictionaries: Record<Lang, Record<Key, string>> = { en, 'pt-BR': ptBR };

const LANG_KEY = 'lang';

function loadLang(): Lang {
  try {
    return localStorage.getItem(LANG_KEY) === 'pt-BR' ? 'pt-BR' : 'en';
  } catch {
    return 'en';
  }
}

let currentLang: Lang = loadLang();

export function getLang(): Lang {
  return currentLang;
}

export function setLang(lang: Lang): void {
  currentLang = lang;
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch (error) {
    console.error('Failed to save language:', error);
  }
}

/** Texto no idioma atual. {nome} no texto é trocado pelos valores de `params`. */
export function t(key: Key, params?: Record<string, string | number>): string {
  let text = dictionaries[currentLang][key] ?? en[key];
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.split(`{${name}}`).join(String(value));
    }
  }
  return text;
}

/** Singular/plural: tn('activation', 1) -> "activation"; tn('activation', 3) -> "activations". */
export function tn(base: 'activation', count: number): string {
  return t(`${base}.${count === 1 ? 'one' : 'other'}` as Key);
}

/** Aplica o idioma aos elementos do HTML marcados com data-i18n-*. */
export function applyTranslations(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n as Key);
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((el) => {
    el.title = t(el.dataset.i18nTitle as Key);
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach((el) => {
    el.setAttribute('aria-label', t(el.dataset.i18nAria as Key));
  });
  root.querySelectorAll<HTMLInputElement>('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder as Key);
  });
  document.documentElement.lang = currentLang;
}