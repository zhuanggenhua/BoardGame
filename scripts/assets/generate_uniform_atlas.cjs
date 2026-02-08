const fs = require('fs');
const path = require('path');

const file = process.argv[2];
const rows = parseInt(process.argv[3]);
const cols = parseInt(process.argv[4]);
const width = parseInt(process.argv[5]);
const height = parseInt(process.argv[6]);

if (!file || !rows || !cols || !width || !height) {
    console.error('Usage: node generate_uniform_atlas.js <file_path_no_ext> <rows> <cols> <width> <height>');
    process.exit(1);
}

const w = width / cols;
const h = height / rows;

const rowStarts = [];
const rowHeights = [];
for (let i = 0; i < rows; i++) rowStarts.push(Math.floor(i * h));
for (let i = 0; i < rows; i++) rowHeights.push(Math.floor(h));

const colStarts = [];
const colWidths = [];
for (let i = 0; i < cols; i++) colStarts.push(Math.floor(i * w));
for (let i = 0; i < cols; i++) colWidths.push(Math.floor(w));

const data = {
    imageW: width,
    imageH: height,
    rows,
    cols,
    rowStarts,
    rowHeights,
    colStarts,
    colWidths,
    scan: { manual: true, rows, cols }
};

const jsonPath = file + '.atlas.json';
fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
console.log('Generated uniform atlas: ' + jsonPath);
