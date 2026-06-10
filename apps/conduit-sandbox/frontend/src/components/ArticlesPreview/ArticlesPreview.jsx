import { Link } from "react-router-dom";
import { formatTagCount } from "../../helpers/formatters";
import ArticleMeta from "../ArticleMeta";
import ArticleTags from "../ArticleTags";
import FavButton from "../FavButton";

function ArticlesPreview({ articles, loading, updateArticles }) {
  const handleFav = (article) => {
    const items = [...articles];

    const updatedArticles = items.map((item) =>
      item.slug === article.slug ? { ...item, ...article } : item,
    );

    updateArticles((prev) => ({ ...prev, articles: updatedArticles }));
  };

  return articles?.length > 0 ? (
    articles.map((article) => {
      return (
        <div className="article-preview" key={article.slug}>
          <ArticleMeta author={article.author} createdAt={article.createdAt}>
            <FavButton
              favorited={article.favorited}
              favoritesCount={article.favoritesCount}
              handler={handleFav}
              right
              slug={article.slug}
            />
          </ArticleMeta>
          <Link
            to={`/article/${article.slug}`}
            state={article}
            className="preview-link"
          >
            {article.coverImage && <img className="article-preview-cover" src={article.coverImage} alt="" />}
            <h1>{article.title}</h1>
            <p>{article.description}</p>
            <span className="article-preview-actions">
              <span className="article-read-more-hint">阅读全文</span>
              <span className="article-tag-count">{formatTagCount(article.tagList?.length ?? 0)}</span>
            </span>
            <ArticleTags tagList={article.tagList} />
          </Link>
        </div>
      );
    })
  ) : loading ? (
    <div className="article-preview">正在加载文章...</div>
  ) : (
    <div className="article-preview">暂无文章。</div>
  );
}

export default ArticlesPreview;
