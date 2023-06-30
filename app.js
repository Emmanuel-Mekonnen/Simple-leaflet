var L = require('leaflet');
const Promise = require('promise-polyfill');
if (!window.Promise) {
    window.Promise = Promise;
}
var Mustache = require('mustache')
var JQueryStatic = require('jquery')
let geoPackage
let tableLayers
let featureLayers
let imageOverlay
let tableInfos


//const { GeoPackageManager, setSqljsWasmLocateFile } = gp.GeoPackage;
const { GeoPackageManager, setSqljsWasmLocateFile } = window.GeoPackage;
const geopackageMap = L.map('map').setView([38.6258, -90.189933], 14);
L.tileLayer('http://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}.png', {
    attribution:
        'Source: Esri, DigitalGlobe, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN, and the GIS User Community. OpenStreetMap.',
}).addTo(geopackageMap);
const gp = require('@ngageoint/geopackage/dist/geopackage.min')
gp.setSqljsWasmLocateFile("https://unpkg.com/@ngageoint/geopackage@4.2.1/dist/sql-wasm.wasm")
window.GeoPackage.setSqljsWasmLocateFile("https://unpkg.com/@ngageoint/geopackage@4.2.1/dist/sql-wasm.wasm")


function loadByteArray(array) {
    GeoPackageManager.open(array).then(geoPackage => {
        // Now you can operate on the GeoPackage
        // Get the tile table names
        const tileTableNames = geoPackage.getTileTables();
        const tileDao = geoPackage.getTileDao(tileTableNames[0]); // We know we have one tile layer, loop if you have more.
        const maxZoom = tileDao.maxWebMapZoom;
        const minZoom = tileDao.minWebMapZoom;
        const tableLayer = new L.GridLayer({ noWrap: true, minZoom: minZoom, maxZoom: maxZoom });
        tableLayer.createTile = function (tilePoint, done) {
            const canvas = L.DomUtil.create('canvas', 'leaflet-tile');
            const size = this.getTileSize();
            canvas.width = size.x;
            canvas.height = size.y;
            let error = null;
            setTimeout(function () {
                console.time('Draw tile ' + tilePoint.x + ', ' + tilePoint.y + ' zoom: ' + tilePoint.z);
                geoPackage
                    .xyzTile(tileTableNames[0], tilePoint.x, tilePoint.y, tilePoint.z, size.x, size.y, canvas)
                    .catch(err => {
                        error = err;
                    })
                    .finally(() => {
                        console.timeEnd('Draw tile ' + tilePoint.x + ', ' + tilePoint.y + ' zoom: ' + tilePoint.z);
                        done(error, canvas);
                    });
            }, 0);
            return canvas;
        };
        geopackageMap.addLayer(tableLayer);
        tableLayer.bringToFront();

        const featureTableNames = geoPackage.getFeatureTables();
        featureTableNames.forEach(featureTable => {
            console.log('featureTable: ' + featureTable);
            const featureDao = geoPackage.getFeatureDao(featureTable);
            const info = geoPackage.getInfoForTable(featureDao);
            // query for all features
            const iterator = featureDao.queryForEach();
            for (const row of iterator) {
                const feature = featureDao.getRow(row);
                const geometry = feature.geometry;
                if (geometry) {
                    // Make the information into something we can display on the map with leaflet
                    const geom = geometry.geometry;
                    const geoJson = geom.toGeoJSON();
                    geoJson.properties = {};
                    geoJson.properties['table_name'] = featureTable;

                    // map the values from the feature table into GeoJSON properties we can use to style the map and show a popup
                    for (const key in feature.values) {
                        if (feature.values.hasOwnProperty(key) && key != feature.geometryColumn.name) {
                            const column = info.columnMap[key];
                            geoJson.properties[column.displayName] = feature.values[key];
                        }
                    }
                    // eslint-disable-next-line @typescript-eslint/no-use-before-define
                    geojsonLayer.addData(geoJson);
                }
            }
        });
    });

    const geojsonLayer = L.geoJson([], {
        style: function (feature) {
            // Style the polygons
            return {
                color: '#000',
                weight: 2,
                opacity: 1,
                fillColor: '#093',
            };
        }
    }).addTo(geopackageMap);

}
function loadGeoPackage(url) {
    console.log('In loadGeoPackage')
    fetch(url).then(res => res.arrayBuffer()).then(arrayBuffer => {
        var uint = new Uint8Array(arrayBuffer)
        console.log(uint)
        loadByteArray(uint)
    })
}
loadGeoPackage('https://github.com/ngageoint/GeoPackage/blob/master/docs/examples/rivers.gpkg')