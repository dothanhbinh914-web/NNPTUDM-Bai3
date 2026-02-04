const API_URL = 'https://api.escuelajs.co/api/v1/products';
const PRODUCTS_PER_PAGE = 12;
let perPage = Number((document.getElementById('perPageSelect') && document.getElementById('perPageSelect').value) || 10);
const PER_PAGE_OPTIONS = [5,10,20];

const loader = document.getElementById('loader');
const productsGrid = document.getElementById('productsGrid');
const alertPlaceholder = document.getElementById('alertPlaceholder');
const paginationEl = document.getElementById('pagination');
const searchInput = document.getElementById('searchInput');
const toggleViewBtn = document.getElementById('toggleViewBtn');
const tableView = document.getElementById('tableView');
const productsTableBody = document.getElementById('productsTableBody');

// new controls
const perPageSelect = document.getElementById('perPageSelect');
const recordCount = document.getElementById('recordCount');
const exportCsvBtn = document.getElementById('exportCsvBtn') || document.getElementById('exportBtn');
const createBtn = document.getElementById('createBtn');
const sortTitleBtn = document.getElementById('sortTitleBtn');
const sortPriceBtn = document.getElementById('sortPriceBtn');
const editBtn = document.getElementById('editBtn');
const saveBtn = document.getElementById('saveBtn');
const createForm = document.getElementById('createForm');

let currentModalProductId = null;

let allProducts = [];
let filtered = [];
let currentPage = 1;
let sortBy = null; // 'id' | 'title' | 'price' | 'category'
let sortDir = 'asc'; // 'asc' | 'desc'

// attach sort listeners to table headers (if present)
document.querySelectorAll('th[data-sort]').forEach(th => {
  th.addEventListener('click', () => {
    const key = th.getAttribute('data-sort');
    if (sortBy === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    else { sortBy = key; sortDir = 'asc'; }
    document.querySelectorAll('th[data-sort]').forEach(x => x.classList.remove('asc','desc'));
    th.classList.add(sortDir);
    renderPage(1);
  });
});

function sortItems(items) {
  if (!sortBy) return items;
  const copy = items.slice();
  copy.sort((a, b) => {
    if (sortBy === 'id') {
      return sortDir === 'asc' ? (a.id - b.id) : (b.id - a.id);
    }
    if (sortBy === 'price') {
      return sortDir === 'asc' ? (a.price - b.price) : (b.price - a.price);
    }
    if (sortBy === 'title') {
      const va = (a.title || '').toLowerCase();
      const vb = (b.title || '').toLowerCase();
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    }
    if (sortBy === 'category') {
      const va = (a.category && a.category.name) ? a.category.name.toLowerCase() : '';
      const vb = (b.category && b.category.name) ? b.category.name.toLowerCase() : '';
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    }
    return 0;
  });
  return copy;
}

async function fetchProducts() {
  showLoader(true);
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    allProducts = data;
    filtered = allProducts;
    if (recordCount) recordCount.textContent = `Tổng: ${allProducts.length}`;
    console.log('Loaded products sample (first 5):', allProducts.slice(0,5).map(p => ({id: p.id, images: p.images})));
    renderPage(1);
  } catch (err) {
    showAlert('Không thể tải dữ liệu sản phẩm. ' + err.message, 'danger');
  } finally {
    showLoader(false);
  }
}

function showLoader(show) {
  loader.style.display = show ? 'block' : 'none';
}

function showAlert(message, type = 'info') {
  alertPlaceholder.innerHTML = `
    <div class="alert alert-${type} alert-dismissible" role="alert">
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>`;
}

function renderPage(page = 1) {
  currentPage = page;
  const sortedFiltered = sortItems(filtered);
  const start = (page - 1) * perPage;
  const pageItems = sortedFiltered.slice(start, start + perPage);
  renderProducts(pageItems);
  renderTable(pageItems);
  renderPagination(Math.ceil(filtered.length / perPage));
  if (recordCount) {
    const from = start + 1;
    const to = start + pageItems.length;
    recordCount.textContent = pageItems.length ? `Hiển thị ${from}–${to} / ${filtered.length}` : `0 sản phẩm`;
  }
}

