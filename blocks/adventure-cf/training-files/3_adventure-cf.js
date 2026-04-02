/**
 * Content Fragment Block
 * Displays a single content fragment selected via Universal Editor picker
 */

// eslint-disable-next-line import/no-unresolved
import { getAdventureByPath } from '../../scripts/aem-gql-connection.js';

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

// Format label for display
// Converts camelCase to spaced words with first letter capitalized
// e.g., "tripLength" becomes "Trip Length"
function formatLabel(key) {
  return key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
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
    const contentFragment = await getAdventureByPath(cfPath);

    if (!contentFragment) {
      showError(block, 'Content fragment not found');
      return;
    }

    // eslint-disable-next-line no-console
    console.log('Content Fragment:', contentFragment.data); // Retrieves data from the content fragment based on the adventure-by-path query
    // eslint-disable-next-line no-console
    console.log('Content Fragment:', contentFragment.keys); // Retrieves keys defined in the adventure-by-path query

    let display = '';
    Object.keys(contentFragment.data).forEach((key) => {
      const label = formatLabel(key);
      const value = contentFragment.data[key];
      display += `<div> ${label}: ${value} </div>`;
    });

    block.innerHTML = display;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Content Fragment block error:', error);
    showError(block, 'Failed to load content fragment');
  }
}
