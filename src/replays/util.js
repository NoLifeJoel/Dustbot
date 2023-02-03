export default {
  "letterToScore": (letter) => {
    letter = letter.toLowerCase();
    switch (letter) {
      case 's': return 5;
      case 'a': return 4;
      case 'b': return 3;
      case 'c': return 2;
      case 'd': return 1;
      case 'x': return 0;
      default : throw new Error("Couldn't convert letter to score.");
    }
  },
  "scoreToLetter": (score) => {
    score = Number(score);
    switch (score) {
      case 5: return 'S';
      case 4: return 'A';
      case 3: return 'B';
      case 2: return 'C';
      case 1: return 'D';
      case 0: return 'X';
      default: throw new Error("Couldn't convert score to letter.");
    }
  },
  "scoreToIcon": (score) => {
    switch (score) {
      case 5: return '<:S_:401764564699709442>';
      case 4: return '<:A_:401764592575053825>';
      case 3: return '<:B_:401764601215057920>';
      case 2: return '<:C_:401764609721106453>';
      case 1: return '<:D_:401764621746176001>';
      case 0: return 'X';
    }
  },
  "rankToStr": (rank) => {
    if (rank % 100 === 11 || rank % 100 === 12 || rank % 100 === 13) {
      return rank + 'th';
    }
    switch (rank % 10) {
      case 1: return rank + 'st';
      case 2: return rank + 'nd';
      case 3: return rank + 'rd';
      default: return rank + 'th';
    }
  },
  "characterToString": (character) => {
    character = Number(character);
    switch (character) {
      case 0: return 'Dustman';
      case 1: return 'Dustgirl';
      case 2: return 'Dustkid';
      case 3: return 'Dustworth';
      default: return '?';
    }
  },
  "parseTime": (time) => {
    time = Number(time);
    if (time < 0) {
      time *= -1;
    }
    if (time < 10) {
      return '0.00' + time;
    }
    if (time < 100) {
      return '0.0' + time;
    }
    if (time < 1000) {
      return '0.' + time;
    }
    let milliseconds = time.toString().split('');
    milliseconds.splice(0, time.toString().length - 3);
    milliseconds = milliseconds.join('');
    time = time.toString().split('');
    time.splice(time.length - 3, 3);
    time = time.join('');
    let seconds = Math.floor(Number(time)) % 60;
    let minutes = Math.floor(Math.floor(Number(time)) / 60);
    if (minutes > 0) {
      if (seconds < 10) {
        seconds = '0' + seconds.toString();
      } else {
        seconds = seconds.toString();
      }
      return minutes.toString() + ':' + seconds + '.' + milliseconds;
    }
    return seconds.toString() + '.' + milliseconds;
  },
  "characterIcons": (character) => {
    character = Number(character);
    switch (character) {
      case 0: return '401402235004911616';
      case 1: return '401402216272887808';
      case 2: return '401402223357329418';
      case 3: return '401402248040546315';
      case 4: return '401388185826885634';
      case 5: return '401388229653430285';
      case 6: return '401388247910973442';
      case 7: return '401388239866429441';
      default: throw new Error("Couldn't convert character to icon.");
    }
  },
  "level_thumbnails": {
    "abandoned": 'eWp3RMY',
    "abyss": 'ypzgs1o',
    "alcoves": 'SUANvGH',
    "alley": 'Es5vxHT',
    "arena": 'j9ya4Xh',
    "ascent": 'lIviEp3',
    "atrium": '9Eg2vIV',
    "autumnforest": 'U9DHDq8',
    "basement": 'fFnjcTh',
    "boxes": '7NDAcO1',
    "brimstone": 'RVxms8Z',
    "cave": 'KmRNbm7',
    "chemworld": 'Kvoh54U',
    "cityrun": 'ZOmdOjx',
    "cliffsidecaves": 'YICuMqj',
    "clocktower": 'kEQRTcM',
    "concretetemple": 'XK4Fr1I',
    "containment": 'I9eUj9r',
    "control": 'UAjxawK',
    "coretemple": 'yRuwTBV',
    "courtyard": 'cE8egRQ',
    "dahlia": 'ujM1Tg0',
    "den": 'Xoj1heN',
    "development": 'X944JCT',
    "dome": 'DTRGx6B',
    "downhill": '5UsmkRL',
    "exadifficult": 'DtMV2FG',
    "exec func ruin user": '8Pb0Sb9',
    "factory": 'txbHvg7',
    "ferrofluid": 'lShW6Og',
    "fields": 'r2Tj5nn',
    "fireflyforest": '5WlDXb0',
    "garden": 'oNTTbcG',
    "gigadifficult": 'c1wSfce',
    "grasscave": 'V5RStSg',
    "hideout": '8RJsiFI',
    "hyperdifficult": 'TakO1dX',
    "kilodifficult": 'ogTRnqO',
    "library": 'oSDC9E9',
    "mary": 'NoTwC4A',
    "mary2": '7HIOq1u',
    "megadifficult": 'Api1FLF',
    "mezzanine": 'BSXAdfg',
    "momentum": 'UFyr4Kb',
    "momentum2": 'qyDK6m6',
    "moontemple": 'vyuHrBv',
    "newtutorial1": '2wM5lOF',
    "newtutorial2": 'LRNF0Dk',
    "newtutorial3": 'unD0IQc',
    "observatory": 'JR3wcDA',
    "orb": 'fBZr9XP',
    "parapets": 'tXJqpXI',
    "park": 'F2cpFIT',
    "petadifficult": 'sHpu81K',
    "pod": '5W8sH6a',
    "precarious": 'Zb7cnpb',
    "ramparts": 'VPTciAl',
    "satellite": 'vmRemnp',
    "scaffold": 'NQLWqfK',
    "secretpassage": '8bN2Roa',
    "security": 'Babv1e5',
    "shadedgrove": 'eX2ffVa',
    "sprawl": 'fplFqop',
    "summit": 'viHqzN6',
    "suntemple": 'CJfo2o7',
    "teradifficult": 'mmYTTuA',
    "titan": '6Yk8gkR',
    "treasureroom": 'R6FypZd',
    "tunnel": 'nec0DLW',
    "tunnels": 'nLKu2ID',
    "vacantlot": 'kdVWC0q',
    "vat": '94Zmigu',
    "venom": '8z77YJt',
    "wiringfixed": 'DMbZFPT',
    "yottadifficult": 'LoBmUmb',
    "zettadifficult": '85Uxgm4'
  }
};
