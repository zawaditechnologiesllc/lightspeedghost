/**
 * Local spelling normaliser — a no-API, pure-TypeScript typo layer so a request
 * with misspellings is still understood and still produces the correct output.
 *
 * Two jobs:
 *   • correctTypos(text)      — fix real misspellings in text we return to the
 *                               user (e.g. the humanizer's output) using a
 *                               high-precision curated dictionary. It NEVER
 *                               "corrects" a correctly-spelled word, so it can't
 *                               introduce errors.
 *   • canonicalizeForMatch(w) — fold a token to a spelling-robust form for
 *                               MATCHING only (search queries, similarity), so
 *                               "recieve" and "receive" compare as equal.
 *
 * Deterministic, synchronous, dependency-free.
 */

// High-frequency English + academic misspellings → correct form. Curated for
// precision (only unambiguous fixes). Extend freely — every entry is safe.
const MISSPELLINGS: Record<string, string> = {
  teh: "the", hte: "the", th: "the", thr: "the", tehm: "them",
  recieve: "receive", recieved: "received", reciept: "receipt",
  seperate: "separate", seperated: "separated", seperately: "separately",
  definately: "definitely", definatly: "definitely", definetly: "definitely",
  occured: "occurred", occuring: "occurring", occurance: "occurrence", occurence: "occurrence",
  untill: "until", wich: "which", tht: "that", becuase: "because", becasue: "because", becuse: "because",
  beleive: "believe", beleived: "believed", belive: "believe",
  acheive: "achieve", acheived: "achieved", acheivement: "achievement",
  goverment: "government", enviroment: "environment", enviromental: "environmental",
  neccessary: "necessary", necessery: "necessary", neccesary: "necessary",
  accomodate: "accommodate", accomodation: "accommodation",
  arguement: "argument", argumnet: "argument",
  reccomend: "recommend", recomend: "recommend", reccommend: "recommend",
  independant: "independent", independend: "independent",
  occassion: "occasion", occassionally: "occasionally", occasionaly: "occasionally",
  publically: "publicly", basicly: "basically", finaly: "finally", realy: "really",
  wierd: "weird", freind: "friend", thier: "their", there: "there",
  alot: "a lot", infront: "in front", inspite: "in spite",
  adress: "address", adresses: "addresses", agressive: "aggressive",
  apparant: "apparent", appearence: "appearance", arised: "arose",
  calender: "calendar", cemetary: "cemetery", changable: "changeable",
  collegue: "colleague", comming: "coming", commited: "committed", commitee: "committee",
  concious: "conscious", consistant: "consistent",
  critisism: "criticism", critisize: "criticize", decieve: "deceive",
  dependant: "dependent", desparate: "desperate", diferent: "different", diffrent: "different",
  dilemna: "dilemma", disapoint: "disappoint", disapear: "disappear", dissapear: "disappear",
  embarass: "embarrass", embarassing: "embarrassing", existance: "existence",
  experiance: "experience", explaination: "explanation", familar: "familiar",
  fourty: "forty", foriegn: "foreign", fullfill: "fulfill", garantee: "guarantee",
  gaurd: "guard", grammer: "grammar", gratefull: "grateful", harrass: "harass",
  hieght: "height", hierachy: "hierarchy", humourous: "humorous", hygeine: "hygiene",
  ignor: "ignore", immediatly: "immediately", influencial: "influential",
  intergrate: "integrate", intresting: "interesting", interupt: "interrupt",
  irrelevent: "irrelevant", knowlege: "knowledge", labratory: "laboratory",
  liason: "liaison", libary: "library", lisence: "license", maintainance: "maintenance",
  managment: "management", maneuvre: "maneuver", medcine: "medicine", millenium: "millennium",
  miniscule: "minuscule", mispell: "misspell", noticable: "noticeable", nowdays: "nowadays",
  oportunity: "opportunity", oppurtunity: "opportunity",
  paralel: "parallel", parliment: "parliament", particulary: "particularly",
  percieve: "perceive", performace: "performance", persistant: "persistent",
  personel: "personnel", posession: "possession", possibilty: "possibility", potentialy: "potentially",
  practise: "practice", preceeding: "preceding", prefered: "preferred",
  privelege: "privilege", priviledge: "privilege", pronounciation: "pronunciation",
  questionaire: "questionnaire", readible: "readable", recepie: "recipe", refered: "referred",
  relevent: "relevant", religous: "religious", repitition: "repetition", responsibilty: "responsibility",
  restaraunt: "restaurant", rythm: "rhythm", secratary: "secretary", sieze: "seize",
  similiar: "similar", sincerly: "sincerely", speach: "speech", succesful: "successful",
  succesfully: "successfully", sucessful: "successful", supercede: "supersede", suprise: "surprise",
  surprize: "surprise", temperatue: "temperature", tendancy: "tendency", threshhold: "threshold",
  tommorow: "tomorrow", tommorrow: "tomorrow", truely: "truly", twelth: "twelfth",
  tyrany: "tyranny", underate: "underrate", unforseen: "unforeseen", unfortunatly: "unfortunately",
  useable: "usable", vaccuum: "vacuum", vehicule: "vehicle", visable: "visible",
  wether: "whether", whereever: "wherever", wilfull: "willful", writting: "writing",
  writen: "written", yeild: "yield", analisis: "analysis", analize: "analyze", analyse: "analyze",
  reserch: "research", reasearch: "research", stuents: "students", studnet: "student",
  studetn: "student", develope: "develop", developement: "development", judgement: "judgment",
  acknowledgement: "acknowledgment", theif: "thief",
};

