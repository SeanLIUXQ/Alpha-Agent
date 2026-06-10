import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import deleteArticle from "../../services/deleteArticle";

function ArticleAuthorButtons({ body, description, slug, tagList, title }) {
  const { headers, isAuth } = useAuth();
  const navigate = useNavigate();

  const handleClick = () => {
    if (!isAuth) return alert("请先登录");

    const confirmation = window.confirm("确定要删除这篇文章吗？");
    if (!confirmation) return;

    deleteArticle({ headers, slug })
      .then(() => navigate("/"))
      .catch(console.error);
  };

  return (
    <>
      <button
        className="btn btn-sm"
        style={{ color: "#d00" }}
        onClick={handleClick}
      >
        <i className="ion-trash-a"></i> 删除文章
      </button>{" "}
      <button className="btn btn-sm" style={{ color: "#777" }}>
        <Link
          className="nav-link"
          state={{ body, description, tagList, title }}
          to={`/editor/${slug}`}
        >
          <i className="ion-edit"></i> 编辑文章
        </Link>
      </button>{" "}
    </>
  );
}

export default ArticleAuthorButtons;
