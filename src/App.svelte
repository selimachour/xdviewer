<script>
  import StatusBar from './components/StatusBar.svelte'
  import Parser from './lib/Parser.js';
  import ElementProperties from './components/ElementProperties.svelte'
  import { unzip, readAsJson } from './lib/parser/unzip.js'
  
  let artboardsFilter = ''

  let entries = {}, artboards = {}, status = '', clickedElement = null;

  async function loadZip(event) {

    try {
      entries = await unzip(event.target.files[0])
      Parser.entries = entries;
      console.log({entries});

      const manifest = await readAsJson(entries['manifest']);
      Parser.manifest = manifest;
      console.log({manifest});
      manifest.children.find(c => c.name === 'artwork').children.forEach(c => {
        if (c['uxdesign#bounds']) artboards[c.id] = c;
      })
      console.log({artboards});

    } catch {
      alert('Invalid XD file. Should be a zip with some files.')
    }

  }

  const props = (el) => {
    clickedElement = el;
  }

  const loadArtboard = async (id) => {
    console.log({id});
    const art = artboards[id];
    const artboardEntry = entries[`artwork/${art.path}/graphics/graphicContent.agc`]
    if (!artboardEntry) return
    console.log({entries}, {artboardEntry});
    const artJson = await readAsJson(artboardEntry);
    const svg = document.getElementById('svg');
    svg.setAttributeNS(null, 'viewBox', `${art['uxdesign#bounds'].x} ${art['uxdesign#bounds'].y} ${art['uxdesign#bounds'].width} ${art['uxdesign#bounds'].height}`);
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
      <input type="text" bind:value={artboardsFilter}>
      {#each Object.entries(artboards).filter(([id, artboard]) => artboard.name.toLowerCase().match(artboardsFilter.toLocaleLowerCase())) as [id, artboard]}
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
