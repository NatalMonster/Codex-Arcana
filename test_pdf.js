const fs = require('fs');
const pdf = require('pdf-parse');

let dataBuffer = fs.readFileSync('D&D 2024 Manual de monstruos.pdf');

pdf(dataBuffer).then(function(data) {
    // number of pages
    console.log("Pages:", data.numpages);
    // info
    console.log("Info:", data.info);
    // first 500 chars
    console.log("Text snippet:", data.text.substring(0, 1000));
}).catch(console.error);
