<script>
  import StatusBar from './components/StatusBar.svelte'
  import Parser from './lib/Parser.js';
  import * as zip from "@zip.js/zip.js";

  let entries = [], artboards = {}, jsonPreview = '', status = '';

  async function loadZip(event) {
    const reader = new zip.ZipReader(new zip.BlobReader(event.target.files[0]))

    try {
      entries = await reader.getEntries();
      if (!entries.length) throw new Error("Empty XD file");

      Parser.entries = entries;

      const root = getRootEntry();
      const rootJson = await readAsJson(root);
      artboards = rootJson.artboards;

    } catch {
      alert('Invalid XD file. Should be a zip with some files.')
    }

    // close the ZipReader
    await reader.close();
  }

  const getRootEntry = () => {
    return entries.find(e => e.filename === 'resources/graphics/graphicContent.agc') || alert('NO ROOT');
  }

  const readAsJson = async (entry) => {
    const text = await entry.getData(
        new zip.TextWriter(),
        { 
          onprogress: (index, max) => {
            // onprogress callback
          }
        }
      );
    return JSON.parse(text);
  }

  const readAsBase64Img = async (entry) => {
    status = 'Decoding file ...';
    const text = await entry.getData(
        new zip.Data64URIWriter(),
        { 
          onprogress: (index, max) => {
            // onprogress callback
          }
        }
      );
    status = ''
    return text;
  }
  Parser.readAsBase64Img = readAsBase64Img;

  const loadArtboard = async (id) => {
    const art = artboards[id];
    const artboardEntry = entries.find(e => e.filename === `artwork/artboard-${id}/graphics/graphicContent.agc`)
    const artJson = await readAsJson(artboardEntry);
    jsonPreview = JSON.stringify(artJson, null, '   ');
    const svg = document.getElementById('svg');
    svg.setAttributeNS(null, 'viewBox', `${art.x} ${art.y} ${art.width} ${art.height}`);
    Parser.parse(artJson);
  }

</script>

<h1>XD viewer 0.1</h1>
<section>

  <aside>
    <input type="file" accept=".xd" on:change={loadZip} />
    <h2>Artboards</h2>
    <ul class="artboards">
      {#each Object.entries(artboards) as [id, artboard]}
      <li class="art" title={id} on:click={loadArtboard(id)}>{artboard.name}</li>
      {/each}
    </ul>

    <h2>List of files</h2>
    <pre class="entries">{ entries.map(e => e.filename).join('\n') }</pre>
  </aside>
  <main>
  
    <svg id="svg" />
  </main>
</section>
<StatusBar {status} />
<pre>{jsonPreview}</pre>

<style>
  :root {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
      Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  }
  
  section {
    display: grid;
    width: 100%;
    grid-template-columns: 20em 1fr;
  }

  main {
    padding: 1em;
  }

  h1 {
    color: #ff3e00;
    text-transform: uppercase;
    font-weight: 100;
    line-height: 1.1;
    margin: 2rem auto;
  }

  p {
    max-width: 14rem;
    margin: 1rem auto;
    line-height: 1.35;
  }

  .artboards {
    list-style: none;
    padding: 0;
    font-size: 0.8em;
  }
  .artboards > li {
    cursor: pointer;
  }

  .entries {
    max-height: 10rem;
    overflow: auto;
  }

</style>
