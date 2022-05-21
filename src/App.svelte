<script>
  //import StatusBar from './components/StatusBar.svelte'
  import Parser from './lib/SvgParser.js';
  import ElementProperties from './components/ElementProperties.svelte'
  import { unzip, readAsJson } from './lib/parser/unzip.js'
  
  let artboardsFilter = ''
  let viewerWidth

  let entries = {}, artboards = {}, clickedElement = null;

  async function loadZip(event) {
    entries = {}, artboards = {}, clickedElement = null;

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

    Parser.syncRefs = {};
    const main = await readAsJson(entries['resources/graphics/graphicContent.agc']);
    console.log({main});
    main.resources.meta.ux.symbols.forEach(symbol => {
      Parser.syncRefs[symbol.id] = symbol;
      if (symbol.type === 'group') symbol.group.children.forEach(child => {
        Parser.syncRefs[child.id] = child;
        if (child.type === 'group') child.group.children.forEach(child2 => {
          Parser.syncRefs[child2.id] = child2;
          if (child2.type === 'group') child2.group.children.forEach(child3 => {
            Parser.syncRefs[child3.id] = child3;
          })
        })

      })
    })

    console.log(Parser.syncRefs);
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
  <div id="Viewer" bind:clientWidth={viewerWidth}>
    <span class="width">{viewerWidth}px</span>
    <svg id="svg" />
  </div>
  <!-- <StatusBar {status} /> -->
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

.width {
  position: absolute;
  top: 0;
  right: 0;
  font-size: 10px;
  opacity: 0.2;
}

</style>
