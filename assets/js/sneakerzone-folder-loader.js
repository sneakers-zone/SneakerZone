
/*!
 * SneakerZone Local Folder Loader
 * - Uses File System Access API to read images from a chosen folder (and subfolders)
 * - Expects file names with pattern: Marca_Genero_Modelo_Color_Precio_Talla(s).ext
 *   Example: Skechers_Mujer_DLux_Rosa_530_23.5-24-25.jpg
 */
(function(global){
  const VALID_EXT = ['jpg','jpeg','png','webp','gif'];
  const NAME_RE = /^(?<brand>[A-Za-z]+)_(?<genero>Hombre|Mujer|Unisex)_(?<modelo>[^_]+)_(?<color>[^_]+)_(?<precio>\d+(?:\.\d+)?)_(?<tallas>(?:\d+(?:\.\d+)?)(?:-\d+(?:\.\d+)?)*)\.(?<ext>jpg|jpeg|png|webp|gif)$/i;

  function ensureContainers(options){
    const root = document.querySelector(options.catalogRootSelector || '#catalogRoot');
    if (!root) {
      const fallback = document.createElement('div');
      fallback.id = 'catalogRoot';
      fallback.className = 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8';
      (document.querySelector('main') || document.body).appendChild(fallback);
      return fallback;
    }
    return root;
  }

  const BRAND_SECTION_TEMPLATE = ({brand}) => `
    <section class="section-brand" data-brand="${brand.toLowerCase()}">
      <h2 class="flex items-center gap-2">${brand} <span class="badge">Auto</span></h2>
      <div class="gender-wrap" data-gender="Hombre">
        <h3 class="font-bold mt-2 mb-2">Hombre</h3>
        <div class="section-grid" data-grid="Hombre"></div>
      </div>
      <div class="gender-wrap" data-gender="Mujer">
        <h3 class="font-bold mt-4 mb-2">Mujer</h3>
        <div class="section-grid" data-grid="Mujer"></div>
      </div>
      <div class="gender-wrap" data-gender="Unisex">
        <h3 class="font-bold mt-4 mb-2">Unisex</h3>
        <div class="section-grid" data-grid="Unisex"></div>
      </div>
    </section>
  `;

  function ensureBrandSection(root, brand){
    const key = brand.toLowerCase();
    let section = root.querySelector(`section.section-brand[data-brand="${key}"]`);
    if (!section){
      const wrap = document.createElement('div');
      wrap.innerHTML = BRAND_SECTION_TEMPLATE({brand});
      section = wrap.firstElementChild;
      root.appendChild(section);
    }
    return section;
  }

  function gridFor(section, genero){
    const wrap = section.querySelector(`.gender-wrap[data-gender="${genero}"]`);
    return wrap ? wrap.querySelector('.section-grid') : null;
  }

  function makeCard({imgURL, brand, genero, modelo, color, precio, tallas}) {
    const card = document.createElement('div');
    card.className = 'product-card bg-white rounded-2xl p-3 shadow-sm';
    card.innerHTML = `
      <div class="relative">
        <img src="${imgURL}" alt="${modelo}">
        <button type="button" class="bag-overlay-btn" title="Agregar al carrito">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path>
          </svg>
        </button>
      </div>
      <div class="mt-2">
        <h3 class="text-base font-bold text-black">${modelo}</h3>
        <p class="product-meta">${brand} • ${genero} • <span class="capitalize">${color}</span></p>
        <p class="font-medium text-black mt-1">$${Number(precio).toFixed(2)}</p>
        <div class="mt-2 flex flex-wrap gap-2">
          ${tallas.map(t => `<button type="button" class="size-btn" data-size="${t}">${t}</button>`).join('')}
        </div>
        <button type="button" class="whatsapp-btn">Comprar por WhatsApp</button>
      </div>
    `;
    return card;
  }

  async function* walkDir(dirHandle){
    for await (const entry of dirHandle.values()){
      if (entry.kind === 'file') {
        yield entry;
      } else if (entry.kind === 'directory') {
        yield* walkDir(entry);
      }
    }
  }

  async function fileToObjectURL(fileHandle){
    const file = await fileHandle.getFile();
    return URL.createObjectURL(file);
  }

  function parseName(name){
    const m = name.match(NAME_RE);
    if(!m) return null;
    const {brand, genero, modelo, color, precio, tallas} = m.groups;
    return {
      brand, genero, modelo, color,
      precio: parseFloat(precio),
      tallas: tallas.split('-')
    };
  }

  function toast(msg){
    let t = document.getElementById('snzToast');
    if(!t){
      t = document.createElement('div');
      t.id = 'snzToast';
      t.style.cssText = 'position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:#111;color:#fff;padding:10px 14px;border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,.22);z-index:9999';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    setTimeout(()=>{ t.style.opacity = '0'; }, 2500);
  }

  async function loadFromFolder(dirHandle, options={}){
    const root = ensureContainers(options);
    let added = 0, skipped = 0;

    for await (const fh of walkDir(dirHandle)){
      const name = fh.name;
      const ext = name.split('.').pop().toLowerCase();
      if (!VALID_EXT.includes(ext)) { skipped++; continue; }
      const meta = parseName(name);
      if (!meta){ skipped++; continue; }

      const imgURL = await fileToObjectURL(fh);
      const section = ensureBrandSection(root, meta.brand);
      const grid = gridFor(section, meta.genero) || gridFor(section, 'Unisex');
      if (!grid){ skipped++; continue; }

      const card = makeCard({imgURL, ...meta});
      grid.prepend(card);
      added++;
    }

    if (typeof updateButtonState === 'function') {
      document.querySelectorAll('.product-card').forEach(updateButtonState);
    }
    toast(`Listo: ${added} cargados, ${skipped} ignorados.`);
  }

  function insertActionsBar(options){
    const target = document.querySelector(options.actionsContainerSelector || 'main') || document.body;
    const bar = document.createElement('div');
    bar.id = 'actionsBar';
    bar.className = 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 mb-2';
    bar.innerHTML = `
      <button id="pickDirBtn" class="inline-flex items-center rounded-xl border border-black px-4 py-2 text-sm font-semibold hover:bg-black hover:text-white transition">
        📁 Cargar desde Carpeta
      </button>
      <span class="ml-3 text-xs text-gray-500">Selecciona <strong>Inventario_Marcas</strong> en tu PC</span>
    `;
    if (target.firstChild) target.insertBefore(bar, target.firstChild);
    else target.appendChild(bar);

    const btn = bar.querySelector('#pickDirBtn');
    btn.addEventListener('click', async ()=>{
      try {
        const dir = await window.showDirectoryPicker({ id: 'sneakerzone-inventario' });
        await loadFromFolder(dir, options);
      } catch(err) {
        if (err && err.name !== 'AbortError') {
          console.error(err);
          toast('No se pudo leer la carpeta.');
        }
      }
    });
  }

  function injectStyles(){
    if (document.getElementById('sz-auto-style')) return;
    const style = document.createElement('style');
    style.id = 'sz-auto-style';
    style.textContent = `
.section-brand { margin-top: 2rem; margin-bottom: 2.5rem; }
.section-brand h2 { font-weight: 800; font-size: 1.5rem; margin-bottom: 0.75rem; }
.section-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
@media (min-width: 640px){ .section-grid{ grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (min-width: 1024px){ .section-grid{ grid-template-columns: repeat(4, minmax(0, 1fr)); } }
.product-card img { width: 100%; height: 260px; object-fit: cover; border-radius: 0.75rem; }
.badge { display: inline-flex; align-items:center; border:1px solid #e5e7eb; border-radius:9999px; padding:.15rem .5rem; font-size:.75rem; }
.size-btn { border:1px solid #d1d5db; padding:.25rem .5rem; border-radius:.5rem; font-size:.75rem; }
.size-btn.active { border-color:#111; }
.whatsapp-btn { margin-top: .5rem; border: 1px solid #111; padding: .5rem .75rem; border-radius: .5rem; font-weight: 600; }
.whatsapp-btn:disabled { opacity:.5; cursor:not-allowed; }
.product-meta { font-size:.8rem; color:#6b7280; }
      `;
    document.head.appendChild(style);
  }

  function initSneakerZoneFolderLoader(options={}){
    injectStyles();
    insertActionsBar(options);
  }

  // Expose
  global.initSneakerZoneFolderLoader = initSneakerZoneFolderLoader;

})(window);
