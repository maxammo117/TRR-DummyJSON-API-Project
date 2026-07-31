/* The Reference Room — watch shop
   Data comes from the DummyJSON demo API. */
(function () {
  'use strict';

  var API = 'https://dummyjson.com/products/category/';
  var CATEGORIES = ['mens-watches', 'womens-watches'];

  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s, r) {
    return Array.prototype.slice.call((r || document).querySelectorAll(s));
  };

  var state = {
    all: [],
    category: 'all',
    query: '',
    brands: [],
    maxPrice: Infinity,
    minRating: 0,
    sort: 'az'
  };

  var el = {
    grid: $('#grid'), count: $('#count'),
    loading: $('#loading'), error: $('#error'), errorMsg: $('#error-msg'), empty: $('#empty'),
    q: $('#q'), clear: $('#clear'), sort: $('#sort'),
    brands: $('#brands'), price: $('#price'), priceOut: $('#price-out'),
    rating: $('#rating'),
    fToggle: $('#filters-toggle'), fBody: $('#filters-body')
  };

  /* ---------------------------------------------------- 1. FETCH */

  function show(which) {
    el.loading.hidden = which !== 'loading';
    el.error.hidden   = which !== 'error';
    el.empty.hidden   = which !== 'empty';
    el.grid.hidden    = which !== 'results';
  }

  /* Turn one API product into the shape this page uses. If the API
     ever changes its field names, this is the only place to fix. */
  function toWatch(p) {
    var off = p.discountPercentage || 0;
    return {
      id: p.id,
      title: p.title || 'Untitled',
      brand: p.brand || 'Unbranded',
      category: p.category,
      price: p.price || 0,
      salePrice: +(p.price * (1 - off / 100)).toFixed(2),
      discount: off,
      rating: p.rating || 0,
      stock: p.stock || 0,
      added: (p.meta && p.meta.createdAt) ? Date.parse(p.meta.createdAt) : 0,
      image: p.thumbnail || (p.images && p.images[0]) || ''
    };
  }

  async function load() {
    show('loading');
    el.count.textContent = 'Loading…';

    try {
      /* One request per category, both in flight at once. */
      var responses = await Promise.all(CATEGORIES.map(function (c) {
        return fetch(API + c);
      }));

      responses.forEach(function (r, i) {
        if (!r.ok) throw new Error(CATEGORIES[i] + ' returned ' + r.status);
      });

      var payloads = await Promise.all(responses.map(function (r) { return r.json(); }));

      var products = [];
      payloads.forEach(function (p) {
        if (p && p.products) products = products.concat(p.products);
      });

      if (!products.length) throw new Error('The API returned no watches');

      state.all = products.map(toWatch);
      buildFilters();
      apply();

    } catch (err) {
      show('error');
      el.count.textContent = 'Could not load';
      el.errorMsg.textContent = navigator.onLine === false
        ? 'You appear to be offline. Reconnect and try again.'
        : err.message + '. Check your connection, or open DevTools and look at the Network tab.';
    }
  }

  /* ------------------------------------------- 2. BUILD FILTERS */

  function buildFilters() {
    var counts = {};
    state.all.forEach(function (w) { counts[w.brand] = (counts[w.brand] || 0) + 1; });

    el.brands.innerHTML = Object.keys(counts).sort().map(function (b) {
      return '<label><input type="checkbox" value="' + b + '">' +
             '<span>' + b + '</span><span class="n">' + counts[b] + '</span></label>';
    }).join('');

    $$('input', el.brands).forEach(function (cb) {
      cb.addEventListener('change', function () {
        state.brands = $$('input:checked', el.brands).map(function (x) { return x.value; });
        apply();
      });
    });

    var top = Math.ceil(Math.max.apply(null, state.all.map(function (w) { return w.price; })));
    el.price.min = 0;
    el.price.max = top;
    el.price.value = top;
    state.maxPrice = top;
    el.priceOut.textContent = 'Any';
  }

  /* --------------------------------- 3. FILTER, SEARCH AND SORT */

  var sorters = {
    az:    function (a, b) { return a.title.localeCompare(b.title); },
    za:    function (a, b) { return b.title.localeCompare(a.title); },
    /* meta.createdAt can be identical across products, so id breaks the tie
       and the order still changes visibly. */
    new:   function (a, b) { return (b.added - a.added) || (b.id - a.id); },
    old:   function (a, b) { return (a.added - b.added) || (a.id - b.id); },
    cheap: function (a, b) { return a.salePrice - b.salePrice; },
    dear:  function (a, b) { return b.salePrice - a.salePrice; },
    rated: function (a, b) { return b.rating - a.rating; }
  };

  function apply() {
    var q = state.query.trim().toLowerCase();

    var list = state.all.filter(function (w) {
      if (state.category !== 'all' && w.category !== state.category) return false;
      if (w.salePrice > state.maxPrice) return false;
      if (w.rating < state.minRating) return false;
      if (state.brands.length && state.brands.indexOf(w.brand) === -1) return false;
      if (q && (w.title + ' ' + w.brand).toLowerCase().indexOf(q) === -1) return false;
      return true;
    });

    list.sort(sorters[state.sort]);
    render(list);
  }

  /* ------------------------------------------------- 4. RENDER */

  function money(n) {
    return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function render(list) {
    el.count.innerHTML = '<b>' + list.length + '</b> watch' + (list.length === 1 ? '' : 'es');

    if (!list.length) { show('empty'); return; }
    show('results');

    el.grid.innerHTML = list.map(function (w) {
      /* Image URLs from this API contain spaces, so they need encoding. */
      var src = w.image ? encodeURI(w.image) : '';
      var img = src
        ? '<img src="' + src + '" alt="' + esc(w.title) + '" loading="lazy" ' +
          'onerror="this.parentNode.innerHTML=\'<p class=missing>No photo</p>\'">'
        : '<p class="missing">No photo</p>';

      var priceHtml = w.discount > 0
        ? '<s>' + money(w.price) + '</s>' + money(w.salePrice)
        : money(w.price);

      return '' +
      '<li class="card">' +
        '<div class="card-img">' + img + '</div>' +
        '<div class="card-body">' +
          '<p class="card-brand">' + esc(w.brand) + '</p>' +
          '<h2 class="card-title">' + esc(w.title) + '</h2>' +
          '<div class="card-meta">' +
            '<span class="price">' + priceHtml + '</span>' +
            '<span class="rating">' + w.rating.toFixed(1) + ' \u2605</span>' +
          '</div>' +
        '</div>' +
      '</li>';
    }).join('');
  }

  /* ----------------------------------------------- 5. CONTROLS */

  /* category nav */
  $$('.nav-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      state.category = btn.dataset.cat;
      $$('.nav-btn').forEach(function (b) { b.removeAttribute('aria-current'); });
      btn.setAttribute('aria-current', 'page');
      apply();
    });
  });

  /* search, debounced */
  var timer;
  el.q.addEventListener('input', function () {
    el.clear.hidden = !el.q.value;
    clearTimeout(timer);
    timer = setTimeout(function () { state.query = el.q.value; apply(); }, 180);
  });

  $('#search-form').addEventListener('submit', function (e) {
    e.preventDefault();
    clearTimeout(timer);
    state.query = el.q.value;
    apply();
  });

  el.clear.addEventListener('click', function () {
    el.q.value = state.query = '';
    el.clear.hidden = true;
    el.q.focus();
    apply();
  });

  /* price */
  el.price.addEventListener('input', function () {
    state.maxPrice = Number(el.price.value);
    el.priceOut.textContent = state.maxPrice >= Number(el.price.max)
      ? 'Any' : 'Up to ' + money(state.maxPrice);
    apply();
  });

  /* rating */
  $$('button', el.rating).forEach(function (b) {
    b.addEventListener('click', function () {
      state.minRating = Number(b.dataset.min);
      $$('button', el.rating).forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
      b.setAttribute('aria-pressed', 'true');
      apply();
    });
  });

  /* sort */
  el.sort.addEventListener('change', function () {
    state.sort = el.sort.value;
    apply();
  });

  /* reset */
  function reset() {
    state.query = '';
    state.brands = [];
    state.minRating = 0;
    el.q.value = '';
    el.clear.hidden = true;
    $$('input', el.brands).forEach(function (cb) { cb.checked = false; });
    $$('button', el.rating).forEach(function (b, i) {
      b.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
    });
    el.price.value = el.price.max;
    state.maxPrice = Number(el.price.max);
    el.priceOut.textContent = 'Any';
    apply();
  }
  $('#reset').addEventListener('click', reset);
  $('#empty-reset').addEventListener('click', reset);
  $('#retry').addEventListener('click', load);

  /* filters panel on small screens */
  el.fToggle.addEventListener('click', function () {
    var open = el.fBody.classList.toggle('open');
    el.fToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  load();
})();
