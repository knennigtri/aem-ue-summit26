/**
 * Content Fragment Block
 * Displays a single content fragment selected via Universal Editor picker
 */

// eslint-disable-next-line import/no-unresolved
import { getAEMHost, getAdventureByPath } from '../../scripts/aem-gql-connection.js';

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

function createDisplay(contentFragment) {
  const { keys } = contentFragment; // String version of keys in adventureByPath query
  const { data } = contentFragment;

  let innerHTML = '';
  // eslint-disable-next-line no-underscore-dangle
  const cfPath = data._path;

  // data-aue-resource
  //    Connects to the source content fragment for editing capabilities in the Universal Editor
  // data-aue-type
  //    Tells the Universal Editor this is a reference item
  // data-aue-label
  //    Title of the phantom reference item under the block in the Universal Editor Content Tree
  innerHTML
  += `<div class="headless-wrapper">
    <div class="content-fragment-detail"
        data-aue-resource="urn:aemconnection:${cfPath}/jcr:content/data/master" 
        data-aue-type="reference" 
        data-aue-label="${data[keys.title]}">`;
  // eslint-disable-next-line no-underscore-dangle
  const cfPrimaryImagePath = data[keys.primaryImage]._path;
  innerHTML
        += `<div class="content-fragment-hero">
            <div class="content-fragment-image">
                <picture>
                    <source srcset="${getAEMHost()}${cfPrimaryImagePath}?width=1200&format=webply&optimize=medium" type="image/webp">
                    <img src="${getAEMHost()}${cfPrimaryImagePath}?width=1200&format=webply&optimize=medium" alt="${data[keys.title]}" loading="lazy">
                </picture>
            </div>
            <div class="content-fragment-${keys.title}-overlay">
                <h1 class="content-fragment-${keys.title}">${data[keys.title]}</h1>
            </div>
        </div>
        <div class="content-fragment-content">
            <div class="content-fragment-details-grid">`;
  const details = [keys.activity, keys.difficulty, keys.tripLength, keys.groupSize, keys.price];
  details.forEach((detail) => {
    if (data[detail]) {
      innerHTML += `<div class="content-fragment-detail-item">
                        <span class="detail-label">${formatLabel(detail)}</span>
                        <span class="detail-value">${data[detail]}</span>
                    </div>`;
    }
  });
  innerHTML
        += `</div>
            <div class="content-fragment-${keys.description}">
                  <h2>About This Adventure</h2>
                  <div class="content-fragment-${keys.description}-content">
                      ${data[keys.description].html || data[keys.description].plaintext}
                  </div>
              </div>
              <div class="content-fragment-${keys.itinerary}">
                  <h2>Itinerary</h2>
                  <div class="content-fragment-${keys.itinerary}-content">
                      ${data[keys.itinerary].html || data[keys.itinerary].plaintext}
                  </div>
              </div>
          </div>
    </div>
    </div>`;
  return innerHTML;
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

    /*
    Because the content fragment is a reference property,
      we can rewrite the entire block with the content fragment data
    Caution with doing this with default content and inferred elements
      since UE it renders the block with special aue attributes
    Learn more about inferred elements here:
      https://www.aem.live/developer/component-model-definitions#creating-semantic-content-models-for-blocks
    */
    block.innerHTML = createDisplay(contentFragment);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Content Fragment block error:', error);
    showError(block, 'Failed to load content fragment');
  }
}
