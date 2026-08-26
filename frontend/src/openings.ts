export interface OpeningLine {
  id: string;
  name: string;
  eco: string;
  moves: string[]; // SAN, alternating W-B from move 1
  description: string;
  tips: string[];
}

export interface Opening {
  id: string;
  name: string;
  eco: string;
  side: 'white' | 'black';
  category: 'e4' | 'd4' | 'other';
  description: string;
  lines: OpeningLine[];
}

export interface OpeningMatch {
  opening: Opening;
  line: OpeningLine;
  matchedPlies: number;
  /** true if the player left the prepared line before it ended */
  deviated: boolean;
  /** true if the player played the entire prepared line */
  completed: boolean;
}

const MIN_MATCH_PLIES = 4; // require at least 2 full moves before calling it a match

/** Finds the opening line with the longest matching prefix against a played SAN move list. */
export function detectOpening(playedSan: string[]): OpeningMatch | null {
  let best: OpeningMatch | null = null;

  for (const opening of OPENINGS) {
    for (const line of opening.lines) {
      let i = 0;
      while (i < line.moves.length && i < playedSan.length && line.moves[i] === playedSan[i]) i++;
      if (i < MIN_MATCH_PLIES) continue;
      if (!best || i > best.matchedPlies) {
        best = {
          opening,
          line,
          matchedPlies: i,
          deviated: i < line.moves.length && i < playedSan.length,
          completed: i === line.moves.length,
        };
      }
    }
  }

  return best;
}

