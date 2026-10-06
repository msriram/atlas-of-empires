/** Approximate annual controls where the source has no yearly polygons.
 * Coordinates are longitude/latitude; the same rings drive flat and globe views.
 * Add a reach rule with dated controls and target rings to refine another empire.
 */
export const mongolReach={
 name:'Mongol Empire',start:1206,end:1260,center:[110,47] as [number,number],
 targetNames:['Chagatai Khanate','Ilkhanate','Khanate of the Golden Horde','Great Khanate'],
 controls:[
  {year:1206,radius:12,chinaSouth:40},
  {year:1215,radius:25,chinaSouth:39},
  {year:1227,radius:46,chinaSouth:37},
  {year:1241,radius:76,chinaSouth:34},
  {year:1260,radius:102,chinaSouth:31},
 ]
};
export const successorSouth=[{year:1261,latitude:31},{year:1279,latitude:19}];
