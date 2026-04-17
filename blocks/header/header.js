import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

// media query match that indicates mobile/tablet width
const isDesktop = window.matchMedia('(min-width: 900px)');

const QUERY_INDEX_URL = new URL('/query-index.json', window.location.origin).href;

/**
 * True when running in AEM (e.g. Universal Editor on author) — no Edge index at this origin.
 * @returns {boolean}
 */
function isAemAuthoringHost() {
  return typeof window !== 'undefined' && window.location.hostname.endsWith('adobeaemcloud.com');
}

/**
 * Friendly panel when we cannot show the live page list (authoring) or the index is unavailable.
 * @param {HTMLElement} panel
 * @param {'authoring' | 'unavailable'} variant
 */
function appendSiteIndexPlaceholder(panel, variant) {
  const box = document.createElement('div');
  box.className = 'nav-site-index-placeholder';

  const title = document.createElement('p');
  title.className = 'nav-site-index-placeholder-title';

  const text = document.createElement('p');
  text.className = 'nav-site-index-placeholder-text';

  if (variant === 'authoring') {
    title.textContent = 'Browse the site';
    text.textContent = 'Use the menu links above while you edit. A full list of every published page appears in Preview and on your live site.';
  } else {
    title.textContent = 'Page list unavailable';
    text.textContent = 'We cannot load the full directory here. Use Preview or your live site to explore all pages, or continue with the menu above.';
  }

  box.append(title, text);
  panel.append(box);
}

/**
 * Normalizes Helix query-index JSON to an array of rows.
 * @param {unknown} json Response JSON
 * @returns {Record<string, string>[]}
 */
function rowsFromQueryIndex(json) {
  if (Array.isArray(json)) return json;
  if (json && typeof json === 'object' && Array.isArray(json.data)) return json.data;
  return [];
}

/**
 * @param {unknown} raw
 * @returns {string}
 */
function normalizeIndexPath(raw) {
  if (typeof raw !== 'string') return '';
  let path = raw.trim();
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) {
    try {
      path = new URL(path).pathname;
    } catch {
      return '';
    }
  }
  if (!path.startsWith('/')) path = `/${path}`;
  return path;
}

/**
 * Humanize a URL segment for folder labels when no page exists at that path.
 * @param {string} seg
 */
