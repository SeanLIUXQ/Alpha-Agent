import ArticlesPagination from "../components/ArticlesPagination";
import ArticlesPreview from "../components/ArticlesPreview";
import { useFeedContext } from "../context/FeedContext";
import useArticleList from "../hooks/useArticles";

function HomeArticles() {
  const { tabName, tagName } = useFeedContext();

  const { articles, articlesCount, loading, setArticlesData } = useArticleList({
    location: tabName,
    tabName,
    tagName,
  });

  return loading ? (
    <div className="article-preview">
      <em>正在加载文章列表...</em>
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
        location={tabName}
        tagName={tagName}
        updateArticles={setArticlesData}
      />
    </>
  ) : (
    <div className="article-preview">暂无可显示的文章。</div>
  );
}

export default HomeArticles;
