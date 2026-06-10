import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import FormFieldset from "../FormFieldset";
import { useAuth } from "../../context/AuthContext";
import getArticle from "../../services/getArticle";
import setArticle from "../../services/setArticle";

const emptyForm = {
  title: "",
  description: "",
  coverImage: "",
  body: "",
  tagList: "",
  status: "published",
};

function normalizeTagList(tagList) {
  if (Array.isArray(tagList)) {
    return tagList.join(", ");
  }

  return tagList || "";
}

function parseTagList(tagList) {
  return tagList
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function ArticleEditorForm() {
  const [form, setForm] = useState(emptyForm);
  const [errorMessage, setErrorMessage] = useState("");
  const { headers, isAuth, loggedUser } = useAuth();
  const { slug } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const { title, description, coverImage, body, tagList } = form;

  useEffect(() => {
    if (!isAuth) {
      navigate("/login", { replace: true });
      return;
    }

    if (!slug) {
      setForm(emptyForm);
      return;
    }

    const articleFromState = state && typeof state === "object" ? state : null;
    if (articleFromState?.title) {
      setForm({
        title: articleFromState.title || "",
        description: articleFromState.description || "",
        coverImage: articleFromState.coverImage || "",
        body: articleFromState.body || "",
        tagList: normalizeTagList(articleFromState.tagList),
        status: articleFromState.status || "published",
      });
      return;
    }

    getArticle({ headers, slug })
      .then((article) => {
        if (!article) return;

        setForm({
          title: article.title || "",
          description: article.description || "",
          coverImage: article.coverImage || "",
          body: article.body || "",
          tagList: normalizeTagList(article.tagList),
          status: article.status || "published",
        });
      })
      .catch(setErrorMessage);
  }, [headers, isAuth, navigate, slug, state]);

  function inputHandler(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  function submitArticle(nextStatus) {
    setErrorMessage("");

    return setArticle({
      headers,
      slug,
      title: form.title,
      description: form.description,
      coverImage: form.coverImage,
      body: form.body,
      status: nextStatus,
      tagList: parseTagList(form.tagList),
    })
      .then((nextSlug) => {
        if (!nextSlug) return;

        if (nextStatus === "draft") {
          navigate(`/profile/${loggedUser.username}/drafts`);
        } else {
          navigate(`/article/${nextSlug}`, { state: { publishSuccess: true } });
        }
      })
      .catch(setErrorMessage);
  }

  function formSubmit(event) {
    event.preventDefault();
    void submitArticle("published");
  }

  function saveDraft() {
    void submitArticle("draft");
  }

  return (
    <form onSubmit={formSubmit}>
      {errorMessage && <p className="error-messages">{errorMessage}</p>}

      <FormFieldset
        autoFocus
        required
        minLength="3"
        placeholder="文章标题"
        name="title"
        value={title}
        handler={inputHandler}
      ></FormFieldset>

      <FormFieldset
        required
        placeholder="文章摘要"
        name="description"
        value={description}
        handler={inputHandler}
      ></FormFieldset>

      <FormFieldset
        normal
        placeholder="封面图 URL"
        name="coverImage"
        value={coverImage}
        handler={inputHandler}
      ></FormFieldset>

      <fieldset className="form-group">
        <textarea
          className="form-control"
          name="body"
          placeholder="用 Markdown 写下你的文章"
          rows="8"
          value={body}
          onChange={inputHandler}
          required
        ></textarea>
      </fieldset>

      <FormFieldset
        normal
        placeholder="输入标签，用逗号分隔"
        name="tagList"
        value={tagList}
        handler={inputHandler}
      ></FormFieldset>

      <div className="editor-actions">
        <button
          className="btn btn-lg btn-outline-primary pull-xs-right"
          type="button"
          onClick={saveDraft}
        >
          保存草稿
        </button>
        <button className="btn btn-lg btn-primary pull-xs-right" type="submit">
          发布文章
        </button>
      </div>
    </form>
  );
}

export default ArticleEditorForm;