function humanizeSegment(seg) {
  return seg
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * @typedef {object} PathTreeNode
 * @property {{ path: string, title: string } | null} page
 * @property {Map<string, PathTreeNode>} children
 */

/**
 * @returns {PathTreeNode}
 */
function createPathTreeNode() {
  return { page: null, children: new Map() };
}

/**
 * Inserts a path into the tree (path segments = hierarchy).
 * @param {PathTreeNode} root
 * @param {string} path
 * @param {string} title
 */
function insertPathIntoTree(root, path, title) {
  const segments = path === '/' ? [] : path.split('/').filter(Boolean);
  if (segments.length === 0) {
    root.page = { path, title };
    return;
  }
  let node = root;
  segments.forEach((seg, i) => {
    if (!node.children.has(seg)) {
      node.children.set(seg, createPathTreeNode());
    }
    node = /** @type {PathTreeNode} */ (node.children.get(seg));
    if (i === segments.length - 1) {
      node.page = { path, title };
    }
  });
}

/**
 * @param {Map<string, PathTreeNode>} children
 * @returns {string[]}
 */
function sortedChildKeys(children) {
  return [...children.keys()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

/**
 * @param {PathTreeNode} node
 * @param {number} depth
 * @returns {HTMLUListElement}
 */
function renderPathTree(node, depth = 0) {
  const ul = document.createElement('ul');
  ul.className = depth === 0 ? 'nav-site-index-list nav-site-index-tree' : 'nav-site-index-nested';

  if (depth === 0 && node.page) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = node.page.path;
    a.textContent = node.page.title;
    a.title = node.page.path;
    li.append(a);
    ul.append(li);
  }

  sortedChildKeys(node.children).forEach((key) => {
    const child = /** @type {PathTreeNode} */ (node.children.get(key));
    const li = document.createElement('li');
    const hasChildren = child.children.size > 0;

    if (hasChildren) {
      const details = document.createElement('details');
      details.className = 'nav-site-index-details';

      const summary = document.createElement('summary');
      summary.className = 'nav-site-index-summary';
      if (child.page) {
        const a = document.createElement('a');
        a.href = child.page.path;
        a.textContent = child.page.title;
        a.title = child.page.path;
        a.className = 'nav-site-index-summary-link';
        summary.append(a);
      } else {
        const span = document.createElement('span');
        span.className = 'nav-site-index-label';
        span.textContent = humanizeSegment(key);
        summary.append(span);
      }

      details.append(summary, renderPathTree(child, depth + 1));
      li.append(details);
    } else if (child.page) {
      const a = document.createElement('a');
      a.href = child.page.path;
      a.textContent = child.page.title;
      a.title = child.page.path;
      li.append(a);
    } else {
      const span = document.createElement('span');
      span.className = 'nav-site-index-label';
      span.textContent = humanizeSegment(key);
      li.append(span);
    }

    ul.append(li);
  });

  return ul;
}

/**
 * Builds a dropdown of all indexed pages from /query-index.json (training / discovery).
 * @returns {Promise<HTMLDivElement>}
 */
async function buildSiteIndexNav() {
  const wrap = document.createElement('div');
  wrap.className = 'nav-site-index';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'nav-site-index-toggle';
  btn.textContent = 'All pages';
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-haspopup', 'true');

  const panel = document.createElement('div');
  panel.className = 'nav-site-index-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-label', 'Site pages');

  wrap.append(btn, panel);

  if (isAemAuthoringHost()) {
    appendSiteIndexPlaceholder(panel, 'authoring');
    const panelId = `nav-site-index-panel-${Math.random().toString(36).slice(2, 9)}`;
    panel.id = panelId;
    btn.setAttribute('aria-controls', panelId);
    return wrap;
  }

  try {
    const res = await fetch(QUERY_INDEX_URL);
    if (!res.ok) throw new Error(`query-index ${res.status}`);
    const rows = rowsFromQueryIndex(await res.json());
    const seen = new Set();
    const items = rows
      .map((row) => {
        const path = normalizeIndexPath(row.path);
        const title = typeof row.title === 'string' && row.title.trim() ? row.title.trim() : path || 'Untitled';
        return { path, title };
      })
      .filter(({ path }) => {
        if (!path || !path.startsWith('/') || seen.has(path)) return false;
        seen.add(path);
        return true;
      })
      .sort((a, b) => a.path.localeCompare(b.path));

    const root = createPathTreeNode();
    items.forEach(({ path, title }) => insertPathIntoTree(root, path, title));

    const treeEl = renderPathTree(root);
    if (!treeEl.querySelector('a')) {
      const li = document.createElement('li');
      li.className = 'nav-site-index-empty';
      li.textContent = 'No pages to show yet.';
      treeEl.append(li);
    }
    panel.append(treeEl);
  } catch {
    appendSiteIndexPlaceholder(panel, 'unavailable');
  }

  const panelId = `nav-site-index-panel-${Math.random().toString(36).slice(2, 9)}`;
  panel.id = panelId;
  btn.setAttribute('aria-controls', panelId);

  return wrap;
}

/**
 * @param {Element} nav
 */
function closeSiteIndexPanel(nav) {
  const wrap = nav.querySelector('.nav-site-index');
  if (!wrap) return;
  const toggle = wrap.querySelector('.nav-site-index-toggle');
  const panel = wrap.querySelector('.nav-site-index-panel');
  if (toggle && panel) {
    toggle.setAttribute('aria-expanded', 'false');
    panel.hidden = true;
    wrap.classList.remove('nav-site-index-open');
  }
}

/**
 * @param {HTMLElement} wrap .nav-site-index
 * @param {Element} nav
 * @param {Element | null} navSections
 */
function wireSiteIndexToggle(wrap, nav, navSections) {
  const toggle = wrap.querySelector('.nav-site-index-toggle');
  const panel = wrap.querySelector('.nav-site-index-panel');
  if (!toggle || !panel) return;

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = toggle.getAttribute('aria-expanded') === 'true';
    if (navSections) {
      navSections.querySelectorAll('.nav-drop').forEach((li) => {
        li.setAttribute('aria-expanded', 'false');
      });
    }
    if (open) {
      toggle.setAttribute('aria-expanded', 'false');
      panel.hidden = true;
      wrap.classList.remove('nav-site-index-open');
    } else {
      toggle.setAttribute('aria-expanded', 'true');
      panel.hidden = false;
      wrap.classList.add('nav-site-index-open');
    }
  });

  panel.addEventListener('click', (e) => {
    if (e.target instanceof HTMLAnchorElement) closeSiteIndexPanel(nav);
  });
}

