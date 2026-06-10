import Markdown from "markdown-to-jsx";
import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import ArticleMeta from "../../components/ArticleMeta";
import ArticlesButtons from "../../components/ArticlesButtons";
import ArticleTags from "../../components/ArticleTags";
import BannerContainer from "../../components/BannerContainer";
import { useAuth } from "../../context/AuthContext";
import { formatReadingStats } from "../../helpers/formatters";
import getArticle from "../../services/getArticle";

function getArticleReadingStats(body = "") {
  const plainText = body.replace(/[#>*_`~\-[\]()]/g, " ").replace(/\s+/g, " ").trim();
  const wordCount = plainText ? plainText.split(" ").length : 0;
  const readingMinutes = Math.max(1, Math.ceil(wordCount / 200));

  return { wordCount, readingMinutes };
}

async function writeTextToClipboard(text) {
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the legacy copy path. Some embedded previews deny
      // navigator.clipboard even on localhost.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.width = "1px";
  textarea.style.height = "1px";
  textarea.style.padding = "0";
  textarea.style.border = "0";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus({ preventScroll: true });
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  let copied = false;
  try {
    copied = document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }

  return copied;
}

function Article() {
  const { state } = useLocation();
  const [article, setArticle] = useState(state || {});
  const { title, body, coverImage, tagList, createdAt, author } = article || {};
  const { headers, isAuth } = useAuth();
  const navigate = useNavigate();
  const { slug } = useParams();
  const { wordCount, readingMinutes } = getArticleReadingStats(body);
  const [copyStatus, setCopyStatus] = useState("");
  const [publishSuccessVisible, setPublishSuccessVisible] = useState(Boolean(state?.publishSuccess));

  const copyArticleLink = async () => {
    const articleUrl = window.location.href;
    const copied = await writeTextToClipboard(articleUrl);

    if (copied) {
      setCopyStatus("链接已复制");
    } else {
      setCopyStatus("复制失败，请手动复制地址栏链接");
    }

    window.setTimeout(() => setCopyStatus(""), 2200);
  };

  useEffect(() => {
    if (!publishSuccessVisible) return;

    const timer = window.setTimeout(() => setPublishSuccessVisible(false), 3200);
    return () => window.clearTimeout(timer);
  }, [publishSuccessVisible]);

  useEffect(() => {
    if (state) return;

    getArticle({ slug, headers })
      .then(setArticle)
      .catch((error) => {
        console.error(error);
        navigate("/not-found", { replace: true });
      });
  }, [isAuth, slug, headers, state, navigate]);

  return (
    <div className="article-page">
      {publishSuccessVisible && (
        <div className="article-publish-success-banner" role="status">
          文章已发布
        </div>
      )}
      <BannerContainer>
        <h1>{title}</h1>
        <ArticleMeta author={author} createdAt={createdAt}>
          <ArticlesButtons article={article} setArticle={setArticle} />
        </ArticleMeta>
        <div className="article-share-actions">
          <button className="btn btn-sm btn-outline-secondary copy-article-link" type="button" onClick={copyArticleLink}>
            复制文章链接
          </button>
          {copyStatus && (
            <span className="copy-article-link-status" role="status">
              {copyStatus}
            </span>
          )}
        </div>
      </BannerContainer>

      <div className="container page">
        <div className="row article-content">
          <div className="col-md-12">
            {coverImage && <img className="article-cover-image" src={coverImage} alt="" />}
            {body && <Markdown options={{ forceBlock: true }}>{body}</Markdown>}
            {body && (
              <p className="article-reading-stats">
                {formatReadingStats(wordCount, readingMinutes)}
              </p>
            )}
            <ArticleTags tagList={tagList} />
          </div>
        </div>

        <hr />

        <div className="article-actions">
          <ArticleMeta author={author} createdAt={createdAt}>
            <ArticlesButtons article={article} setArticle={setArticle} />
          </ArticleMeta>
        </div>

        <Outlet />
      </div>
    </div>
  );
}

export default Article;
