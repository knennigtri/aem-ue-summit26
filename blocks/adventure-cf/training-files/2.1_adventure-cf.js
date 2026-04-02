/**
 * Content Fragment Block
 * Displays a single content fragment selected via Universal Editor picker
 */

/**
 * Main decoration function
 */
export default async function decorate(block) {
  // Get the content fragment path from the UE generated content in the DOM
  const cfPath = block.querySelector('a')?.textContent;
  if (!cfPath) {
    block.innerHTML = '<div>No content fragment selected. Use the Universal Editor to select a content fragment.</div>';
    return;
  }
  // Display the content fragment path that was selected from the Asset Picker
  block.innerHTML = `<div class="content-fragment" style="text-align:center;font-style:italic;">Content Fragment Selected: ${cfPath}</div>`;
}
