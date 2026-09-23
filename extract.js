const fs = require('fs');
const pdf = require('pdf-parse');

let dataBuffer = fs.readFileSync('D:\\Proyectos\\D&D 2024 Manual de monstruos.pdf');

pdf(dataBuffer).then(function(data) {
    fs.writeFileSync('D:\\Proyectos\\scratch_extract.txt', data.text);
    console.log("PDF extract completed. Pages saved to scratch_extract.txt");
}).catch(err => console.error(err));
