// Dynamic switching for Universal Editor (author) and .aem.page/aem.live (publish)
function getAEMHost() {
  let host;
  if (window.location.hostname.endsWith('adobeaemcloud.com')) {
    host = 'https://author-p156903-e1726641.adobeaemcloud.com';
  } else {
    host = 'https://publish-p156903-e1726641.adobeaemcloud.com';
  }
  // Remove trailing slash if present
  if (host.endsWith('/')) {
    host = host.slice(0, -1);
  }
  return host;
}

function getCDNCacheBuster() {
  if (window.location.hostname.endsWith('adobeaemcloud.com')) {
    return true;
  }
  return false;
}

/**
 * Private, shared function that makes GraphQL requests using native fetch.
 *
 * @param {String} persistedQueryName the fully qualified name of the persisted query
 * @param {*} queryParameters an optional JavaScript object containing query parameters
 * @returns the GraphQL data or an error message
 */
async function fetchPersistedQuery(persistedQueryName, queryParameters) {
  let data;
  let err;

  try {
    const host = getAEMHost();
    // eslint-disable-next-line no-console
    console.debug(`Running GraphQL queries from: ${host}`);
    // Build the URL for the persisted query
    let url = `${host}/graphql/execute.json/${persistedQueryName}`;

    // Add query variables to URL if provided
    if (queryParameters) {
      Object.entries(queryParameters).forEach(([key, value]) => {
        url += `;${key}=${value}`;
      });
    }

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (result.errors) {
      throw new Error(`GraphQL errors: ${result.errors.map((e) => e.message).join(', ')}`);
    }

    data = result.data;
  } catch (e) {
    // An error occurred, return the error message
    err = e.message;
    // eslint-disable-next-line no-console
    console.error('GraphQL request failed:', e);
  }

  // Return the GraphQL and any errors
  return { data, err };
}

const WKND_CONTEXT = {
  endpoint: 'wknd-shared',
  query: {
    adventureByPath: 'adventure-by-path',
  },
};

// keys as strings for adventureByPath query
const adventureByPathKeys = {
  title: 'title',
  description: 'description',
  adventureType: 'adventureType',
  tripLength: 'tripLength',
  activity: 'activity',
  groupSize: 'groupSize',
  difficulty: 'difficulty',
  price: 'price',
  primaryImage: 'primaryImage',
  itinerary: 'itinerary',
};

/**
 * Fetch adventure by path - vanilla JavaScript version
 * @param {String} path the content fragment path
 * @returns Promise with adventure data or error
 */
async function getAdventureByPath(path) {
  const queryParameters = {
    adventurePath: path,
    imageFormat: 'JPG',
    imageSeoName: '',
    imageWidth: 1200,
    imageQuality: 80,
  };

  // Add cache busting for development
  if (getCDNCacheBuster()) {
    queryParameters.timestamp = new Date().getTime();
  }

  const { data, err } = await fetchPersistedQuery(
    `${WKND_CONTEXT.endpoint}/${WKND_CONTEXT.query.adventureByPath}`,
    queryParameters,
  );

  if (err) {
    throw new Error(err);
  }

  return { data: data?.adventureByPath?.item, keys: adventureByPathKeys };
}

export {
  getAEMHost, getCDNCacheBuster, getAdventureByPath,
};