export const OPENINGS: Opening[] = [

  // ── e4  ·  VIT ────────────────────────────────────────────────────────────

  {
    id: 'ruy-lopez',
    name: 'Ruy López',
    eco: 'C60',
    side: 'white',
    category: 'e4',
    description: 'En av schackets äldsta öppningar. Bb5 skapar långsiktig press mot e5 och förbereder en stabil centrumuppbyggnad med c3+d4.',
    lines: [
      {
        id: 'ruy-morphy',
        name: 'Morphy-försvaret (Huvudlinjen)',
        eco: 'C88',
        moves: ['e4','e5','Nf3','Nc6','Bb5','a6','Ba4','Nf6','O-O','Be7','Re1','b5','Bb3','d6','c3','O-O'],
        description: 'Svart spelar a6 och b5 för att pressa bort löparen. Vit bygger centrum med c3 och planerar d4.',
        tips: [
          'Ba4 behåller trycket — vit vill inte byta bort löparen ännu',
          'Re1 stöder e4 och förbereder det tematiska d4',
          'c3 förbereder d4 och skapar ett fast centrum',
          'Mål: stöta fram d4 och skapa ett överläge i centrum',
        ],
      },
      {
        id: 'ruy-berlin',
        name: 'Berlinförsvaret',
        eco: 'C67',
        moves: ['e4','e5','Nf3','Nc6','Bb5','Nf6','O-O','Nxe4','d4','Nd6','Bxc6','dxc6','dxe5','Nf5'],
        description: 'Berlinmuren — svart byter e-bonde mot d-bonde och siktar på ett solitt slutspel. Favoritvapen mot Ruy López på toppnivå.',
        tips: [
          'Nxe4 erövrar e4-bonden temporärt',
          'd4 attackerar Nxe4 och öppnar diagonaler',
          'Bxc6 ger svart strukturskada men stark springer',
          'Svart har ett mycket fast slutspel trots de dubblade bonderna',
        ],
      },
      {
        id: 'ruy-exchange',
        name: 'Utbytesvarianten',
        eco: 'C68',
        moves: ['e4','e5','Nf3','Nc6','Bb5','a6','Bxc6','dxc6','Nxe5','Qd4','Nf3','Qxe4+','Qe2','Qxe2+'],
        description: 'Vit byter löparen mot springaren och tar e5. Svart kompenserar med aktivt spel och dams aktivitet.',
        tips: [
          'Bxc6 ger svart dubblad c-bonde men öppnar spelet',
          'Nxe5 vinner en bonde temporärt',
          'Svart tar tillbaka med Qd4 och vinner tillbaka bonden',
          'Vit siktar på att utnyttja de svaga c-bonderna på sikt',
        ],
      },
      {
        id: 'ruy-schliemann',
        name: 'Schliemann-gambit',
        eco: 'C63',
        moves: ['e4','e5','Nf3','Nc6','Bb5','f5','Nc3','fxe4','Nxe4','d5','Ng3','e4','Ne5','Nf6'],
        description: 'Svart spelar f5! — ett aggressivt kontragambit som ger upp bondestruktur för skarpt initiativ.',
        tips: [
          'f5 är ett aggressivt kontragambit mot Ruy López',
          'Svart accepterar strukturskada för snabbt initiativ',
          'Nxe4 tar tillbaka bonden med springer',
          'd5 attackerar springaren och öppnar centrum',
        ],
      },
    ],
  },

  {
    id: 'italian',
    name: 'Italienska partiet',
    eco: 'C50',
    side: 'white',
    category: 'e4',
    description: 'Bc4 siktar mot f7 och bygger trycket i centrum. Kan leda till lugnt positionsspel (Giuoco Piano) eller skarpa gambits.',
    lines: [
      {
        id: 'italian-giuoco',
        name: 'Giuoco Piano',
        eco: 'C54',
        moves: ['e4','e5','Nf3','Nc6','Bc4','Bc5','c3','Nf6','d4','exd4','cxd4','Bb4+','Nc3','Nxe4','O-O'],
        description: 'c3+d4 skapar ett starkt centrum. Svart tar med Bb4+ och Nxe4 men vit kompenserar med snabb pjäsutveckling.',
        tips: [
          'c3 förbereder d4-framstöten',
          'd4 öppnar centrum och skapar aktiv spel',
          'Nc3 blockerar check och stöder centrum',
          'O-O ger kungsäkerhet och ett aktivt torn på e1',
        ],
      },
      {
        id: 'italian-evans',
        name: 'Evans gambit',
        eco: 'C51',
        moves: ['e4','e5','Nf3','Nc6','Bc4','Bc5','b4','Bxb4','c3','Ba5','d4','exd4','O-O'],
        description: 'b4! — ett romantiskt gambit. Vit offrar en bonde för häftig attack och överväldigande centrumkontroll.',
        tips: [
          'b4 erbjuds — tar svart med Bxb4?',
          'c3 förbereder d4 och stöder centrum',
          'd4 öppnar centrum med ytterligare material',
          'O-O ger kungsäkerhet och stark angreppsmöjlighet',
        ],
      },
      {
        id: 'italian-two-knights',
        name: 'Tvåriddarvarianten',
        eco: 'C58',
        moves: ['e4','e5','Nf3','Nc6','Bc4','Nf6','Ng5','d5','exd5','Na5','Bb5+','c6','dxc6','bxc6','Be2','h6','Nf3','e4'],
        description: 'Nf6 utmanar vit direkt. Ng5 hotar Nxf7 (fork mot dam och torn). Skarpt och taktiskt från drag 4.',
        tips: [
          'Ng5 hotar Nxf7 — fork mot dam och torn!',
          'd5 är det starkaste svaret — attackerar Bc4',
          'Bb5+ ger schack och vinner ett tempo',
          'dxc6 skapar strukturskada men svart har aktiv pjäsutveckling',
        ],
      },
    ],
  },

  {
    id: 'kings-gambit',
    name: 'Konungsgambit',
    eco: 'C30',
    side: 'white',
    category: 'e4',
    description: 'f4! — vit offrar en bonde för snabbt centrum och attackchans. En av schackets mest romantiska öppningar.',
    lines: [
      {
        id: 'kga-classical',
        name: 'Accepterat — Klassisk variant',
        eco: 'C37',
        moves: ['e4','e5','f4','exf4','Nf3','g5','h4','g4','Ne5','Nf6','Bc4','d5','exd5','Bd6'],
        description: 'Svart accepterar gambitet och spelar g5 för att behålla bonden. Vit offrar mer material för ett häftigt anfall.',
        tips: [
          'f4 erbjuder bonde — tar svart?',
          'g5 försvarar f4-bonden men försvagar kungssidan',
          'h4 angriper g5-bonden direkt',
          'Ne5 är ett kraftfullt svar — hotar Nxf7 och Nxg4',
        ],
      },
      {
        id: 'kga-fischer',
        name: 'Accepterat — Fischers försvar',
        eco: 'C34',
        moves: ['e4','e5','f4','exf4','Nf3','d6','d4','Nf6','Nc3','g5','g3','fxg3','hxg3'],
        description: 'd6 — Fischers rekommendation. Solitt och aktivt svar som undviker de skarpa g5-varianterna.',
        tips: [
          'd6 är Fischers rekommendation — solid och aktiv',
          'd4 bygger centrumkontroll',
          'Nc3 stöder centrum och förbereder Bc4',
          'g3 utmanar svarts f4-bonde och öppnar g-linjen',
        ],
      },
      {
        id: 'kgd-classical',
        name: 'Avböjt — Klassisk variant',
        eco: 'C30',
        moves: ['e4','e5','f4','Bc5','Nf3','d6','c3','Nf6','d4','exd4','cxd4','Bb6'],
        description: 'Bc5 avböjer gambitet — svart bygger fast och solid. Vit bygger centrum ändå med c3+d4.',
        tips: [
          'Bc5 avböjer gambitet och håller pjäsutveckling',
          'Vit svarar med Nf3 och planerar c3+d4 ändå',
          'c3+d4 ger vit centrumkontroll utan gambit',
          'Svart har en fast ställning utan materiell nackdel',
        ],
      },
    ],
  },

  {
    id: 'scotch',
    name: 'Skotska partiet',
    eco: 'C44',
    side: 'white',
    category: 'e4',
    description: 'd4 redan på drag 3 — vit utmanar centrum omedelbart. Leder till öppna taktiska ställningar. Kasparovs favorit.',
    lines: [
      {
        id: 'scotch-classical',
        name: 'Klassisk variant (Bc5)',
        eco: 'C45',
        moves: ['e4','e5','Nf3','Nc6','d4','exd4','Nxd4','Bc5','Be3','Qf6','c3','Nge7','Bc4','O-O','O-O'],
        description: 'Svart svarar Bc5 och utmanar Nd4. Vit stöder med Be3. Leder till ett strategiskt komplext medelspel.',
        tips: [
          'd4 utmanar centrum direkt på drag 3',
          'Nxd4 skapar ett starkt centrum för vit',
          'Be3 stöder Nd4 och kontrollerar c5',
          'Svart bör rocka snabbt och aktivera sina pjäser',
        ],
      },
      {
        id: 'scotch-mieses',
        name: 'Mieses-varianten (Nf6)',
        eco: 'C45',
        moves: ['e4','e5','Nf3','Nc6','d4','exd4','Nxd4','Nf6','Nxc6','bxc6','e5','Qe7','Qe2','Nd5','c4','Ba6'],
        description: 'Nxc6 bxc6 — vit ger svart dubblad c-bonde. e5 driver bort Nf6. Komplicerade ställningar.',
        tips: [
          'Nxc6 bxc6 ger strukturella svagheter för svart',
          'e5 driver bort Nf6 och etablerar starkt rum',
          'Qe2 stöder e5-bonden',
          'c4 angriper Nd5 och skapar en central kil',
        ],
      },
    ],
  },

  {
    id: 'vienna',
    name: 'Wienpartiet',
    eco: 'C25',
    side: 'white',
    category: 'e4',
    description: 'Nc3 stöder centrum och förbereder f4 eller Bc4. Flexibel öppning med gambitvarianter och positionella linjer.',
    lines: [
      {
        id: 'vienna-gambit-acc',
        name: 'Vienngambit — Accepterat',
        eco: 'C29',
        moves: ['e4','e5','Nc3','Nf6','f4','exf4','e5','Ng8','Nf3','d6','d4','dxe5','Nxe5'],
        description: 'f4 erbjuder gambit. Svart tar och vit driver springaren tillbaka med e5. Initiativ och snabb pjäsutveckling.',
        tips: [
          'Nc3 stöder e4 och förbereder f4',
          'f4 erbjuder gambit för centrumkontroll',
          'e5 driver Nf6 tillbaka efter exf4',
          'Nxe5 återtar bonden med stark springer i centrum',
        ],
      },
      {
        id: 'vienna-gambit-dec',
        name: 'Vienngambit — Avböjt (Steinitz)',
        eco: 'C29',
        moves: ['e4','e5','Nc3','Nf6','f4','d5','fxe5','Nxe4','Nxe4','dxe4','d3','Bc5','dxe4'],
        description: 'd5! — Steinitz avböjer gambitet och utmanar centrum direkt. Svart får aktiv ställning.',
        tips: [
          'd5 avböjer gambitet och attackerar e4',
          'fxe5 är det bästa svaret',
          'Nxe4 och dxe4 utbyter centrumbönder',
          'Svart kompenserar med stark löpare och aktiva pjäser',
        ],
      },
      {
        id: 'vienna-classical',
        name: 'Klassisk variant (Nc6+Bc4)',
        eco: 'C25',
        moves: ['e4','e5','Nc3','Nc6','Bc4','Bc5','Qg4','Nf6','Qxg7','Rg8','Qxh7','Nxe4','Qh5','Nxc3','bxc3','Rxg2'],
        description: 'Bc4 och sedan Qg4 skapar omedelbar spänning. Mycket taktisk och rolig öppning!',
        tips: [
          'Bc4 riktar sig mot det svaga f7',
          'Qg4 angriper g7 och skapar dubbelattack',
          'Svart bör spela Nf6 för att attackera damen',
          'Mycket taktisk — kräver god beräkning',
        ],
      },
      {
        id: 'vienna-falkbeer',
        name: 'Falkbeer-varianten (f5)',
        eco: 'C25',
        moves: ['e4','e5','Nc3','f5','exf5','e4','d3','exd3','Bxd3','Nf6','Nge2','d5','O-O','Bc5'],
        description: 'f5! — svart kontraattackerar omedelbart och skapar asymmetrisk komplex ställning.',
        tips: [
          'f5 är svarts aggressiva kontragambit',
          'e4 efter fxe5 ger svart stark centrumkontroll',
          'd3 attackerar e4-bonden',
          'Svart kompenserar med snabb pjäsutveckling',
        ],
      },
    ],
  },

  {
    id: 'four-knights',
    name: 'Fyraspringare',
    eco: 'C47',
    side: 'white',
    category: 'e4',
    description: 'Alla fyra springarna ut tidigt. Solid och symmetrisk. Kan leda till Spanska varianten eller Scotch Fourknights.',
    lines: [
      {
        id: 'four-knights-spanish',
        name: 'Spansk variant',
        eco: 'C48',
        moves: ['e4','e5','Nf3','Nc6','Nc3','Nf6','Bb5','Nd4','Nxd4','exd4','e5','dxc3','exf6','Qxf6','dxc3','Qe5+','Be2'],
        description: 'Bb5 ger en Ruy López-liknande ställning men med springare på f6. Vit spelar e5 och tar tillbaka material.',
        tips: [
          'Bb5 kombinerar Ruy López-idéer med Fyraspringare',
          'e5 driver Nf6 och öppnar spelet',
          'Vit ger upp bonde men vinner aktivitet',
          'Slutspelet gynnar ofta vit tack vare aktivare pjäser',
        ],
      },
      {
        id: 'four-knights-scotch',
        name: 'Skotsk variant',
        eco: 'C47',
        moves: ['e4','e5','Nf3','Nc6','Nc3','Nf6','d4','exd4','Nxd4','Bb4','Nxc6','bxc6','Bd3','d5','exd5','cxd5'],
        description: 'd4 öppnar centrum med alla fyra springarna aktiva. Dynamiskt och öppet spel.',
        tips: [
          'd4 öppnar centrum omedelbart',
          'Nxd4 skapar ett starkt centrum',
          'Nxc6 bxc6 ger strukturella komplikationer',
          'Bd3 stöder centrum och förbereder O-O',
        ],
      },
    ],
  },

  // ── e4  ·  SVART ──────────────────────────────────────────────────────────

  {
    id: 'sicilian',
    name: 'Sicilianskt försvar',
    eco: 'B20',
    side: 'black',
    category: 'e4',
    description: 'Svarts mest populära svar mot e4. Asymmetriska ställningar ger svart chanser att spela om vinst.',
    lines: [
      {
        id: 'sicilian-najdorf',
        name: 'Najdorf-varianten',
        eco: 'B90',
        moves: ['e4','c5','Nf3','d6','d4','cxd4','Nxd4','Nf6','Nc3','a6','Be3','e5','Nb3','Be6','f3','Be7','Qd2','O-O'],
        description: 'a6 — Najdorfs signaturmov. Förbereder b5 och håller Nc5 vid liv. Favoritvapnet för Fischer och Kasparov.',
        tips: [
          'c5 utmanar d4 utan att spegla centrum',
          'a6 hindrar Bb5 och förbereder ...b5',
          'Svart planerar ...b5-b4 och drottningsflanksexpansion',
          'Kräver god öppningsteori — vit kan spela Engelsk attack (Be3+f3+g4)',
        ],
      },
      {
        id: 'sicilian-dragon',
        name: 'Draken',
        eco: 'B76',
        moves: ['e4','c5','Nf3','d6','d4','cxd4','Nxd4','Nf6','Nc3','g6','Be3','Bg7','f3','O-O','Qd2','Nc6','O-O-O','d5'],
        description: 'g6+Bg7 — Draken. Stark diagonal för löparen. Vit rockar damsidan, svart kungssidan — race om vem som slår in!',
        tips: [
          'g6 förbereder den kraftfulla dragonlöparen på g7',
          'O-O-O vs O-O — attack på varsitt håll',
          'd5 är svarts tematiska kontraattack',
          'Ytterst dynamisk — exakt spel krävs av båda',
        ],
      },
      {
        id: 'sicilian-scheveningen',
        name: 'Scheveningenvarianten',
        eco: 'B84',
        moves: ['e4','c5','Nf3','d6','d4','cxd4','Nxd4','Nf6','Nc3','e6','Be2','a6','O-O','Be7','f4','O-O','Kh1'],
        description: 'e6 — solid och flexibel. Svart bygger en fast ställning utan att ta risker. Karpov spelade den framgångsrikt.',
        tips: [
          'e6 skapar fast struktur men stänger in c8-löparen',
          'a6 hindrar Bb5 och förbereder ...b5',
          'Be7 — solid och stabil pjäsutveckling',
          'f4 är vitts tematiska svar — attack på kungssidan',
        ],
      },
      {
        id: 'sicilian-classical',
        name: 'Klassisk variant (Nc6)',
        eco: 'B62',
        moves: ['e4','c5','Nf3','Nc6','d4','cxd4','Nxd4','Nf6','Nc3','d6','Bg5','e6','Qd2','Be7','O-O-O','O-O'],
        description: 'Nc6 — klassisk och solid. Bg5 skapar tryck mot Nf6. Svart kastar om till damsidan med O-O-O.',
        tips: [
          'Nc6 kontrollerar d4 och stöder centrum',
          'Bg5 pinnar Nf6 och ökar trycket på e6',
          'Svart kan byta med ...Bxg5 för att förenkla',
          'O-O-O vs O-O — återigen race om flankattack',
        ],
      },
    ],
  },

  {
    id: 'french',
    name: 'Franskt försvar',
    eco: 'C00',
    side: 'black',
    category: 'e4',
    description: 'Solid och strategisk. e6+d5 bygger ett fast centrum. Svart planerar att spränga det med ...c5 eller ...f6.',
    lines: [
      {
        id: 'french-winawer',
        name: 'Winawer-varianten',
        eco: 'C18',
        moves: ['e4','e6','d4','d5','Nc3','Bb4','e5','c5','a3','Bxc3+','bxc3','Ne7','Qg4','O-O'],
        description: 'Bb4 pinnar Nc3 och skapar omedelbar obalans. Svart ger upp löparparet för aktiv motstrategi.',
        tips: [
          'e6 skapar fast struktur i centrum',
          'Bb4 pinnar Nc3 — Winawer-trycket',
          'e5 bygger ett mäktigt rum, c5 angriper d4',
          'Svart bör rocka och förbereda c-linjeangrepp',
        ],
      },
      {
        id: 'french-classical',
        name: 'Klassisk variant (Nf6)',
        eco: 'C11',
        moves: ['e4','e6','d4','d5','Nc3','Nf6','Bg5','Be7','e5','Nfd7','Bxe7','Qxe7','f4','O-O','Nf3','c5'],
        description: 'Nf6 klassisk uppbyggnad. Bg5 pinnar springaren. Vit bygger e5-rum, svart spränger med c5.',
        tips: [
          'Nf6 utmanar e4 och förbereder e5-trycket',
          'Bg5 pinnar Nf6 och ökar centrum-trycket',
          'e5 skapar rum — typisk franskt mönster',
          'c5 är svarts tematiska sprängning av centrum',
        ],
      },
      {
        id: 'french-advance',
        name: 'Avanceringsvarianten',
        eco: 'C02',
        moves: ['e4','e6','d4','d5','e5','c5','c3','Nc6','Nf3','Qb6','Bd3','cxd4','cxd4','Bd7','O-O','Nxd4'],
        description: 'e5 stänger omedelbart — vit bygger ett starkt rum. Svart angriper d4 med c5.',
        tips: [
          'e5 stänger centrum och skapar ett mäktigt rum',
          'c5 är svarts tematiska angrepp mot d4-basen',
          'Qb6 ökar trycket mot d4 och b2',
          'Svart bör hålla koll på d4 och planera ...f6',
        ],
      },
      {
        id: 'french-exchange',
        name: 'Utbytesvarianten',
        eco: 'C01',
        moves: ['e4','e6','d4','d5','exd5','exd5','Nf3','Nf6','Bd3','Bd6','O-O','O-O','Re1','c6'],
        description: 'exd5 befriar svarts löpare från den trånga strukturen. Symmetriskt och relativt öppet.',
        tips: [
          'exd5 frigör svarts c8-löpare — ett plus för svart!',
          'Symmetrisk bondestruktur ger ett friare spel',
          'Svart bör aktivera löparna snabbt med ...Bd6',
          'Ofta ledde detta till ett lugnt positionsspel',
        ],
      },
    ],
  },

  {
    id: 'caro-kann',
    name: 'Caro-Kann',
    eco: 'B10',
    side: 'black',
    category: 'e4',
    description: 'c6+d5 — solid och sund. Svart utmanar centrum med stöd från c6-bonden. Ger en fast bondestruktur utan de nackdelar franskt har.',
    lines: [
      {
        id: 'caro-classical',
        name: 'Klassisk variant',
        eco: 'B19',
        moves: ['e4','c6','d4','d5','Nc3','dxe4','Nxe4','Bf5','Ng3','Bg6','h4','h6','Nf3','Nd7','h5','Bh7','Bd3','Bxd3','Qxd3','e6'],
        description: 'Svart tar dxe4 och placerar Bf5 utanför bondkedjan. En av schackets solidaste ställningar.',
        tips: [
          'dxe4 Nxe4 — svart får Bf5 utanför bondkedjan',
          'Ng3 driver löparen — Bg6 är en bra ruta',
          'h4-h5 angriper löparen men skapar svaga rutor',
          'Svart bör rocka och ha en fast ställning',
        ],
      },
      {
        id: 'caro-advance',
        name: 'Avanceringsvarianten',
        eco: 'B12',
        moves: ['e4','c6','d4','d5','e5','Bf5','Nf3','e6','Be2','Ne7','O-O','h6','Nbd2','Nd7','Nb3','c5'],
        description: 'e5 stänger centrum. Svart spelar Bf5 utanför kedjan och planerar c5.',
        tips: [
          'e5 stänger centrum — vit har ett rum',
          'Bf5 placeras utanför kedjan innan den stängs',
          'Ne7 istället för Nf6 undviker Ng5-taktiker',
          'c5 är svarts tematiska sprängning',
        ],
      },
      {
        id: 'caro-exchange',
        name: 'Utbytesvarianten',
        eco: 'B13',
        moves: ['e4','c6','d4','d5','exd5','cxd5','Bd3','Nc6','c3','Nf6','Bf4','Bg4','Qb3','Qd7','Nd2'],
        description: 'exd5 cxd5 — öppet spel. Svart befrias från trång struktur men vit behåller litet initiativ.',
        tips: [
          'cxd5 (inte exd5) ger svart en öppen c-linje',
          'Svart bör aktivera löparna snabbt',
          'Bf4 + Bd3 är vitts typiska setup',
          'Svart bör rocka tidigt och neutralisera vitts initiativ',
        ],
      },
    ],
  },

  {
    id: 'pirc',
    name: 'Pirc-försvar',
    eco: 'B07',
    side: 'black',
    category: 'e4',
    description: 'Hypermodernt försvar. Svart låter vit bygga ett centrum och angriper det sedan med pjäser och flankangrepp.',
    lines: [
      {
        id: 'pirc-classical',
        name: 'Klassisk variant',
        eco: 'B08',
        moves: ['e4','d6','d4','Nf6','Nc3','g6','Nf3','Bg7','Be2','O-O','O-O','c6','h3','b5','e5','dxe5','dxe5','Nd5'],
        description: 'Svart upptar g6+Bg7-setup och låter vit bygga centrum. Sedan attackeras det med ...c6 och ...b5.',
        tips: [
          'g6+Bg7 — en stark diagonal för löparen',
          'c6 förbereder d5 och stöder centrum',
          'b5 angriper vitts centrum från flanken',
          'Nd5 ger en stark central springer',
        ],
      },
      {
        id: 'pirc-austrian',
        name: 'Österrikisk attack',
        eco: 'B09',
        moves: ['e4','d6','d4','Nf6','Nc3','g6','f4','Bg7','Nf3','O-O','Be2','c5','dxc5','dxc5','Qxd8','Rxd8'],
        description: 'f4 — Österrikisk attack. Vit bygger ett häftigt centralangrepp. Svart svara med c5.',
        tips: [
          'f4 är Österrikisk attack — häftigt centralangrepp',
          'Svart bör svara aktivt med c5 eller e5',
          'Svart siktar på att bryta ned vitts centrum',
          'Bg7 är den kraftfulla pircska löparen',
        ],
      },
    ],
  },

  // ── d4  ·  VIT ────────────────────────────────────────────────────────────

  {
    id: 'queens-gambit',
    name: 'Drottningsgambit',
    eco: 'D06',
    side: 'white',
    category: 'd4',
    description: 'c4 erbjuder bonden för centrumkontroll. Tekniskt inte ett äkta gambit — vit kan alltid återta c4-bonden.',
    lines: [
      {
        id: 'qga',
        name: 'Accepterat (DGA)',
        eco: 'D27',
        moves: ['d4','d5','c4','dxc4','Nf3','Nf6','e3','e6','Bxc4','c5','O-O','a6','Qe2','b5','Bb3','Bb7','Rd1'],
        description: 'Svart tar! Vit återtar med löparen och bygger ett dynamiskt centrum.',
        tips: [
          'dxc4 — svart tar gambitet',
          'e3 öppnar c1-löparen och stöder d4',
          'Bxc4 återtar med löparen på aktiv ruta',
          'c5 är svarts tematiska angrepp mot vitts centrum',
        ],
      },
      {
        id: 'qgd-orthodox',
        name: 'Avböjt — Orthodox (DGD)',
        eco: 'D58',
        moves: ['d4','d5','c4','e6','Nc3','Nf6','Bg5','Be7','e3','O-O','Nf3','Nbd7','Rc1','c6','Bd3','dxc4','Bxc4'],
        description: 'e6 avböjer — svart stöder d5. Bg5 pinnar Nf6. Klassisk och solid uppbyggnad.',
        tips: [
          'e6 stöder d5 och avböjer gambitet',
          'Bg5 pinnar Nf6 mot Be7',
          'c6 stärker d5 och förbereder ...dxc4',
          'Svart planerar ...dxc4 och ...c5',
        ],
      },
      {
        id: 'slav',
        name: 'Slavförsvar',
        eco: 'D17',
        moves: ['d4','d5','c4','c6','Nf3','Nf6','Nc3','dxc4','a4','Bf5','e3','e6','Bxc4','Bb4','O-O','O-O'],
        description: 'c6 stöder d5 utan att stänga in c8-löparen. Solitt, populärt på alla nivåer.',
        tips: [
          'c6 stöder d5 och frigör c8-löparen',
          'dxc4 tar gambitet vid rätt tillfälle',
          'Bf5 — slavlöparen på aktiv ruta utanför bondkedjan',
          'a4 hindrar svarts ...b5 och håller c4-rutan',
        ],
      },
      {
        id: 'catalan',
        name: 'Katalansk',
        eco: 'E05',
        moves: ['d4','d5','c4','e6','Nf3','Nf6','g3','Bb4+','Bd2','Be7','Bg2','O-O','O-O','dxc4','Qc2','a6','Qxc4','b5','Qc2','Bb7'],
        description: 'g3+Bg2 — katalansk löparsetup. Lång diagonal g2-a8 skapar ständigt tryck mot svarts ställning.',
        tips: [
          'g3+Bg2 skapar stark diagonal mot svarts damsida',
          'O-O ger kungsäkerhet och aktiv löpare',
          'dxc4 — svart tar gambitet men hamnar bakom i utveckling',
          'Trycket längs diagonalen är svårt att hantera för svart',
        ],
      },
    ],
  },

  {
    id: 'london',
    name: 'Londonsystemet',
    eco: 'D02',
    side: 'white',
    category: 'd4',
    description: 'Solid och flexibelt. Bf4 etableras tidigt. Ingen specifik öppningsteori att memorera. Passar alla nivåer.',
    lines: [
      {
        id: 'london-main',
        name: 'Huvudlinjen',
        eco: 'D02',
        moves: ['d4','d5','Nf3','Nf6','Bf4','e6','e3','Bd6','Bg3','O-O','Nbd2','c5','c3','Nc6','Bd3','Bxg3','hxg3'],
        description: 'Bf4 etableras tidigt och behålls. e3 + Bd3 skapar en solid formation. Relativt enkelt att lära sig.',
        tips: [
          'Bf4 — positionera löparen utanför bondkedjan tidigt',
          'e3 stöder d4 och öppnar c1-sidan',
          'Bg3 om svart försöker byta bort Bf4',
          'Nbd2 istället för Nc3 håller c3-rutan fri för bonde',
        ],
      },
      {
        id: 'london-vs-kings-indian',
        name: 'London mot KID-setup',
        eco: 'D02',
        moves: ['d4','Nf6','Nf3','g6','Bf4','Bg7','e3','O-O','Be2','d6','O-O','Nbd7','h3','c5','c3','Qb6','Qc1'],
        description: 'Londonssystemet mot KID-uppbyggnad. Vit håller fast strukturen mot svarts dynamiska spel.',
        tips: [
          'Bf4 fungerar även mot KID-setup',
          'Be2 + O-O ger en solid och trygg ställning',
          'h3 hindrar ...Bg4 och behåller kontrollen',
          'Svart försöker bryta med ...c5 eller ...e5',
        ],
      },
    ],
  },

  // ── d4  ·  SVART ──────────────────────────────────────────────────────────

  {
    id: 'kings-indian',
    name: 'Kungaindisk försvar',
    eco: 'E60',
    side: 'black',
    category: 'd4',
    description: 'Svart låter vit bygga ett enormt centrum och angriper det sedan explosivt. Dynamisk och komplex — Fischers, Kasparovs och Bronsteins favoritvapen.',
    lines: [
      {
        id: 'kid-classical',
        name: 'Klassisk variant',
        eco: 'E99',
        moves: ['d4','Nf6','c4','g6','Nc3','Bg7','e4','d6','Nf3','O-O','Be2','e5','O-O','Nc6','d5','Ne7','Ne1','Nd7','Nd3','f5'],
        description: 'Svart kontraattackerar med e5 och f5. Vit attackerar damsidan, svart kungssidan — klassisk KID-race.',
        tips: [
          'g6+Bg7 — KID-löparens kraft',
          'e5 är svarts tematiska kontramov mot d4',
          'd5 stänger centrum — racet börjar!',
          'f5 inleder svarts attack mot kungen',
        ],
      },
      {
        id: 'kid-samisch',
        name: 'Sämisch-varianten',
        eco: 'E80',
        moves: ['d4','Nf6','c4','g6','Nc3','Bg7','e4','d6','f3','O-O','Be3','e5','d5','Nh5','Qd2','f5'],
        description: 'f3 — Sämisch-attacken. Vit bygger ett extra starkt centrum men skapar svagheter. Svart angriper häftigt.',
        tips: [
          'f3 stöder e4 och förbereder g4-h4 anfall',
          'Be3 utvecklar och stöder centrum',
          'e5 och Nh5 inleder svarts kungssideangrepp',
          'f5 öppnar f-linjen mot vitts kung',
        ],
      },
      {
        id: 'kid-four-pawns',
        name: 'Fyrabondsattack',
        eco: 'E76',
        moves: ['d4','Nf6','c4','g6','Nc3','Bg7','e4','d6','f4','O-O','Nf3','c5','d5','e6','Be2','exd5','cxd5'],
        description: 'f4 — vit bygger ett jättelikt bondecentrum med e4-d5-f4. Svart måste motverka aktivt.',
        tips: [
          'f4 skapar ett enormt centrum med fyra centrumbönder',
          'Svart bör attackera det direkt med c5 och e6',
          'exd5 cxd5 öppnar centrum för svarts anfall',
          'Dynamisk och komplex — vit har mer rum, svart aktivare pjäser',
        ],
      },
    ],
  },

  {
    id: 'nimzo-indian',
    name: 'Nimzoindisk försvar',
    eco: 'E20',
    side: 'black',
    category: 'd4',
    description: 'Bb4 pinnar Nc3 och skapar obalans direkt. Svart ger upp löparparet men kompenserar med aktiv pjässpel och starka rutor.',
    lines: [
      {
        id: 'nimzo-classical',
        name: 'Klassisk variant (Qc2)',
        eco: 'E32',
        moves: ['d4','Nf6','c4','e6','Nc3','Bb4','Qc2','O-O','a3','Bxc3+','Qxc3','b6','Bg5','Bb7','e3','d6','Nf3','Nbd7'],
        description: 'Qc2 undviker dubblad bonde. Svart byter ändå och spelar b6+Bb7 för stark diagonal.',
        tips: [
          'Bb4 — Nimzoindisk-kombinationen mot Nc3',
          'Qc2 undviker dubblad bonde efter ...Bxc3+',
          'Bxc3+ ger initiativ men förlorar löparparet',
          'b6+Bb7 skapar en stark diagonal mot e4',
        ],
      },
      {
        id: 'nimzo-rubinstein',
        name: 'Rubinstein-varianten (e3)',
        eco: 'E46',
        moves: ['d4','Nf6','c4','e6','Nc3','Bb4','e3','O-O','Bd3','d5','Nf3','c5','O-O','cxd4','exd4','dxc4','Bxc4','Nc6'],
        description: 'e3 — solid och populärt. Vit bygger ett fast centrum. Svart bör ta tillfällen att utmana med c5.',
        tips: [
          'e3 stöder d4 och öppnar c1-löparen',
          'Bd3 — aktiv ruta för löparen',
          'cxd4 exd4 skapar en klassisk isolad d-bonde',
          'Svart kompenserar med aktiva pjäser mot d4',
        ],
      },
    ],
  },

  {
    id: 'grunfeld',
    name: 'Grünfeldförsvar',
    eco: 'D70',
    side: 'black',
    category: 'd4',
    description: 'Hypermodernt! Svart låter vit bygga ett enormt centrum och angriper det från avstånd med Bg7 och dam. Djupt strategiskt.',
    lines: [
      {
        id: 'grunfeld-exchange',
        name: 'Utbytesvarianten',
        eco: 'D85',
        moves: ['d4','Nf6','c4','g6','Nc3','d5','cxd5','Nxd5','e4','Nxc3','bxc3','Bg7','Nf3','c5','Be3','O-O','Qd2','Qa5'],
        description: 'Svart erbjuder d5, vit bygger ett jättecentrum. Bg7 och damen angriper centrums svaga punkter.',
        tips: [
          'd5 utmanar centrum — Grünfeld-draget!',
          'Nxd5 Nxc3 bxc3 — vit bygger ett massivt centrum',
          'Bg7 är Grünfeldlöparen — skjuter mot c3 och d4',
          'c5 angriper d4 och Qa5 sätter tryck på c3',
        ],
      },
      {
        id: 'grunfeld-russian',
        name: 'Rysk variant',
        eco: 'D97',
        moves: ['d4','Nf6','c4','g6','Nc3','d5','Nf3','Bg7','Qb3','dxc4','Qxc4','O-O','e4','Na6','Be2','c5','d5','e6'],
        description: 'Qb3 + Qxc4 — vit håller ett kraftfullt centrum. Svart angriper med Na6 och c5.',
        tips: [
          'Qb3 pressar d5 och c7 simultaneously',
          'Svart bör svara exakt — dxc4 Qxc4 Na6',
          'c5 angriper d4 och skapar aktivt spel',
          'e6 öppnar för ytterligare sprängning',
        ],
      },
    ],
  },

  {
    id: 'dutch',
    name: 'Holländskt försvar',
    eco: 'A80',
    side: 'black',
    category: 'd4',
    description: 'f5! — svart angriper e4 och förbereder en stark kungssideattack. Obalanserat och riskfullt men aktivt.',
    lines: [
      {
        id: 'dutch-stonewall',
        name: 'Stonewall-varianten',
        eco: 'A92',
        moves: ['d4','f5','Nf3','Nf6','g3','e6','Bg2','Be7','O-O','O-O','c4','d5','Nc3','c6','Bf4','Bd6','Bxd6','Qxd6'],
        description: 'Stonewall — d5+e6+f5+c6. Svart bygger en stensatt formation och attacker kungssidan.',
        tips: [
          'f5 är holländskt — angriper e4 och förbereder anfall',
          'Stonewall-strukturen med d5+e6+f5+c6 ger starkt centrum',
          'Nf6+Be7+O-O — solid uppbyggnad',
          'Svart planerar Ne4 och g5-g4 attack',
        ],
      },
      {
        id: 'dutch-leningrad',
        name: 'Leningrad-varianten',
        eco: 'A87',
        moves: ['d4','f5','Nf3','Nf6','g3','g6','Bg2','Bg7','O-O','O-O','c4','d6','Nc3','Qe8','d5','Na6','Nd4'],
        description: 'g6+Bg7 — Leningrad. Svart kombinerar holländskt med KID-löpare. Dynamisk och häftig.',
        tips: [
          'f5+g6+Bg7 kombinerar holländskt med KID',
          'Svart planerar ...e5 för att öppna centrum',
          'd6 + Qe8 förbereder den tematiska ...e5-framstöten',
          'Nd4 hotar Nc6 och Nxf5',
        ],
      },
    ],
  },

  // ── ANNAT ─────────────────────────────────────────────────────────────────

  {
    id: 'english',
    name: 'Engelska öppningen',
    eco: 'A10',
    side: 'white',
    category: 'other',
    description: 'c4 — flankspel och hypermodernt. Vit kontrollerar d5 utan att ockupera centrum. Flexibelt och strategiskt.',
    lines: [
      {
        id: 'english-symmetrical',
        name: 'Symmetrisk variant',
        eco: 'A30',
        moves: ['c4','c5','Nf3','Nf6','Nc3','Nc6','g3','g6','Bg2','Bg7','O-O','O-O','d3','d6','Bd2','Rb8'],
        description: 'Svart speglar vitts drag — fullständig symmetri. Vit måste hitta sätt att bryta symmetrin.',
        tips: [
          'c4 kontrollerar d5 utan att ta centrum direkt',
          'g3+Bg2 — den engelska fioluppbyggnaden',
          'Symmetri ger svart trygg ställning',
          'Vit brukar bryta med d4 eller b4',
        ],
      },
      {
        id: 'english-four-knights',
        name: 'Fyraspringare-variant',
        eco: 'A28',
        moves: ['c4','e5','Nc3','Nf6','Nf3','Nc6','d4','exd4','Nxd4','Bb4','Bg5','h6','Bh4','Bxc3+','bxc3','Ne5'],
        description: 'Svart spelar e5 — speglar en öppen öppning men med c4 istället för e4. Leder till komplexa ställningar.',
        tips: [
          'e5 i engelska ger en nästan öppen spelstil',
          'Nf6+Nc6 — alla fyra springarna ut tidigt',
          'Svart kan spela Bb4 som i Nimzo',
          'Ne5 ger svart ett starkt centrum',
        ],
      },
    ],
  },

  {
    id: 'reti',
    name: 'Réti-öppningen',
    eco: 'A09',
    side: 'white',
    category: 'other',
    description: 'Nf3 utan d4 — hypermodernt. Vit kontrollerar centrum från avstånd med löpare och springer.',
    lines: [
      {
        id: 'reti-main',
        name: 'Huvudlinjen',
        eco: 'A14',
        moves: ['Nf3','d5','g3','Nf6','Bg2','e6','O-O','Be7','c4','O-O','b3','a5','Bb2','c6','d3','Nbd7'],
        description: 'g3+Bg2 kombinerat med c4 — Réti-systemet. Kontrollerar centrum från avstånd.',
        tips: [
          'Nf3 utan d4 — hypermodernistisk start',
          'g3+Bg2 kontrollerar centrum från avstånd',
          'c4 attackerar d5 indirekt',
          'b3+Bb2 skapar lång diagonal för löparen',
        ],
      },
    ],
  },

  // ── d4  ·  SVART ──────────────────────────────────────────────────────────

  {
    id: 'englund-gambit',
    name: 'Englund-gambit',
    eco: 'A40',
    side: 'black',
    category: 'd4',
    description: 'Ett aggressivt kontragambit mot 1.d4. Svart erbjuder e5-bonden för snabb pjäsutveckling och skarpt initiativ. Vit bör spela 2.dxe5 — om vit är girig riskerar de att hamna i en dålig ställning.',
    lines: [
      {
        id: 'englund-nd5-trap',
        name: 'Nd5-fällan',
        eco: 'A40',
        moves: ['d4','e5','dxe5','Nc6','Nf3','Qe7','Bf4','Qb4+','Nc3','Qxb2','Nd5','Qb4+','c3','Qa5'],
        description: 'Svart vinner b2-bonden med Dxb2, men vit svarar med det kraftfulla Sd5! som hotar matt. Svart måste navigera försiktigt med Db4+ och Dd5.',
        tips: [
          'Qe7 förbereder att ta tillbaka på e5 och håller bonden under press',
          'Qb4+ tvingar vit att svara och öppnar för Qxb2',
          'Qxb2 vinner en bonde men Nd5! hotar omedelbart matt på c7',
          'Qb4+ är det enda draget — damen måste fly från d5-springarens trussel',
          'Qa5 är säkraste reträtten; svart har vunnit en bonde men ställningen är skarp',
        ],
      },
      {
        id: 'englund-mednis',
        name: 'Mednis-varianten',
        eco: 'A40',
        moves: ['d4','e5','dxe5','Nc6','Nf3','Qe7','Nc3','Nxe5','Nxe5','Qxe5','e4','Nf6','Bd3','d6','O-O','Be7'],
        description: 'Svart byter bort springarna och tar tillbaka e5-bonden med damen. Ger ett solid och något jämnt spel med aktiv dam.',
        tips: [
          'Nxe5 byter omedelbart och återvinner bonden',
          'Qxe5 centraliserar damen och skapar press',
          'Nf6 driver damen och fortsätter utvecklingen',
          'd6 stöder centrum och öppnar löparens diagonal',
          'O-O ger säker kung och normal ställning för svart',
        ],
      },
      {
        id: 'englund-soller',
        name: 'Söller-gambit',
        eco: 'A40',
        moves: ['d4','e5','dxe5','Nc6','Nf3','Bc5','Bg5','f6','exf6','Nxf6','e3','O-O','Be2','d5','O-O','Bg4'],
        description: 'Svart spelar Lc5 istället för De7 och angriper f2. f6 öppnar f-linjen och ger kompensation för bonden med snabbt anfall.',
        tips: [
          'Bc5 riktar in sig på f2 och förbereder snabb rockad',
          'f6 attackerar e5-bonden och öppnar f-linjen för tornet',
          'Nxf6 återvinner bonden med springer och håller aktiviteten',
          'd5 skapar starkt centrum och öppnar löparen på c8',
          'Bg4 spikar f3-springaren och förbereder taktiskt anfall',
        ],
      },
    ],
  },

];
