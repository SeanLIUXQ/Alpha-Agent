import axios from "axios";
import errorHandler from "../helpers/errorHandler";

const publicLocations = new Set(["global", "profile", "tag"]);

// prettier-ignore
async function getArticles({ headers, limit = 3, location, page = 0, tagName, username }) {
  try {
    const url = {
      drafts: `api/articles?author=${username}&&status=draft&&limit=${limit}&&offset=${page}`,
      favorites: `api/articles?favorited=${username}&&limit=${limit}&&offset=${page}`,
      feed: `api/articles/feed?limit=${limit}&&offset=${page}`,
      global: `api/articles?limit=${limit}&&offset=${page}`,
      profile: `api/articles?author=${username}&&limit=${limit}&&offset=${page}`,
      tag: `api/articles?tag=${tagName}&&limit=${limit}&&offset=${page}`,
    };

    const request = { url: url[location], headers };
    const { data } = await axios(request);

    return data;
  } catch (error) {
    if (headers && publicLocations.has(location) && [401, 403, 404].includes(error.response?.status)) {
      const { data } = await axios({ url: error.config.url });

      return data;
    }

    errorHandler(error);
  }
}

export default getArticles;
