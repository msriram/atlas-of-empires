import {geoArea} from 'd3-geo';
import type {Boundary} from './territory-model';
import {geometryOf} from './territory-transfers';
/** d3 uses clockwise spherical exteriors; GeoJSON booleans use counterclockwise.
 * Preserve opposite winding for holes when preparing the globe projection. */
export function boundaryGeoJSON(boundary:Boundary){
 return {type:'MultiPolygon' as const,coordinates:geometryOf(boundary).map(polygon=>polygon.map((ring,index)=>{
  const closed=[...ring,ring[0]],large=geoArea({type:'Polygon',coordinates:[closed]})>Math.PI*2;
  return large===(index===0)?[...closed].reverse():closed;
 }))};
}
