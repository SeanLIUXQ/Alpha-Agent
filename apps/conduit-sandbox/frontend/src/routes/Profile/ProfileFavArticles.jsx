import { useParams } from "react-router-dom";
import ArticlesPagination from "../../components/ArticlesPagination";
import ArticlesPreview from "../../components/ArticlesPreview";
import useArticleList from "../../hooks/useArticles";

function ProfileFavArticles() {
  const { username } = useParams();

  const { articles, articlesCount, loading, setArticlesData } = useArticleList({
    location: "favorites",
    username,
  });

  return loading ? (
    <div className="article-preview">
      <em>正在加载 {username} 收藏的文章...</em>
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
        location="favorites"
        updateArticles={setArticlesData}
        username={username}
      />
    </>
  ) : (
    <div className="article-preview">{username} 还没有收藏文章。</div>
  );
}

export default ProfileFavArticles;
