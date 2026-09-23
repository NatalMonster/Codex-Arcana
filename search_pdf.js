const fs = require('fs');
const PDFParser = require('pdf2json');

let pdfParser = new PDFParser(this, 1);
const searchTerm = process.argv[2] || "Aboleth";

pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError) );
pdfParser.on("pdfParser_dataReady", pdfData => {
    const rawText = pdfParser.getRawTextContent();
    const lines = rawText.split('\n');
    
    let foundIndex = -1;
    for(let i=0; i<lines.length; i++){
      if(lines[i].toLowerCase().includes(searchTerm.toLowerCase())){
        foundIndex = i;
        break;
      }
    }
    
    if(foundIndex !== -1) {
      console.log(`\n--- FOUND '${searchTerm}' at line ${foundIndex} ---\n`);
      const start = Math.max(0, foundIndex - 5);
      const end = Math.min(lines.length, foundIndex + 50);
      console.log(lines.slice(start, end).join('\n'));
    } else {
      console.log(`No se encontró '${searchTerm}' en el PDF.`);
    }
});

pdfParser.loadPDF("D&D 2024 Manual de monstruos.pdf");