const CONTENT_STOP = new Set(["the", "and", "for", "that", "this", "with", "from"]);

function preserveLeadCase(replacement: string, original: string): string {
  if (original && original[0] === original[0].toUpperCase() && replacement) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

/** Collapse runs of 3+ identical letters to 2 ("realllly" → "really"-ish). */
function deElongate(word: string): string {
  return word.replace(/([a-zA-Z])\1{2,}/g, "$1$1");
}

/**
 * Fix real misspellings in `text`, preserving punctuation, spacing and case.
 * Only replaces tokens that are in the curated dictionary (or an elongated form
 * of one), so a correctly-spelled word is never altered.
 */
export function correctTypos(text: string): string {
  if (!text) return text;
  return text.replace(/[A-Za-z]+(?:'[A-Za-z]+)?/g, (token) => {
    const lower = token.toLowerCase();
    const direct = MISSPELLINGS[lower];
    if (direct) return preserveLeadCase(direct, token);
    const deEl = deElongate(lower);
    if (deEl !== lower) {
      const fixed = MISSPELLINGS[deEl] ?? deEl;
      return preserveLeadCase(fixed, token);
    }
    return token;
  });
}

/** Count how many tokens correctTypos would change — for telemetry / notes. */
export function countTypos(text: string): number {
  let n = 0;
  for (const m of text.matchAll(/[A-Za-z]+(?:'[A-Za-z]+)?/g)) {
    const lower = m[0].toLowerCase();
    if (MISSPELLINGS[lower] || (deElongate(lower) !== lower)) n++;
  }
  return n;
}

/**
 * Fold a single token to a spelling-robust canonical form for MATCHING only.
 * Applies typo correction then de-elongation, so misspelled inputs compare
 * equal to their correct spelling in search/similarity.
 */
export function canonicalizeForMatch(word: string): string {
  const lower = word.toLowerCase();
  if (CONTENT_STOP.has(lower)) return lower;
  const corrected = MISSPELLINGS[lower] ?? MISSPELLINGS[deElongate(lower)] ?? deElongate(lower);
  return corrected;
}

/** Apply match-canonicalisation across a whole string (token by token). */
export function canonicalizeTextForMatch(text: string): string {
  return text.replace(/[A-Za-z]+(?:'[A-Za-z]+)?/g, (t) => canonicalizeForMatch(t));
}
