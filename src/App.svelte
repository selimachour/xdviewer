<script>
  import StatusBar from './components/StatusBar.svelte'
  import Parser from './lib/Parser.js';
  import ElementProperties from './components/ElementProperties.svelte'
  import { unzip, readAsJson } from './lib/parser/unzip.js'

  let entries = {}, artboards = {}, jsonPreview = '', status = '', clickedElement = null;

  async function loadZip(event) {

    try {
      entries = await unzip(event.target.files[0])

      Parser.entries = entries;

      const root = getRootEntry();
      const rootJson = await readAsJson(root);
      artboards = rootJson.artboards;

    } catch {
      alert('Invalid XD file. Should be a zip with some files.')
    }

  }

  const getRootEntry = () => {
    return entries['resources/graphics/graphicContent.agc'];
  }

  const props = (el) => {
    clickedElement = el;
  }

  const loadArtboard = async (id) => {
    const art = artboards[id];
    const artboardEntry = entries[`artwork/artboard-${id}/graphics/graphicContent.agc`]
    const artJson = await readAsJson(artboardEntry);
    jsonPreview = JSON.stringify(artJson, null, '   ');
    const svg = document.getElementById('svg');
    svg.setAttributeNS(null, 'viewBox', `${art.x} ${art.y} ${art.width} ${art.height}`);
    Parser.parse(artJson);
    Parser.props = props;
  }


</script>

<main>
  <nav>
    <h1>XD viewer 0.1</h1>
    <input type="file" accept=".xd" on:change={loadZip} />
  </nav>
  <aside id="Left">
    <h2>Artboards</h2>
    <div class="artboards">
      {#each Object.entries(artboards) as [id, artboard]}
      <span class="a" on:click={loadArtboard(id)}>{artboard.name}</span>
      {/each}
    </div>
  </aside>
  <aside id="Right">
    <ElementProperties el={clickedElement} />
  </aside>
  <div id="Viewer">
    <svg id="svg" />
  </div>
  <StatusBar {status} />
</main>

<style>

nav {
  display: flex;
  align-items: center;
  gap: 2rem;
  border-bottom: 1px solid #aaa;
  background-color: #ddd;
  height: var(--navHeight);
  padding-inline: 1rem;
}

</style>