function renderProducts(items) {
  productsGrid.innerHTML = '';
  if (!items.length) {
    productsGrid.innerHTML = '<p class="text-center">Không tìm thấy sản phẩm.</p>';
    return;
  }

  const list = document.createElement('div');
  list.className = 'list-group';

  for (const p of items) {
    const imgSrc = getImage(p);
    const item = document.createElement('div');
    item.className = 'list-group-item d-flex align-items-center gap-3';
    item.setAttribute('data-bs-toggle', 'tooltip');
    item.setAttribute('title', `${escapeHtml(p.description || '')}`);
    item.innerHTML = `
      <div style="width:60px" class="text-muted">${p.id}</div>
      <img src="${escapeHtml(imgSrc)}" class="table-thumb" alt="${escapeHtml(p.title)}">
      <div class="flex-grow-1">
        <div class="fw-semibold">${escapeHtml(p.title)}</div>
        <div class="text-muted small text-truncate" style="max-width:400px;">${escapeHtml(p.description || '')}</div>
      </div>
      <div class="text-success fw-bold me-3">$${p.price}</div>
      <div class="me-3">${escapeHtml(p.category ? p.category.name : 'N/A')}</div>
      <div><button class="btn btn-sm btn-primary" data-id="${p.id}">Xem</button></div>
    `;

    // attach image handlers
    const imgEl = item.querySelector('img');
    if (imgEl) {
      imgEl.addEventListener('error', () => handleImageError(imgEl, imgSrc));
      imgEl.addEventListener('click', () => window.open(imgSrc, '_blank'));
      imgEl.style.cursor = 'pointer';
    }

    // add button handler
    const btn = item.querySelector('button[data-id]');
    if (btn) {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const id = Number(btn.getAttribute('data-id'));
        const product = allProducts.find(x => x.id === id);
        if (product) showProductModal(product);
      });
    }

    // clicking the row opens modal (except when clicking a button/image)
    item.addEventListener('click', (ev) => {
      if (ev.target && (ev.target.tagName === 'BUTTON' || ev.target.tagName === 'IMG' || ev.target.closest('button'))) return;
      showProductModal(p);
    });

    list.appendChild(item);
  }

  productsGrid.appendChild(list);

  // initialize tooltips for list items
  productsGrid.querySelectorAll('div[data-bs-toggle="tooltip"]').forEach(el => {
    const inst = bootstrap.Tooltip.getInstance(el);
    if (inst) inst.dispose();
    new bootstrap.Tooltip(el, { container: 'body', delay: { show: 120, hide: 50 } });
  });
}

