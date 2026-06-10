import { useLocation, useParams } from "react-router-dom";
import ArticlesPagination from "../../components/ArticlesPagination";
import ArticlesPreview from "../../components/ArticlesPreview";
import useArticleList from "../../hooks/useArticles";

function ProfileArticles() {
  const { username } = useParams();
  const { pathname } = useLocation();
  const isDrafts = pathname.endsWith("/drafts");

  const { articles, articlesCount, loading, setArticlesData } = useArticleList({
    location: isDrafts ? "drafts" : "profile",
    username,
  });

  return loading ? (
    <div className="article-preview">
      <em>正在加载{isDrafts ? "草稿" : `${username} 的文章`}...</em>
    </div>
  ) : articles.length > 0 ? (
    <>
      <ArticlesPreview
        articles={articles}
        loading={loading}
        updateArticles={setArticlesData}
      />

      <ArticlesPagination
        articlesCount={articlesCount}
        location={isDrafts ? "drafts" : "profile"}
        updateArticles={setArticlesData}
        username={username}
      />
    </>
  ) : (
    <div className="article-preview">{isDrafts ? "暂无草稿。" : `${username} 还没有发布文章。`}</div>
  );
}

export default ProfileArticles;