function closeOnEscape(e) {
  if (e.code === 'Escape') {
    const nav = document.getElementById('nav');
    const siteToggle = nav.querySelector('.nav-site-index-toggle[aria-expanded="true"]');
    if (siteToggle) {
      closeSiteIndexPanel(nav);
      siteToggle.focus();
      return;
    }
    const navSections = nav.querySelector('.nav-sections');
    const navSectionExpanded = navSections?.querySelector('[aria-expanded="true"]');
    if (navSectionExpanded && isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleAllNavSections(navSections);
      navSectionExpanded.focus();
    } else if (!isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleMenu(nav, navSections);
      nav.querySelector('button').focus();
    }
  }
}

function closeOnFocusLost(e) {
  const nav = e.currentTarget;
  if (!nav.contains(e.relatedTarget)) {
    closeSiteIndexPanel(nav);
    const navSections = nav.querySelector('.nav-sections');
    const navSectionExpanded = navSections?.querySelector('[aria-expanded="true"]');
    if (navSectionExpanded && isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleAllNavSections(navSections, false);
    } else if (!isDesktop.matches) {
      // eslint-disable-next-line no-use-before-define
      toggleMenu(nav, navSections, false);
    }
  }
}

function openOnKeydown(e) {
  const focused = document.activeElement;
  const isNavDrop = focused.className === 'nav-drop';
  if (isNavDrop && (e.code === 'Enter' || e.code === 'Space')) {
    const dropExpanded = focused.getAttribute('aria-expanded') === 'true';
    // eslint-disable-next-line no-use-before-define
    toggleAllNavSections(focused.closest('.nav-sections'));
    focused.setAttribute('aria-expanded', dropExpanded ? 'false' : 'true');
  }
}

function focusNavSection() {
  document.activeElement.addEventListener('keydown', openOnKeydown);
}

/**
 * Toggles all nav sections
 * @param {Element} sections The container element
 * @param {Boolean} expanded Whether the element should be expanded or collapsed
 */
function toggleAllNavSections(sections, expanded = false) {
  const rootNav = document.getElementById('nav');
  if (rootNav) closeSiteIndexPanel(rootNav);
  if (!sections) return;
  sections.querySelectorAll('.nav-sections .default-content-wrapper > ul > li').forEach((section) => {
    section.setAttribute('aria-expanded', expanded);
  });
}

/**
 * Toggles the entire nav
 * @param {Element} nav The container element
 * @param {Element} navSections The nav sections within the container element
 * @param {*} forceExpanded Optional param to force nav expand behavior when not null
 */
