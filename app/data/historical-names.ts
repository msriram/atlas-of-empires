// Labels and search names are separate from territorial geometry. A period name
// never creates a new polygon or changes an existing outline.
export type HistoricalPeriod = {
  name: string;
  sourceName: string;
  start: number;
  end: number; // exclusive; a negative year is BCE
  focusYear: number;
  aliases: readonly string[];
  source: string;
  note: string;
};

export const historicalPeriods: readonly HistoricalPeriod[] = [
  {name:'Old Kingdom of Egypt',sourceName:'Egypt',start:-2686,end:-2181,focusYear:-2500,aliases:['Old Kingdom','Egypt Old Kingdom'],source:'https://egymonuments.gov.eg/en/historical-periods/old-kingdom',note:'The period dates are documented; the colored area follows the coarse Egypt source outline, not a surveyed Old Kingdom border.'},
  {name:'Middle Kingdom of Egypt',sourceName:'Egypt',start:-2055,end:-1650,focusYear:-1900,aliases:['Middle Kingdom','Egypt Middle Kingdom'],source:'https://egymonuments.gov.eg/en/historical-periods/middle-kingdom',note:'The period dates are documented; the colored area follows the coarse Egypt source outline, not a surveyed Middle Kingdom border.'},
  {name:'New Kingdom of Egypt',sourceName:'Egypt',start:-1550,end:-1069,focusYear:-1300,aliases:['New Kingdom','Egypt New Kingdom'],source:'https://egymonuments.gov.eg/historical-periods/new-kingdom/',note:'The period dates are documented; the colored area follows the coarse Egypt source outline, not a surveyed New Kingdom border.'},
  {name:'Songhai Empire',sourceName:'Songhai',start:1464,end:1591,focusYear:1530,aliases:['Songhay','Sunghai','Songhay Empire','Sunghai Empire'],source:'https://www.metmuseum.org/ru/toah/ht/07/afu.html',note:'The empire name follows its historical period. Its colored area remains the approximate Songhai source outline; later source maps also retain the Songhai label.'},
];

// Existing source maps use some names that readers may not know or may spell differently.
// Focus years land on dated maps, where these historical states are represented.
export const searchAliases: readonly {name:string; aliases:readonly string[]; focusYear:number}[] = [
  {name:'Axum',aliases:['Aksum','Kingdom of Aksum','Aksumite Empire'],focusYear:400},
  {name:'Kush',aliases:['Kingdom of Kush','Nubian Kush'],focusYear:-700},
  {name:'Empire of Ghana',aliases:['Ghana Empire','Wagadu'],focusYear:700},
  {name:'Mali',aliases:['Mali Empire'],focusYear:1300},
  {name:'Kanem-Bornu',aliases:['Bornu Empire','Kanem Bornu Empire'],focusYear:1500},
  {name:'Benin',aliases:['Kingdom of Benin','Benin Empire'],focusYear:1500},
  {name:'Great Zimbabwe',aliases:['Kingdom of Zimbabwe'],focusYear:1300},
  {name:'Oyo',aliases:['Oyo Empire'],focusYear:1700},
  {name:'Dahomey',aliases:['Kingdom of Dahomey'],focusYear:1800},
  {name:'Asante',aliases:['Ashanti','Asante Empire','Ashanti Empire'],focusYear:1800},
  {name:'Sokoto Caliphate',aliases:['Sokoto Empire'],focusYear:1880},
  {name:'Congo',aliases:['Kongo','Kingdom of Kongo'],focusYear:1500},
];

export function periodAt(sourceName:string,year:number) {
  return historicalPeriods.find(period=>period.sourceName===sourceName&&year>=period.start&&year<period.end);
}
export function periodNamed(name:string) {
  return historicalPeriods.find(period=>period.name===name);
}
export function searchTerms(name:string):readonly string[] {
  const period=periodNamed(name);
  if(period)return [name,...period.aliases];
  return [name,...(searchAliases.find(entry=>entry.name===name)?.aliases||[])];
}
export function exactAliasFocus(name:string,query:string) {
  const normalized=query.trim().toLocaleLowerCase();
  const period=periodNamed(name);
  if(period&&period.aliases.some(alias=>alias.toLocaleLowerCase()===normalized))return period.focusYear;
  const entry=searchAliases.find(item=>item.name===name);
  return entry?.aliases.some(alias=>alias.toLocaleLowerCase()===normalized)?entry.focusYear:undefined;
}
