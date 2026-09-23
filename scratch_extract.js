const fs = require('fs');
const pdf = require('pdf-parse');

let dataBuffer = fs.readFileSync('D:\\Proyectos\\D&D 2024 Manual de monstruos.pdf');

pdf(dataBuffer, { max: 15 }).then(function(data) {
    fs.writeFileSync('scratch/pdf_extract.txt', data.text);
    console.log("PDF extract completed. Pages saved to scratch/pdf_extract.txt");
}).catch(err => console.error(err));
