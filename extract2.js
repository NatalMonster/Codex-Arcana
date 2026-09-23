const fs = require('fs');
const PDFParser = require("pdf2json");

const pdfParser = new PDFParser(this, 1);

pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError));
pdfParser.on("pdfParser_dataReady", pdfData => {
    fs.writeFileSync("scratch_extract.txt", pdfParser.getRawTextContent());
    console.log("Extraction done.");
});

pdfParser.loadPDF("D:\\Proyectos\\D&D 2024 Manual de monstruos.pdf");