function renderTable(items) {
  if (!productsTableBody) return;
  productsTableBody.innerHTML = '';
  if (!items.length) {
    productsTableBody.innerHTML = '<tr><td colspan="6" class="text-center">Không tìm thấy sản phẩm.</td></tr>';
    return;
  }
  for (const p of items) {
    const tr = document.createElement('tr');
    const imgSrc = getImage(p);
    tr.setAttribute('data-bs-toggle', 'tooltip');
    tr.setAttribute('title', `${escapeHtml(p.description || '')}`);
    tr.innerHTML = `
      <td>${p.id}</td>
      <td><img src="${escapeHtml(imgSrc)}" class="table-thumb" alt="${escapeHtml(p.title)}"></td>
      <td>${escapeHtml(p.title)}</td>
      <td class="text-success">$${p.price}</td>
      <td>${escapeHtml(p.category ? p.category.name : 'N/A')}</td>
      <td><button class="btn btn-sm btn-primary" data-id="${p.id}">Xem</button></td>
    `;
    productsTableBody.appendChild(tr);
    const imgEl = tr.querySelector('img');
    if (imgEl) {
      imgEl.addEventListener('error', () => handleImageError(imgEl, imgSrc));
      imgEl.addEventListener('click', (ev) => { ev.stopPropagation(); window.open(imgSrc, '_blank'); });
    }

    // click row to open modal unless clicking button/img
    tr.addEventListener('click', (ev) => {
      if (ev.target && (ev.target.tagName === 'BUTTON' || ev.target.tagName === 'IMG' || ev.target.closest('button'))) return;
      showProductModal(p);
    });
  }

  // initialize bootstrap tooltips for rows (description on hover)
  productsTableBody.querySelectorAll('tr[data-bs-toggle="tooltip"]').forEach(el => {
    // dispose existing instance if any
    const inst = bootstrap.Tooltip.getInstance(el);
    if (inst) inst.dispose();
    new bootstrap.Tooltip(el, { container: 'body', delay: { show: 120, hide: 50 } });
  });

  // add event listeners for 'Xem' buttons in table
  productsTableBody.querySelectorAll('button[data-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.getAttribute('data-id'));
      const product = allProducts.find(x => x.id === id);
      if (product) showProductModal(product);
    });
  });
}

function renderPagination(pageCount) {
  paginationEl.innerHTML = '';
  if (pageCount <= 1) return;

  const createPageItem = (n, text = null, active = false) => {
    const li = document.createElement('li');
    li.className = `page-item ${active ? 'active' : ''}`;
    li.innerHTML = `<a class="page-link" href="#">${text || n}</a>`;
    li.addEventListener('click', (e) => { e.preventDefault(); renderPage(n); });
    return li;
  };

  for (let i = 1; i <= pageCount; i++) {
    paginationEl.appendChild(createPageItem(i, null, i === currentPage));
  }
}

function getImage(product) {
  if (product.images && product.images.length) return product.images[0];
  if (product.category && product.category.image) return product.category.image;
  return 'https://via.placeholder.com/400x300?text=No+Image';
}

function handleImageError(imgEl, originalSrc) {
  console.warn('Image failed to load:', originalSrc);
  imgEl.src = 'https://via.placeholder.com/400x300?text=No+Image';
  imgEl.classList.add('img-broken');
  const note = document.createElement('small');
  note.className = 'text-muted d-block small mt-2 img-source-note';
  note.textContent = originalSrc;
  const container = imgEl.closest('.card-body') || imgEl.parentElement || imgEl.closest('.list-group-item');
  if (container && !container.querySelector('.img-source-note')) container.appendChild(note);
}

function getCurrentPageItems() {
  const sortedFiltered = sortItems(filtered);
  const start = (currentPage - 1) * perPage;
  return sortedFiltered.slice(start, start + perPage);
}

