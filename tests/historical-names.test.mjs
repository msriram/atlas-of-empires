import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {displayName,colorKey} from '../app/temporal/chronology.ts';
import {historicalPeriods,searchTerms,exactAliasFocus} from '../app/data/historical-names.ts';
import {decodePlan,ownerAt} from '../app/temporal/atlas.ts';

const manifest=JSON.parse(readFileSync(new URL('../public/atlas/manifest.json',import.meta.url)));
function mappedName(year,lon,lat){
  const interval=manifest.intervals.findLast(item=>item.start<=year);
  const bytes=gunzipSync(readFileSync(new URL(`../public/atlas/${interval.file}`,import.meta.url)));
  const plan=decodePlan(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),interval);
  return displayName(manifest.names[ownerAt(plan,lon,lat,year)],year);
}

test('Egyptian period labels change without changing territorial identity', () => {
  const cases=[
    [-2686,'Old Kingdom of Egypt'],[-2181,'Egypt'],
    [-2055,'Middle Kingdom of Egypt'],[-1650,'Egypt'],
    [-1550,'New Kingdom of Egypt'],[-1069,'Egypt'],
  ];
  for(const [year,name] of cases){
    assert.equal(displayName('Egypt',year),name);
    assert.equal(colorKey(name),'Egypt');
  }
  for(const year of [-2500,-1900,-1300]){
    const label=displayName('Egypt',year);
    assert.ok(historicalPeriods.some(p=>p.name===label&&p.focusYear>=p.start&&p.focusYear<p.end));
    assert.equal(mappedName(year,31.1,29.5),label,`Nile map label at ${year}`);
  }
});

test('Songhai spellings find the empire and the 1591 transition does not invent a new polygon', () => {
  assert.equal(displayName('Songhai',1530),'Songhai Empire');
  assert.equal(displayName('Songhai',1591),'Songhai');
  assert.equal(mappedName(1530,-0.04,16.27),'Songhai Empire');
  assert.equal(mappedName(1590,-0.04,16.27),'Songhai Empire');
  assert.equal(mappedName(1591,-0.04,16.27),'Songhai');
  assert.equal(colorKey('Songhai Empire'),'Songhai');
  for(const spelling of ['Songhay','Sunghai','Sunghai Empire']){
    assert.ok(searchTerms('Songhai Empire').includes(spelling));
    assert.equal(exactAliasFocus('Songhai Empire',spelling),1530);
  }
});

test('African search names resolve to existing dated source regions', () => {
  for(const [alias,region,year] of [
    ['Aksum','Axum',400],['Ghana Empire','Empire of Ghana',700],
    ['Mali Empire','Mali',1300],['Kingdom of Benin','Benin',1500],
    ['Kingdom of Kongo','Congo',1500],['Ashanti','Asante',1800],
  ]){
    assert.ok(searchTerms(region).includes(alias));
    assert.equal(exactAliasFocus(region,alias),year);
    const source=JSON.parse(readFileSync(new URL(`../public/historical/${year}.json`,import.meta.url)));
    assert.ok(source.some(feature=>feature.n===region),`${region} missing from ${year} source map`);
  }
});
