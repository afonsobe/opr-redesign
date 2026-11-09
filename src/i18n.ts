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
  'opt.grayscale': 'Print in grayscale',
  'opt.customNames': 'Use custom unit names',
  'opt.combine': 'Combine similar units',
  'opt.cardDesign': 'Card design:',
  'opt.title': 'Options',
  'opt.customization': 'Customization',
  'opt.palette': 'Color palette:',
  'palette.auto': 'Automatic (by army book or list name)',
  'palette.autoPicked': 'Automatic → {name}',
  'palette.general': 'General',
  'palette.default': 'Default',
  'palette.custom': 'Custom',
  'palette.customPrimary': 'Primary color',
  'palette.customSecondary': 'Secondary color',
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
  'card.move': 'Move',
  'card.cruise': 'Cruise',
  'card.evade': 'Evade',
  'card.heroBadge': 'HERO',
  'card.specialRules': 'Special Rules',
  'card.weapons': 'Weapons',
  'card.noRules': 'No special rules',
  'card.noWeapons': 'No weapons',
  'card.combined': 'Combined',
  'card.joinedTo': '🔗 Joined to {name}',
  'card.unnamed': 'Unnamed unit',
  'card.addArtwork': 'Click to add artwork',
  'wpn.weapon': 'Weapon',
  'wpn.item': 'Item',
  'wpn.range': 'RNG',
  'wpn.attacks': 'ATK',
  'wpn.ap': 'AP',
  'wpn.str': 'STR',
  'wpn.turret': 'Turret',
  'wpn.special': 'Special rules',
  'activation.one': 'activation',
  'activation.other': 'activations',

  'table.specialRules': 'Special Rules',
  'table.spells': 'Spells',
  'table.spellsArmy': '{book} Army Spells',
  'summary.forceOrgWarning': 'This list is not following Force Org. guidelines.',
  'table.rule': 'Rule',
  'table.description': 'Description',
  'table.cost': 'Cost',
  'table.spell': 'Spell',
  'table.effect': 'Effect',
  'stale.note':
    '† Outdated translation — the English text changed on Army Forge; the translation shown is the previous one.',

  'img.add': 'Click to add an image',
  'img.drag': 'Drag to move · scroll to zoom',
  'img.tooLarge': 'That image is too large. Please choose one under {mb} MB.',
  'img.zoom': 'Zoom',
  'img.horizontal': 'Horizontal',
  'img.vertical': 'Vertical',
  'img.recenter': 'Recenter',
  'img.recenterTitle': 'Reset zoom and position',
  'img.remove': 'Remove image',

  'faq.title': 'FAQ — How to use OPR Card Generator - Redesign',
  'faq.callout':
    '<strong>Read this first:</strong> your list only loads if you shared it in Army Forge. Open your army there, click <strong>“Share as Link”</strong>, and paste that link (or its list ID) here. A list that was never shared cannot be read and will fail to load.',
  'faq.lead': 'Read this first:',
  'faq.leadSuffix':
    ' your list only loads if you shared it in Army Forge. Open your army there, click <strong>“Share as Link”</strong>, and paste that link (or its list ID) here. A list that was never shared cannot be read and will fail to load.',
  'faq.generateQ': 'How do I generate cards?',
  'faq.generateA':
    'In Army Forge, open your army and click <strong>“Share as Link”</strong>. Copy the link it gives you, paste it into the box on the Home page (the bare list ID also works), and click <strong>Generate Cards</strong>. If you’ve loaded that list before, it opens instantly from your saved copy — no download needed.',
  'faq.outdatedQ': 'My cards look out of date — how do I update them?',
  'faq.outdatedA':
    'Cards open from your saved copy for speed, so changes you made in Army Forge afterwards won’t show until you re-download the list. Click <strong>Refresh List</strong> on the Home page (or <strong>Refresh</strong> in <strong>My Lists</strong>) to pull the latest version from Army Forge and update your saved copy.',
  'faq.wontLoadQ': 'Why won’t my list load?',
  'faq.wontLoadA':
    'By far the most common reason is that the list was never shared. Go back to Army Forge and click <strong>“Share as Link”</strong> — without it, the list is private and can’t be read. Also double-check that you copied the whole link (or the correct list ID).',
  'faq.bgQ': 'How do I add a background image to a card?',
  'faq.bgA':
    'Click a card to pick an image (up to <strong>2 MB</strong>). Once it has one, <strong>drag</strong> (or use the <strong>Horizontal</strong> / <strong>Vertical</strong> sliders) to reposition, <strong>scroll</strong> (or use the Zoom slider) to zoom, and use the Opacity slider to fade it. <strong>Recenter</strong> resets the framing, and the <strong>✕</strong> removes the image.',
  'faq.savedQ': 'Are my background images saved?',
  'faq.savedA':
    'Yes. Each image — with its zoom, position and opacity — is stored on your device for that unit, so it’s still there when you reload. When you <strong>Refresh List</strong> the image stays as long as the unit is still in the list; if a unit is removed (or you delete the list), its image is cleaned up automatically. Removing an image with the <strong>✕</strong> deletes it too. Images are kept on your device only — they aren’t uploaded anywhere.',
  'faq.combineQ': 'What does "Combine similar units" do?',
  'faq.combineA':
    'With this option on, identical units are merged into one card prefixed with their count — three of the same unit show as <strong>3x</strong> on a single card instead of three copies, with the model count shown as <strong>[5]</strong> after the name. This works for any unit regardless of model count, and up to three identical units share a card (a fourth starts a new one). Combining is purely cosmetic to save paper — points and loadout stay at the single-unit values. It’s off by default, so every unit shows on its own card unless you turn it on.',
  'faq.customQ': 'What does "Use custom unit names" do?',
  'faq.customA':
    'With this option on, a unit you’ve renamed in Army Forge shows that custom name (e.g. <strong>Frodo</strong>) as the card title, and the original book name moves to the subtitle. It’s on by default; turn it off to show the default book name as the title.',
  'faq.printQ': 'How do I print?',
  'faq.printA':
    'Click <strong>Print</strong>. Use the checkboxes above the cards to choose what goes on the page: the cards, the special rules table, and the spells table.',
  'faq.downloadQ': 'How do I download the cards?',
  'faq.downloadA': 'Each card has a <strong>PNG</strong> button to download it on its own.',
  'faq.listsQ': 'What is "My Lists"?',
  'faq.listsA':
    'Every list you generate is saved automatically on your device. From <strong>My Lists</strong> you can <strong>Load</strong> one instantly from your saved copy, <strong>Refresh</strong> it to pull the latest version from Army Forge (this only happens when you click it), or <strong>Delete</strong> it. Loading a list also restores the options you had set for it (such as <strong>Combine similar units</strong>).',

  'changelog.title': 'Changelog',
  'changelog.intro': 'What’s new in OPR Card Generator - Redesign. Newest changes first.',

  'about.title': 'About',
  'about.lead':
    'A small web app that turns a shared <a href="https://army-forge.onepagerules.com" target="_blank" rel="noopener">Army Forge</a> list into printable unit cards for <a href="https://onepagerules.com" target="_blank" rel="noopener">OnePageRules</a> games.',
  'about.text1':
    'Paste a shared army link, get one card per unit (stats, special rules, weapons), plus a combined special-rules table and a spells table — ready to print or download as PNGs.',
  'about.note':
    '<strong>Note:</strong> a list only loads if you shared it in Army Forge — open your army and click <strong>“Share as Link”</strong> first. Private (unshared) lists cannot be read.',
  'about.forkText':
    '<strong>This project is a fork of OPR Card Generator by JeanOmeg.</strong> Thank you, JeanOmeg, for creating and sharing the original project with the community.',
  'about.forkRepo': '<a href="https://github.com/JeanOmeg/opr-card-generator" target="_blank" rel="noopener">Original GitHub repository</a>',
  'about.forkSite': '<a href="https://jeanomeg.github.io/opr-card-generator/" target="_blank" rel="noopener">Original online app</a>',
  'about.forkIssues': '<a href="https://github.com/JeanOmeg/opr-card-generator/issues" target="_blank" rel="noopener">Issues and suggestions</a>',
  'about.forkReleases': '<a href="https://github.com/JeanOmeg/opr-card-generator/releases" target="_blank" rel="noopener">Original project releases</a>',
  'about.forkLicense': '<a href="https://github.com/JeanOmeg/opr-card-generator/blob/master/LICENSE" target="_blank" rel="noopener">Original project license</a>',
  'about.forkAuthor': '<a href="https://github.com/JeanOmeg" target="_blank" rel="noopener">JeanOmeg on GitHub</a>',
  'about.features': 'Features',
  'about.featureCards': 'One printable card per unit: Quality / Defense / Tough, special rules, weapons, notes.',
  'about.featureTables':
    'Combined <strong>special-rules table</strong> (including core/common rule descriptions) and a <strong>spells table</strong> for casters.',
  'about.featureBg':
    'Per-card <strong>background image</strong> (up to 2 MB) with drag- or slider-based positioning, scroll/slider zoom, opacity and recenter — saved on your device per unit and kept across refreshes.',
  'about.featurePrint':
    '<strong>Print</strong> layout (choose cards / rules / spells) and <strong>PNG</strong> download (single or all).',
  'about.featureLists':
    '<strong>My Lists</strong> — every generated list is saved locally on your device so you can reload it instantly, refresh it on demand, or delete it.',
  'about.featureCache':
    '<strong>Cache-first loading</strong> — Generate Cards opens a previously loaded list instantly from your saved copy (works offline); use <strong>Refresh List</strong> to pull the latest version from Army Forge.',
  'about.featurePages': '<strong>FAQ</strong>, <strong>Changelog</strong>, and <strong>About</strong> pages.',
  'about.disclaimer': 'Disclaimer',
  'about.disclaimer1':
    'This is a <strong>free, non-profit project made by a fan, for fans</strong>. It is not affiliated with, endorsed by, or sponsored by OnePageRules.',
  'about.disclaimer2':
    'OnePageRules and all of its game systems, rules, and content (Grimdark Future, Age of Fantasy, and others) are the property of <strong>OnePageRules</strong>. This tool only helps players display their own army lists, and is offered free of charge for non-commercial community use.',
  'about.license': 'License',
  'about.licenseText':
    'Licensed under the <strong>PolyForm Noncommercial License 1.0.0</strong> — free to use, copy, modify, and share for any noncommercial purpose. Commercial use, including monetizing the project in any form, is not permitted.',
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
  'opt.grayscale': 'Imprimir em escala de cinza',
  'opt.customNames': 'Usar nomes personalizados das unidades',
  'opt.combine': 'Combinar unidades iguais',
  'opt.cardDesign': 'Design das cartas:',
  'opt.title': 'Opções',
  'opt.customization': 'Personalização',
  'opt.palette': 'Paleta de cores:',
  'palette.auto': 'Automática (pelo livro ou nome da lista)',
  'palette.autoPicked': 'Automática → {name}',
  'palette.general': 'Geral',
  'palette.default': 'Padrão',
  'palette.custom': 'Personalizado',
  'palette.customPrimary': 'Cor principal',
  'palette.customSecondary': 'Cor secundária',
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
  'card.move': 'Movimento',
  'card.cruise': 'Cruzeiro',
  'card.evade': 'Esquiva',
  'card.heroBadge': 'HERÓI',
  'card.specialRules': 'Regras especiais',
  'card.weapons': 'Armas',
  'card.noRules': 'Sem regras especiais',
  'card.noWeapons': 'Sem armas',
  'card.combined': 'Combinada',
  'card.joinedTo': '🔗 Junta-se a {name}',
  'card.unnamed': 'Unidade sem nome',
  'card.addArtwork': 'Clique para adicionar uma imagem',
  'wpn.weapon': 'Arma',
  'wpn.item': 'Item',
  'wpn.range': 'ALC',
  'wpn.attacks': 'ATQ',
  'wpn.ap': 'PA',
  'wpn.str': 'FOR',
  'wpn.turret': 'Torreta',
  'wpn.special': 'Regras especiais',
  'activation.one': 'ativação',
  'activation.other': 'ativações',

  'table.specialRules': 'Regras especiais',
  'table.spells': 'Magias',
  'table.spellsArmy': 'Magias - {book}',
  'summary.forceOrgWarning': 'Esta lista não segue as regras de organização de força (Force Org.).',
  'table.rule': 'Regra',
  'table.description': 'Descrição',
  'table.cost': 'Custo',
  'table.spell': 'Magia',
  'table.effect': 'Efeito',
  'stale.note':
    '† Tradução desatualizada — o texto em inglês mudou no Army Forge; a tradução exibida é a anterior.',

  'img.add': 'Clique para adicionar uma imagem',
  'img.drag': 'Arraste para mover · role para dar zoom',
  'img.tooLarge': 'Essa imagem é grande demais. Escolha uma com menos de {mb} MB.',
  'img.zoom': 'Zoom',
  'img.horizontal': 'Horizontal',
  'img.vertical': 'Vertical',
  'img.recenter': 'Centralizar',
  'img.recenterTitle': 'Redefinir zoom e posição',
  'img.remove': 'Remover imagem',

  'faq.title': 'FAQ — Como usar o OPR Card Generator - Redesign',
  'faq.callout':
    '<strong>Leia isso primeiro:</strong> sua lista só carrega se você compartilhou no Army Forge. Abra seu exército lá, clique em <strong>“Share as Link”</strong> e cole esse link (ou seu ID de lista) aqui. Uma lista que nunca foi compartilhada não pode ser lida e vai falhar ao carregar.',
  'faq.lead': 'Leia isso primeiro:',
  'faq.leadSuffix':
    ' sua lista só carrega se você compartilhou no Army Forge. Abra seu exército lá, clique em <strong>“Share as Link”</strong> e cole esse link (ou seu ID de lista) aqui. Uma lista que nunca foi compartilhada não pode ser lida e vai falhar ao carregar.',
  'faq.generateQ': 'Como gero as cartas?',
  'faq.generateA':
    'No Army Forge, abra seu exército e clique em <strong>“Share as Link”</strong>. Copie o link, cole na caixa da página inicial (o ID bruto da lista também funciona) e clique em <strong>Gerar cartas</strong>. Se você já carregou essa lista antes, ela abre na hora a partir da sua cópia salva — sem precisar baixar de novo.',
  'faq.outdatedQ': 'Minhas cartas estão desatualizadas — como atualizo?',
  'faq.outdatedA':
    'As cartas abrem da sua cópia salva por rapidez, então mudanças que você fez no Army Forge depois não aparecem até rebaixar a lista. Clique em <strong>Atualizar lista</strong> na página inicial (ou <strong>Atualizar</strong> em <strong>Minhas listas</strong>) para buscar a versão mais recente no Army Forge e atualizar sua cópia salva.',
  'faq.wontLoadQ': 'Por que minha lista não carrega?',
  'faq.wontLoadA':
    'De longe, o motivo mais comum é que a lista nunca foi compartilhada. Volte ao Army Forge e clique em <strong>“Share as Link”</strong> — sem isso, a lista é privada e não pode ser lida. Confira também se você copiou o link inteiro (ou o ID correto da lista).',
  'faq.bgQ': 'Como adiciono uma imagem de fundo a uma carta?',
  'faq.bgA':
    'Clique numa carta para escolher uma imagem (até <strong>2 MB</strong>). Depois que ela tem uma, <strong>arraste</strong> (ou use os controles <strong>Horizontal</strong> / <strong>Vertical</strong>) para reposicionar, <strong>role</strong> (ou use o controle de Zoom) para ampliar, e use o controle de Opacidade para esmaecer. <strong>Centralizar</strong> reseta o enquadramento e o <strong>✕</strong> remove a imagem.',
  'faq.savedQ': 'Minhas imagens de fundo são salvas?',
  'faq.savedA':
    'Sim. Cada imagem — com zoom, posição e opacidade — fica guardada no seu dispositivo para aquela unidade, então continua lá quando você recarrega. Ao <strong>Atualizar lista</strong>, a imagem permanece enquanto a unidade ainda estiver na lista; se uma unidade for removida (ou você excluir a lista), a imagem é limpa automaticamente. Remover uma imagem com o <strong>✕</strong> também a exclui. As imagens ficam só no seu dispositivo — não são enviadas para nenhum lugar.',
  'faq.combineQ': 'O que faz "Combinar unidades iguais"?',
  'faq.combineA':
    'Com esta opção ligada, unidades idênticas são juntadas numa única carta com o número prefixado — três unidades iguais aparecem como <strong>3x</strong> numa carta só em vez de três cópias, com a quantidade de modelos como <strong>[5]</strong> depois do nome. Funciona para qualquer unidade, independentemente da quantidade de modelos, e até três unidades idênticas dividem uma carta (a quarta começa uma nova). Combinar é só cosmético para economizar papel — pontos e equipamento ficam nos valores de uma unidade só. Vem desligado por padrão, então cada unidade aparece na sua própria carta a menos que você ligue.',
  'faq.customQ': 'O que faz "Usar nomes personalizados das unidades"?',
  'faq.customA':
    'Com esta opção ligada, uma unidade que você renomeou no Army Forge mostra esse nome personalizado (ex.: <strong>Frodo</strong>) como título da carta, e o nome original do livro vai para o subtítulo. Vem ligado por padrão; desligue para mostrar o nome padrão do livro como título.',
  'faq.printQ': 'Como imprimo?',
  'faq.printA':
    'Clique em <strong>Imprimir</strong>. Use as caixas de seleção acima das cartas para escolher o que vai na página: as cartas, a tabela de regras especiais e a tabela de magias.',
  'faq.downloadQ': 'Como baixo as cartas?',
  'faq.downloadA': 'Cada carta tem um botão <strong>PNG</strong> para baixá-la individualmente.',
  'faq.listsQ': 'O que é "Minhas listas"?',
  'faq.listsA':
    'Toda lista que você gera é salva automaticamente no seu dispositivo. Em <strong>Minhas listas</strong> você pode <strong>Carregar</strong> uma na hora a partir da sua cópia salva, <strong>Atualizar</strong> para buscar a versão mais recente no Army Forge (só acontece quando você clica), ou <strong>Excluir</strong>. Carregar uma lista também restaura as opções que você tinha definido para ela (como <strong>Combinar unidades iguais</strong>).',

  'changelog.title': 'Novidades',
  'changelog.intro': 'Novidades no OPR Card Generator - Redesign. Mais recentes primeiro.',

  'about.title': 'Sobre',
  'about.lead':
    'Um pequeno app web que transforma uma lista compartilhada do <a href="https://army-forge.onepagerules.com" target="_blank" rel="noopener">Army Forge</a> em cartas de unidade imprimíveis para jogos <a href="https://onepagerules.com" target="_blank" rel="noopener">OnePageRules</a>.',
  'about.text1':
    'Cole um link de exército compartilhado, receba uma carta por unidade (atributos, regras especiais, armas), além de uma tabela combinada de regras especiais e uma tabela de magias — prontos para imprimir ou baixar como PNGs.',
  'about.note':
    '<strong>Nota:</strong> uma lista só carrega se você compartilhou no Army Forge — abra seu exército e clique em <strong>“Share as Link”</strong> primeiro. Listas privadas (não compartilhadas) não podem ser lidas.',
  'about.forkText':
    '<strong>Este projeto é um fork do OPR Card Generator, criado por JeanOmeg.</strong> Obrigado, JeanOmeg, por criar e compartilhar o projeto original com a comunidade.',
  'about.forkRepo': '<a href="https://github.com/JeanOmeg/opr-card-generator" target="_blank" rel="noopener">Repositório original no GitHub</a>',
  'about.forkSite': '<a href="https://jeanomeg.github.io/opr-card-generator/" target="_blank" rel="noopener">Acessar o app original</a>',
  'about.forkIssues': '<a href="https://github.com/JeanOmeg/opr-card-generator/issues" target="_blank" rel="noopener">Problemas e sugestões</a>',
  'about.forkReleases': '<a href="https://github.com/JeanOmeg/opr-card-generator/releases" target="_blank" rel="noopener">Versões do projeto original</a>',
  'about.forkLicense': '<a href="https://github.com/JeanOmeg/opr-card-generator/blob/master/LICENSE" target="_blank" rel="noopener">Licença do projeto original</a>',
  'about.forkAuthor': '<a href="https://github.com/JeanOmeg" target="_blank" rel="noopener">JeanOmeg no GitHub</a>',
  'about.features': 'Recursos',
  'about.featureCards': 'Uma carta imprimível por unidade: Qualidade / Defesa / Resistência, regras especiais, armas, notas.',
  'about.featureTables':
    'Tabela combinada de <strong>regras especiais</strong> (incluindo descrições de regras centrais/comuns) e uma <strong>tabela de magias</strong> para conjuradores.',
  'about.featureBg':
    'Imagem de <strong>fundo por carta</strong> (até 2 MB) com posicionamento por arrasto ou controles deslizantes, zoom por rolagem/controle, opacidade e centralização — salva no seu dispositivo por unidade e mantida entre atualizações.',
  'about.featurePrint':
    'Layout de <strong>impressão</strong> (escolha cartas / regras / magias) e download em <strong>PNG</strong> (individual).',
  'about.featureLists':
    '<strong>Minhas listas</strong> — toda lista gerada é salva localmente no seu dispositivo para você recarregar na hora, atualizar quando quiser ou excluir.',
  'about.featureCache':
    '<strong>Carregamento com cache primeiro</strong> — Gerar cartas abre uma lista já carregada na hora a partir da sua cópia salva (funciona offline); use <strong>Atualizar lista</strong> para buscar a versão mais recente no Army Forge.',
  'about.featurePages': 'Páginas de <strong>FAQ</strong>, <strong>Novidades</strong> e <strong>Sobre</strong>.',
  'about.disclaimer': 'Aviso',
  'about.disclaimer1':
    'Este é um <strong>projeto gratuito e sem fins lucrativos, feito por um fã, para fãs</strong>. Não é afiliado, endossado ou patrocinado pelo OnePageRules.',
  'about.disclaimer2':
    'OnePageRules e todos os seus sistemas de jogo, regras e conteúdo (Grimdark Future, Age of Fantasy e outros) são propriedade do <strong>OnePageRules</strong>. Esta ferramenta só ajuda jogadores a exibir suas próprias listas de exército e é oferecida gratuitamente para uso comunitário não comercial.',
  'about.license': 'Licença',
  'about.licenseText':
    'Licenciado sob a <strong>PolyForm Noncommercial License 1.0.0</strong> — livre para usar, copiar, modificar e compartilhar para qualquer finalidade não comercial. Uso comercial, incluindo monetizar o projeto de qualquer forma, não é permitido.',
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
  root.querySelectorAll<HTMLElement>('[data-i18n-html]').forEach((el) => {
    el.innerHTML = t(el.dataset.i18nHtml as Key);
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
