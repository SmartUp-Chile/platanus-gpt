import { PGChunk, PGEssay, PGJSON } from "@/types";
import fs from "fs";
import path from "path";
import { encode } from "gpt-3-encoder";

import XLSX from "xlsx";
import iconv from "iconv-lite";
import { readFile } from "fs/promises";


const CHUNK_SIZE = 200;
const TRANSCRIPTIONS_DIR = "./scripts/data"; // Reemplaza esto con la ruta de tu carpeta de transcripciones


function convertToUTF8(input: string): string {
  const buffer = iconv.encode(input, "ISO-8859-1");
  return iconv.decode(buffer, "utf-8");
}


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
    title: "Nombre del título", // Reemplaza esto con el título que desees
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

  for (let i = 1; i < data.length; i++) { // Comienza en 1 para ignorar los encabezados
    const row = data[i];
    const speaker = row[3];
    const sentence = convertToUTF8(row[4]);
    console.log("chunking", i, sentence)

    const sentenceTokenLength = encode(sentence).length;
    const chunkTextTokenLength = encode(chunkText).length;

    if (chunkTextTokenLength + sentenceTokenLength > CHUNK_SIZE || (i > 1 && speaker !== data[i - 1][3])) {
      transcriptionTextChunks.push(chunkText);
      chunkText = "";
    }

    chunkText += sentence + " ";
  }

  transcriptionTextChunks.push(chunkText.trim());

  const transcriptionChunks = transcriptionTextChunks.map((text) => {
    const trimmedText = text.trim();

    const chunk: PGChunk = {
      essay_title: title,
      essay_url: url,
      essay_date: date,
      essay_thanks: thanks,
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
