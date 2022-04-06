import * as zip from "@zip.js/zip.js";


export const unzip = async (file) => {
  const reader = new zip.ZipReader(new zip.BlobReader(file))

  const entries = await reader.getEntries();
  reader.close();

  if (!entries.length) throw new Error("Empty XD file");

  const list = {};
  entries.forEach(e => list[e.filename] = e)
  return list;
}


export const readAsJson = async (entry, onprogress = null) => {
  const text = await entry.getData( new zip.TextWriter(), { onprogress } );
  return JSON.parse(text);
}

export const readAsBase64Img = async (entry, onprogress = null) => {
  const text = await entry.getData( new zip.Data64URIWriter(), { onprogress } );
  return text;
}