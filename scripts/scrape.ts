import { PGChunk, PGEssay, PGJSON } from "@/types";
import fs from "fs";
import path from "path";
import { encode } from "gpt-3-encoder";

import XLSX from "xlsx";
import iconv from "iconv-lite";
import { readFile } from "fs/promises";


const CHUNK_SIZE = 200;
const TRANSCRIPTIONS_DIR = "./scripts/data"; // Reemplaza esto con la ruta de tu carpeta de transcripciones
const videoUrl = "https://youtu.be/wZ-VucSOZus";

// Aux functions
function convertToUTF8(input: string): string {
  const buffer = iconv.encode(input, "ISO-8859-1");
  return iconv.decode(buffer, "utf-8");
}

function timeToSeconds(time: string | undefined): number {
  if (typeof time !== 'string') return 0;
  const [hours, minutes, seconds] = time.split(':').map(Number);
  return hours * 3600 + minutes * 60 + seconds;
}


// Important functions
const readExcelFile = async (filename: string) => {
  const buffer = await readFile(filename);
  const utf8Buffer = iconv.decode(buffer, "ISO-8859-1");

  const workbook = XLSX.read(utf8Buffer, {
    type: "buffer",
    raw: false,
    encoding: "utf-8",
    codepage: 65001, // UTF-8 codepage
  });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  return data;
};

const getTranscription = async (data: any[][]) => {
  const content = data
    .map((row) => row.join(","))
    .join("\r\n");

  let transcription: PGEssay = {
    title: "Platanus - Cómo hacer una buena postulación a PV",
    url: "",
    date: "",
    thanks: "",
    content,
    length: content.length,
    tokens: encode(content).length,
    chunks: [],
  };

  return transcription;
};

const chunkTranscription = async (transcription: PGEssay, data: any[][]) => {
  console.log("chunking", transcription.title);
  const { title, url, date, thanks, content, ...chunklessSection } = transcription;

  let transcriptionTextChunks = [];
  let chunkText = "";
  let startTime = 0;

  for (let i = 1; i < data.length; i++) { // Comienza en 1 para ignorar los encabezados
    const row = data[i];
    const speaker = row[3];
    const sentence = convertToUTF8(row[4]);

    const sentenceTokenLength = encode(sentence).length;
    const chunkTextTokenLength = encode(chunkText).length;

    if (chunkTextTokenLength + sentenceTokenLength > CHUNK_SIZE || (i > 1 && speaker !== data[i - 1][3])) {
      transcriptionTextChunks.push({ text: chunkText, startTime });
      startTime = row[1];
      chunkText = "";
    }

    chunkText += sentence + " ";
  }

  transcriptionTextChunks.push({ text: chunkText.trim(), startTime });

  const transcriptionChunks = transcriptionTextChunks.map((text, index) => {
    const trimmedText = text.trim();

    // Buscamos el índice del texto en data y obtenemos el speaker correspondiente
    const rowIndex = data.findIndex(row => row[4] === text);
    const speaker = rowIndex !== -1 ? data[rowIndex][3] : '';
    const speakerName = rowIndex !== -1 ? data[rowIndex][2] : '';

    const startTimeInSeconds = rowIndex !== -1 ? timeToSeconds(data[rowIndex][0]) : 0;

    const chunk: PGChunk = {
      essay_title: "Platanus - Cómo hacer una buena postulación a PV",
      essay_url: `https://www.youtube.com/watch?v=wZ-VucSOZus&feature=youtu.be&t=${startTimeInSeconds}`,
      essay_date: "",
      essay_thanks: speakerName,
      content: trimmedText,
      content_length: trimmedText.length,
      content_tokens: encode(trimmedText).length,
      embedding: [],
    };

    return chunk;
  });




  if (transcriptionChunks.length > 1) {
    for (let i = 0; i < transcriptionChunks.length; i++) {
      const chunk = transcriptionChunks[i];
      const prevChunk = transcriptionChunks[i - 1];
      if (chunk.content_tokens < 100 && prevChunk) {
        prevChunk.content += " " + chunk.content;
        prevChunk.content_length += chunk.content_length;
        prevChunk.content_tokens += chunk.content_tokens;
        transcriptionChunks.splice(i, 1);
        i--;
      }
    }
  }

  const chunkedSection: PGEssay = {
    ...transcription,
    chunks: transcriptionChunks,
  };

  return chunkedSection;
};

(async () => {
  const data = await readExcelFile("./scripts/data/como_postular_platanus.csv"); // Reemplaza esto con la ruta de tu archivo de Excel
  const transcription = await getTranscription(data);
  const chunkedTranscription = await chunkTranscription(transcription, data);

  // Añade el código necesario para agregar la transcripción fragmentada a tu objeto JSON
  // y guarda el JSON en un archivo, como en el ejemplo original.
  // Por ejemplo:

  let transcriptions = [chunkedTranscription];

  const json: PGJSON = {
    current_date: "2023-03-01", // Actualiza esta fecha si es necesario
    author: "Nombre del autor", // Reemplaza esto con el nombre del autor
    url: "URL del canal", // Reemplaza esto con la URL del canal
    length: transcriptions.reduce((acc, transcription) => acc + transcription.length, 0),
    tokens: transcriptions.reduce((acc, transcription) => acc + transcription.tokens, 0),
    essays: transcriptions,
  };

  fs.writeFileSync("scripts/transcriptions.json", JSON.stringify(json), { encoding: "utf8" });
})();