function exportCsv() {
  const items = getCurrentPageItems();
  if (!items.length) {
    showAlert('Không có dữ liệu để xuất', 'warning');
    return;
  }
  const rows = [];
  rows.push(['id','title','price','category','images','description']);
  for (const p of items) {
    const images = p.images && p.images.length ? p.images.join('|') : '';
    const category = p.category ? p.category.name : '';
    rows.push([p.id, p.title, p.price, category, images, (p.description || '').replace(/\n/g, ' ')]);
  }
  const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `products_page_${currentPage}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function enableEditModal(product) {
  const modalBody = document.querySelector('#productModal .modal-body');
  modalBody.innerHTML = `
    <form id="editForm">
      <div class="mb-2">
        <label class="form-label">Title</label>
        <input name="title" class="form-control" value="${escapeHtml(product.title)}" />
      </div>
      <div class="mb-2">
        <label class="form-label">Price</label>
        <input name="price" type="number" step="0.01" class="form-control" value="${product.price}" />
      </div>
      <div class="mb-2">
        <label class="form-label">Description</label>
        <textarea name="description" class="form-control" rows="4">${escapeHtml(product.description || '')}</textarea>
      </div>
      <div class="mb-2">
        <label class="form-label">Image URL</label>
        <input name="image" class="form-control" value="${escapeHtml(getImage(product))}" />
      </div>
      <div class="mb-2">
        <label class="form-label">Category ID</label>
        <input name="categoryId" type="number" class="form-control" value="${product.category && product.category.id ? product.category.id : 1}" />
      </div>
    </form>
  `;
  if (editBtn) editBtn.style.display = 'none';
  if (saveBtn) saveBtn.style.display = '';
}

async function saveModalEdits() {
  if (!currentModalProductId) return;
  const form = document.querySelector('#editForm');
  if (!form) return;
  const payload = {
    title: form.title.value,
    price: Number(form.price.value) || 0,
    description: form.description.value || '',
    categoryId: Number(form.categoryId.value) || 1,
    images: form.image.value ? [form.image.value] : []
  };
  try {
    showLoader(true);
    const res = await fetch(`${API_URL}/${currentModalProductId}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    const text = await res.text();
    let body;
    try { body = JSON.parse(text); } catch { body = text; }
    if (!res.ok) {
      console.error('Update failed', res.status, body);
      const msg = body && body.message ? body.message : (typeof body === 'string' ? body : JSON.stringify(body));
      showAlert(`Không thể cập nhật: HTTP ${res.status} — ${msg}`, 'danger');
      return;
    }
    const updated = body;
    // update local array
    const idx = allProducts.findIndex(p => p.id === currentModalProductId);
    if (idx >= 0) allProducts[idx] = updated;
    filtered = allProducts;
    renderPage(currentPage);
    showAlert('Cập nhật thành công', 'success');
    // close or revert modal to view
    const modalBody = document.querySelector('#productModal .modal-body');
    modalBody.innerHTML = `
      <div class="row">
        <div class="col-md-5">
          <img id="modalImage" src="${escapeHtml(getImage(updated))}" class="img-fluid" alt="product image" />
        </div>
        <div class="col-md-7">
          <h4 id="modalPrice" class="text-success">$${updated.price}</h4>
          <p id="modalDescription">${escapeHtml(updated.description || '')}</p>
          <p class="mb-0"><strong>Category:</strong> <span id="modalCategory">${escapeHtml(updated.category ? updated.category.name : 'N/A')}</span></p>
          <p class="mb-0"><strong>Rating:</strong> <span id="modalRating">${updated.rating ? updated.rating : 'N/A'}</span></p>
        </div>
      </div>
    `;
    if (editBtn) editBtn.style.display = '';
    if (saveBtn) saveBtn.style.display = 'none';
  } catch (err) {
    console.error('Update error', err);
    showAlert('Không thể cập nhật: ' + err.message, 'danger');
  } finally { showLoader(false); }
}

function showProductModal(product) {
  currentModalProductId = product.id;
  document.getElementById('modalTitle').textContent = product.title;
  const modalImage = document.getElementById('modalImage');
  modalImage.src = getImage(product);
  modalImage.onerror = () => { modalImage.src = 'https://via.placeholder.com/600x400?text=No+Image'; };
  document.getElementById('modalPrice').textContent = `$${product.price}`;
  document.getElementById('modalDescription').textContent = product.description || '';
  document.getElementById('modalCategory').textContent = product.category ? product.category.name : 'N/A';
  document.getElementById('modalRating').textContent = product.rating ? product.rating : 'N/A';

  // ensure buttons state
  if (editBtn) editBtn.style.display = '';
  if (saveBtn) saveBtn.style.display = 'none';

  const modal = new bootstrap.Modal(document.getElementById('productModal'));
  modal.show();
}

function escapeHtml(unsafe) {
  return (unsafe + '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim().toLowerCase();
  if (!q) filtered = allProducts;
  else filtered = allProducts.filter(p => (p.title || '').toLowerCase().includes(q));
  renderPage(1);
});

