import { readAsBase64Img } from "./parser/unzip";

const cache = {}

let _uid = 0;
const uid = () => _uid++;

const svgElement = (element, data) => {
  const el = document.createElementNS('http://www.w3.org/2000/svg', element);

  if (data) {
    if (data.id) el.id = data.id;
    el.definition = data;

    el.onclick = (e) => {
      e.stopPropagation()
      parser.props(el);
    }
  }

  return el
}

const parser = {
  svg: null,
  parse: (data) => {
    parser.svg = document.getElementById('svg');
    parser.svg.innerHTML = '';
    parser.defs = svgElement('defs');
    parser.svg.appendChild(parser.defs);
    parser.children(data.children, parser.svg);
  },
  artboard: async (data, container) => {
    const el = svgElement('g', data)
    el.setAttributeNS(null, 'class', 'artboard');
    container.appendChild(el)
    parser.children(data.artboard.children, el);
  },
  group: async (data, container) => {
    const el = svgElement('g', data)
    el.setAttributeNS(null, 'class', 'group');
    await parser.parseStyle(data, el)
    parser.applyTransform(el, data);
    container.appendChild(el)
    parser.children(data.group.children, el);
  },

  syncRef: async (data, container) => {
    const { syncSourceGuid, guid } = data;

    if (parser.syncRefs[syncSourceGuid]) {
      const el = svgElement('g', parser.syncRefs[syncSourceGuid])
      el.setAttributeNS(null, 'class', 'syncRef');

      parser.applyTransform(el, data);

      container.appendChild(el)

      parser.children([parser.syncRefs[syncSourceGuid]], el);

    } else {
      console.warn(`syncRef: ${syncSourceGuid} not found`)
    }

  },

  text: async (data, container) => {
    const el = svgElement('text', data)
    el.setAttributeNS(null, 'class', 'text');

    parser.applyTransform(el, data);
    await parser.parseStyle(data, el)

    if (data.text.paragraphs) {
      data.text.paragraphs.forEach(p => {
        p.lines.forEach(async (line) => {
          line.forEach(async (segment, index) => {
            const tspan = svgElement('tspan', data)

            if ('undefined' !== typeof segment.x) {
              tspan.setAttributeNS(null, 'x', segment.x);
            } else if (index === 0) {
              tspan.setAttributeNS(null, 'x', 0);
            }
            tspan.setAttributeNS(null, 'y', segment.y || 0);
            tspan.appendChild(document.createTextNode(data.text.rawText.substr(segment.from, segment.to - segment.from)))
            await parser.parseStyle(segment, tspan)
            el.appendChild(tspan)
          })
        })
      })
    } else {
      el.appendChild(document.createTextNode(data.text.rawText))
    }

    container.appendChild(el)
  },
  shape: async (data, container) => {

    // shapes are special
    const { shape } = data;

    let el = svgElement(shape.type, data)
    el.setAttributeNS(null, 'class', 'shape');


    switch (shape.type) {
      case 'rect':
        el.setAttributeNS(null, 'x', shape.x);
        el.setAttributeNS(null, 'y', shape.y);
        el.setAttributeNS(null, 'width', shape.width);
        el.setAttributeNS(null, 'height', shape.height);
        if (shape.r) {
          const [tl, tr, br, bl] = shape.r;
          // only some round corners ... not supported by <rect> ?
          if (tl !== tr || tr !== br) {
            el = svgElement('path', data)
            el.setAttributeNS(null, 'd', `
              M${shape.x + tl},${shape.y} 
              h${shape.width - tl - tr} 
              q${tr},0 ${tr},${tr} 
              v${shape.height - tr - br} 
              q0,${br} ${-br},${br}
              h${-(shape.width - bl - br)}
              q${-bl},0 ${-bl},${-bl}
              v${-(shape.height - bl - tl)}
              q0,${-tl} ${tl},${-tl}
              z`.replace(/\s+/g, ' '))
          } else {
            el.setAttributeNS(null, 'rx', shape.r[0]);
            el.setAttributeNS(null, 'ry', shape.r[0]);
          }
        }
        break;
      case 'circle':
        el.setAttributeNS(null, 'cx', shape.cx);
        el.setAttributeNS(null, 'cy', shape.cy);
        el.setAttributeNS(null, 'r', shape.r);
        break;
      case 'path':
        el.setAttributeNS(null, 'd', shape.path)
        break;
      case 'polygon':
        el.setAttributeNS(null, 'points', shape.points.map(o => `${o.x},${o.y}`).join(' '))
        break;
      case 'line':
        el.setAttributeNS(null, 'x1', shape.x1)
        el.setAttributeNS(null, 'y1', shape.y1)
        el.setAttributeNS(null, 'x2', shape.x2)
        el.setAttributeNS(null, 'y2', shape.y2)
        break;
      default:
        console.warn(`Unknown shape ${shape.type}`)
    }

    await parser.parseStyle(data, el)

    container.appendChild(el)
    parser.applyTransform(el, data);

  },
  children: (children, container) => {
    if (!children) return;
    children.forEach(child => {
      if (parser[child.type]) {
        parser[child.type](child, container);
      } else {
        console.log(`Unhandled type: ${child.type}`);
      }
    })
  },
  applyTransform(el, data) {
    if (data.transform) {
      const { a, b, c, d, tx, ty } = data.transform;
      el.style.transform = `matrix(${a}, ${b}, ${c}, ${d}, ${tx}, ${ty})`;
    }
  },
  parseStyle: async (data, el) => {
    if (!data.style) return '';

    let { style } = data;

    if (style.fill) {
      if (style.fill.type === 'none') el.style.fill = 'none';
      else if (style.fill.color) el.style.fill = parser.parseColorAlpha(style.fill.color);
      else if (style.fill.type === 'pattern') {

        const resourceId = style.fill.pattern.meta.ux.uid;
        const pattern = svgElement('pattern');
        pattern.setAttributeNS(null, 'id', resourceId);
        pattern.setAttributeNS(null, 'width', '100%');
        pattern.setAttributeNS(null, 'height', '100%');
        pattern.setAttributeNS(null, 'viewBox', `0 0 ${style.fill.pattern.width} ${style.fill.pattern.height}`);
        pattern.setAttributeNS(null, 'preserveAspectRatio', 'xMidYMid slice');
        if (!cache[resourceId]) {
          console.time('image'+resourceId)
          const resourceEntry = parser.entries[`resources/${resourceId}`];
          cache[resourceId] = await readAsBase64Img(resourceEntry);
          console.timeEnd('image'+resourceId)
        }

        const image = svgElement('image');
        image.setAttributeNS(null, 'href', cache[resourceId]);
        image.setAttributeNS(null, 'width', style.fill.pattern.width);
        image.setAttributeNS(null, 'height', style.fill.pattern.height);

        // pattern with offset ?
        const { offsetX, offsetY } = style.fill.pattern.meta.ux;
        if (offsetX) image.setAttributeNS(null, 'x', style.fill.pattern.width * offsetX);
        if (offsetY) image.setAttributeNS(null, 'y', style.fill.pattern.height * offsetY);

        pattern.appendChild(image);
        parser.defs.appendChild(pattern);

        el.setAttributeNS(null, 'fill', `url(#${resourceId})`)
      }
      else if (style.fill.type === 'gradient') {

        const resourceId = 'gradient-' + uid();

        const linearGradient = svgElement('linearGradient');
        linearGradient.setAttributeNS(null, 'id', resourceId);
        linearGradient.setAttributeNS(null, 'x1', style.fill.gradient.x1);
        linearGradient.setAttributeNS(null, 'y1', style.fill.gradient.y1);
        linearGradient.setAttributeNS(null, 'x2', style.fill.gradient.x2);
        linearGradient.setAttributeNS(null, 'y2', style.fill.gradient.y2);
        linearGradient.setAttributeNS(null, 'gradientUnits', style.fill.gradient.units);

        style.fill.gradient.meta.ux.gradientResources.stops.forEach(s => {
          const stop = svgElement('stop');
          stop.setAttributeNS(null, 'offset', s.offset);
          stop.setAttributeNS(null, 'stop-color', parser.parseColor(s.color));
          if ('undefined' !== typeof s.color.alpha) stop.setAttributeNS(null, 'stop-opacity', s.color.alpha);
          linearGradient.appendChild(stop);
        })

        parser.defs.appendChild(linearGradient);
        el.setAttributeNS(null, 'fill', `url(#${resourceId})`)
      }
      else console.log("Unknown fill", style.fill);
    }

    if (style.stroke && 'none' !== style.stroke.type) {

      if (style.stroke.color) el.style.stroke = parser.parseColorAlpha(style.stroke.color)
      else console.log(`Unknown stroke: ${style.stroke}`);

      if (style.stroke.width) el.style.strokeWidth = style.stroke.width;

      if (style.stroke.dash) el.style.strokeDasharray = style.stroke.dash.join(' ');

      if (style.stroke.join) el.style.strokeLinejoin = style.stroke.join;

      if (style.stroke.cap) el.style.strokeLinecap = style.stroke.cap;

    }

    if (style.font) {
      if (style.font.size) el.style.fontSize = style.font.size + 'px';
      if (style.font.postscriptName) el.style.fontFamily = `'${style.font.postscriptName}'`;
      else if (style.font.family) el.style.fontFamily = `'${style.font.family}-${style.font.style}'`;
    }

    if (style.opacity) {
      el.style.opacity = style.opacity;
    }

    if (style.blendMode) el.style.mixBlendMode = style.blendMode
    
    if (style.isolate) el.style.isolate = style.isolate

    // clip path ?
    if (data.meta && data.meta.ux && data.meta.ux.viewportHeight) {
      const { offsetX, offsetY, viewportWidth, viewportHeight } = data.meta.ux;
      const resourceId = data.id + 'clip';
      const clipPath = svgElement('clipPath');
      clipPath.setAttributeNS(null, 'id', resourceId);
      const rect = svgElement('rect');
      if ('undefined' !== typeof offsetX) rect.setAttributeNS(null, 'x', offsetX);
      if ('undefined' !== typeof offsetY) rect.setAttributeNS(null, 'y', offsetY);
      rect.setAttributeNS(null, 'width', viewportWidth);
      rect.setAttributeNS(null, 'height', viewportHeight);
      clipPath.appendChild(rect);
      parser.defs.appendChild(clipPath);
      el.setAttributeNS(null, 'clip-path', `url(#${resourceId})`)
    }


    parser.parseFilters(data, el)

    if (style.filters && style.filters[0] && style.filters[0].visible === false) {
      //style += 'display:none;';
    }
    return style
  },

  parseFilters: (data, el) => {
    if (!data.style.filters) return;

    console.log('parsing filters');
    data.style.filters.forEach(filter => {

      // skip invisible filters
      if (filter.visible === false) return;

      switch (filter.type) {

        case 'dropShadow':
          filter.params.dropShadows.forEach(dropShadow => {
            const { dx, dy, r, color } = dropShadow;

            const filter = svgElement('filter');
            filter.id = 'filter-' + uid();

            const feDropShadow = svgElement('feDropShadow');
            feDropShadow.setAttributeNS(null, 'dx', dx);
            feDropShadow.setAttributeNS(null, 'dy', dy);
            feDropShadow.setAttributeNS(null, 'stdDeviation', r);
            feDropShadow.setAttributeNS(null, 'flood-color', parser.parseColor(color));
            feDropShadow.setAttributeNS(null, 'flood-opacity', color.alpha);

            filter.appendChild(feDropShadow);
            parser.defs.appendChild(filter);
            el.style.filter = `url(#${filter.id})`
            console.log(el.style);
          })

          break;
        default:
          console.warn(`Unknown filter type ${filter.type}`)
      }
    })

  },

  parseColorAlpha: c => {
    if (c.mode === 'RGB') {
      const { r, g, b } = c.value;
      if (c.alpha) 
        return `rgba(${r},${g},${b}, ${c.alpha})`;
      else
        return `rgb(${r},${g},${b})`;
    }
  },
  parseColor: c => {
    if (c.mode === 'RGB') {
      const { r, g, b } = c.value;
      return `rgb(${r},${g},${b})`;
    }
  }
}

export default parser;