function toggleMenu(nav, navSections, forceExpanded = null) {
  const expanded = forceExpanded !== null ? !forceExpanded : nav.getAttribute('aria-expanded') === 'true';
  const button = nav.querySelector('.nav-hamburger button');
  document.body.style.overflowY = (expanded || isDesktop.matches) ? '' : 'hidden';
  nav.setAttribute('aria-expanded', expanded ? 'false' : 'true');
  toggleAllNavSections(navSections, expanded || isDesktop.matches ? 'false' : 'true');
  button.setAttribute('aria-label', expanded ? 'Open navigation' : 'Close navigation');
  // enable nav dropdown keyboard accessibility
  const navDrops = navSections?.querySelectorAll('.nav-drop') ?? [];
  if (isDesktop.matches) {
    navDrops.forEach((drop) => {
      if (!drop.hasAttribute('tabindex')) {
        drop.setAttribute('tabindex', 0);
        drop.addEventListener('focus', focusNavSection);
      }
    });
  } else {
    navDrops.forEach((drop) => {
      drop.removeAttribute('tabindex');
      drop.removeEventListener('focus', focusNavSection);
    });
  }

  // enable menu collapse on escape keypress
  if (!expanded || isDesktop.matches) {
    // collapse menu on escape press
    window.addEventListener('keydown', closeOnEscape);
    // collapse menu on focus lost
    nav.addEventListener('focusout', closeOnFocusLost);
  } else {
    window.removeEventListener('keydown', closeOnEscape);
    nav.removeEventListener('focusout', closeOnFocusLost);
  }
}

/**
 * loads and decorates the header, mainly the nav
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  // load nav as fragment
  const navMeta = getMetadata('nav');
  const navPath = navMeta ? new URL(navMeta, window.location).pathname : '/nav';
  const fragment = await loadFragment(navPath);

  // decorate nav DOM
  block.textContent = '';
  const nav = document.createElement('nav');
  nav.id = 'nav';
  while (fragment.firstElementChild) nav.append(fragment.firstElementChild);

  const classes = ['brand', 'sections', 'tools'];
  classes.forEach((c, i) => {
    const section = nav.children[i];
    if (section) section.classList.add(`nav-${c}`);
  });

  const navBrand = nav.querySelector('.nav-brand');
  const brandLogo = navBrand.querySelector('picture');

  if (brandLogo) {
    // Replace the first section's contents with the authored image wrapped with a link to '/'
    navBrand.innerHTML = `<a href="/" aria-label="Home" title="Home" class="home">${brandLogo.outerHTML}</a>`;
    navBrand.querySelector('img').setAttribute('loading', 'eager');
  }

  const navSections = nav.querySelector('.nav-sections');
  if (navSections) {
    // Remove Edge Delivery Services button containers and buttons from the nav sections links
    navSections.querySelectorAll('.button-container, .button').forEach((button) => {
      button.classList = '';
    });

    navSections.querySelectorAll(':scope .default-content-wrapper > ul > li').forEach((navSection) => {
      if (navSection.querySelector('ul')) navSection.classList.add('nav-drop');
      navSection.addEventListener('click', () => {
        if (isDesktop.matches) {
          closeSiteIndexPanel(nav);
          const expanded = navSection.getAttribute('aria-expanded') === 'true';
          toggleAllNavSections(navSections);
          navSection.setAttribute('aria-expanded', expanded ? 'false' : 'true');
        }
      });
    });
  }

  const siteIndexWrap = await buildSiteIndexNav();
  if (navSections && siteIndexWrap) {
    navSections.append(siteIndexWrap);
    wireSiteIndexToggle(siteIndexWrap, nav, navSections);
  }

  // hamburger for mobile
  const hamburger = document.createElement('div');
  hamburger.classList.add('nav-hamburger');
  hamburger.innerHTML = `<button type="button" aria-controls="nav" aria-label="Open navigation">
      <span class="nav-hamburger-icon"></span>
    </button>`;
  hamburger.addEventListener('click', () => toggleMenu(nav, navSections));
  nav.prepend(hamburger);
  nav.setAttribute('aria-expanded', 'false');
  // prevent mobile nav behavior on window resize
  toggleMenu(nav, navSections, isDesktop.matches);
  isDesktop.addEventListener('change', () => toggleMenu(nav, navSections, isDesktop.matches));

  const navWrapper = document.createElement('div');
  navWrapper.className = 'nav-wrapper';
  navWrapper.append(nav);
  block.append(navWrapper);
}