if (perPageSelect) {
  perPageSelect.addEventListener('change', () => {
    perPage = Number(perPageSelect.value) || perPage;
    renderPage(1);
  });
}

function setSort(key) {
  if (sortBy === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
  else { sortBy = key; sortDir = 'asc'; }
  // update header classes
  document.querySelectorAll('th[data-sort]').forEach(x => x.classList.remove('asc','desc'));
  const th = document.querySelector(`th[data-sort="${key}"]`);
  if (th) th.classList.add(sortDir);
  // update small buttons text
  if (sortTitleBtn) sortTitleBtn.textContent = `Title ${sortBy==='title' ? (sortDir==='asc' ? '▲' : '▼') : ''}`;
  if (sortPriceBtn) sortPriceBtn.textContent = `Price ${sortBy==='price' ? (sortDir==='asc' ? '▲' : '▼') : ''}`;
  renderPage(1);
}

if (sortTitleBtn) sortTitleBtn.addEventListener('click', () => setSort('title'));
if (sortPriceBtn) sortPriceBtn.addEventListener('click', () => setSort('price'));

if (exportCsvBtn) exportCsvBtn.addEventListener('click', () => exportCsv());

if (createBtn) createBtn.addEventListener('click', () => {
  const cm = new bootstrap.Modal(document.getElementById('createModal'));
  cm.show();
});

if (createForm) createForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fm = e.target;

  // Client-side validation
  const title = (fm.title.value || '').trim();
  const priceVal = fm.price.value;
  const price = Number(priceVal);
  const description = (fm.description.value || '').trim();
  const categoryId = Number(fm.categoryId.value) || 1;
  const imageUrl = (fm.image.value || '').trim();

  if (!title) { showAlert('Vui lòng nhập Title', 'danger'); return; }
  if (!priceVal || isNaN(price) || price <= 0) { showAlert('Price phải là số lớn hơn 0', 'danger'); return; }

  const payload = {
    title: title,
    price: price,
    description: description,
    categoryId: categoryId,
    images: imageUrl ? [imageUrl] : []
  };

  console.log('Creating product payload:', payload);

  try {
    showLoader(true);
    const res = await fetch(API_URL, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    const text = await res.text();
    let body;
    try { body = JSON.parse(text); } catch { body = text; }
    if (!res.ok) {
      console.error('Create failed', res.status, body);
      const msg = body && body.message ? body.message : (typeof body === 'string' ? body : JSON.stringify(body));
      showAlert(`Không thể tạo sản phẩm: HTTP ${res.status} — ${msg}`, 'danger');
      return;
    }

    const created = body;
    allProducts.unshift(created);
    filtered = allProducts;
    renderPage(1);
    showAlert('Tạo sản phẩm thành công', 'success');
    const cmEl = document.getElementById('createModal');
    const cm = bootstrap.Modal.getInstance(cmEl);
    if (cm) cm.hide();
    fm.reset();
  } catch (err) {
    console.error('Create error', err);
    showAlert('Không thể tạo sản phẩm: ' + err.message, 'danger');
  } finally { showLoader(false); }
});

if (editBtn) editBtn.addEventListener('click', () => {
  if (!currentModalProductId) return;
  const product = allProducts.find(p => p.id === currentModalProductId);
  if (!product) return;
  enableEditModal(product);
});

if (saveBtn) saveBtn.addEventListener('click', () => saveModalEdits());

if (toggleViewBtn) {
  toggleViewBtn.addEventListener('click', () => {
    const isTableVisible = tableView && tableView.style.display === 'block';
    if (isTableVisible) {
      if (tableView) tableView.style.display = 'none';
      productsGrid.style.display = '';
      toggleViewBtn.textContent = 'Bảng';
    } else {
      if (tableView) tableView.style.display = 'block';
      productsGrid.style.display = 'none';
      toggleViewBtn.textContent = 'Hàng';
    }
  });
}

// Initial load
fetchProducts();