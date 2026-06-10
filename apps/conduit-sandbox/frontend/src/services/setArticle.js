import axios from "axios";
import errorHandler from "../helpers/errorHandler";

async function setArticle({
  body,
  coverImage,
  description,
  headers,
  slug,
  status,
  tagList,
  title,
}) {
  try {
    const request = {
      method: slug ? "put" : "post",
      url: slug ? `api/articles/${slug}` : "api/articles",
      headers,
      data: {
        article: {
          title,
          description,
          coverImage,
          body,
          status,
          tagList,
        },
      },
    };
    const { data } = await axios(request);

    return data.article.slug;
  } catch (error) {
    errorHandler(error);
  }
}

export default setArticle;
