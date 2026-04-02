/**
 * Content Fragment Block
 * Displays a single content fragment selected via Universal Editor picker
 */

/**
 * Show error state
 */
function showError(block, message) {
  block.innerHTML = `<div class="content-fragment-error">Error: ${message}</div>`;
}

/**
 * Show empty/no selection state
 */
function showEmpty(block) {
  const emptyMessage = 'No content fragment selected. Use the Universal Editor to select a content fragment.';
  block.innerHTML = `<div class="content-fragment-empty">${emptyMessage}</div>`;
}

/**
 * Main decoration function
 */
export default async function decorate(block) {
  // Get the content fragment path from the UE generated content in the DOM
  const cfPath = block.querySelector('a')?.textContent;
  if (!cfPath) {
    showEmpty(block);
    return;
  }

  try {
    // Fetch the content fragment via persisted query
    // from aem-gql-connection.js (contains author/publish endpoints)
    // eslint-disable-next-line no-undef
    const contentFragment = await getAdventureByPath(cfPath);

    if (!contentFragment) {
      showError(block, 'Content fragment not found');
      return;
    }

    block.innerHTML = `<div class="content-fragment" style="text-align:center;font-style:italic;">Content Fragment Selected: ${cfPath}</div>`;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Content Fragment block error:', error);
    showError(block, 'Failed to load content fragment');
  }
}
